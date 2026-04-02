"""估值数据采集器 — PE/PB 历史数据

支持:
- 指数 PE/PB: 用 akshare 获取（上证、恒生等）
- 美股个股: 用 yfinance .info 获取当前 PE，结合历史价格和 EPS 近似历史 PE
- BTC: 跳过 PE，仅保留价格分位
- 所有数据月度粒度，日期格式 YYYY-MM
"""

import logging
import time
from typing import Optional

import numpy as np
import pandas as pd
import yfinance as yf

from backend.config import WATCHLIST
from backend.db.connection import fetchall, execute, get_db

logger = logging.getLogger(__name__)

# 重试参数
MAX_RETRIES = 3
RETRY_DELAY = 2


class ValuationCollector:
    """估值数据采集器"""

    def __init__(self, years: int = 10):
        self.years = years

    def fetch_us_stock_valuation(self, symbol: str, name: str) -> Optional[pd.DataFrame]:
        """用 yfinance 获取美股个股估值数据

        策略: 获取历史月线价格，结合 .info 中的 trailingEps 近似历史 PE
        PE_ttm ≈ monthly_close / trailing_eps（假设 EPS 变化平滑）
        """
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                logger.info(f"[{attempt}/{MAX_RETRIES}] 获取 {name}({symbol}) 估值数据...")
                ticker = yf.Ticker(symbol)
                info = ticker.info or {}

                # 获取当前 trailing EPS 和 PE
                trailing_eps = info.get("trailingEps")
                trailing_pe = info.get("trailingPE")
                price_to_book = info.get("priceToBook")

                # 从 monthly_kline 表获取历史价格
                rows = fetchall(
                    """SELECT date, close FROM monthly_kline
                       WHERE symbol = ? ORDER BY date ASC""",
                    (symbol,),
                )
                if not rows:
                    logger.warning(f"{name}({symbol}) 无月线数据")
                    return None

                df = pd.DataFrame([dict(r) for r in rows])
                df["close"] = pd.to_numeric(df["close"], errors="coerce")
                df = df.dropna(subset=["close"])

                if trailing_eps and trailing_eps > 0:
                    # 用最新 EPS 近似历史 PE (简化假设)
                    # 实际 EPS 随时间变化，这里做简单线性衰减假设
                    current_price = df.iloc[-1]["close"]
                    actual_pe = current_price / trailing_eps

                    # 用价格比例反推历史 PE
                    df["pe_ttm"] = df["close"] / trailing_eps
                elif trailing_pe:
                    current_price = df.iloc[-1]["close"]
                    implied_eps = current_price / trailing_pe
                    df["pe_ttm"] = df["close"] / implied_eps if implied_eps > 0 else None
                else:
                    # 无 EPS 数据，PE 留空
                    df["pe_ttm"] = None

                # PB: 用当前 price_to_book 和价格比例近似
                if price_to_book and price_to_book > 0:
                    current_price = df.iloc[-1]["close"]
                    implied_bvps = current_price / price_to_book
                    if implied_bvps > 0:
                        df["pb"] = df["close"] / implied_bvps
                    else:
                        df["pb"] = None
                else:
                    df["pb"] = None

                df["symbol"] = symbol
                df["ps"] = None  # PS 暂不采集

                logger.info(f"✅ {name}({symbol}): 获取 {len(df)} 条估值数据")
                return df[["symbol", "date", "pe_ttm", "pb", "ps"]]

            except Exception as e:
                logger.error(f"❌ {name}({symbol}) 第{attempt}次失败: {e}")
                if attempt < MAX_RETRIES:
                    time.sleep(RETRY_DELAY * attempt)

        return None

    def fetch_index_valuation(self, symbol: str, name: str, market: str) -> Optional[pd.DataFrame]:
        """获取指数估值数据

        对于指数，也用 yfinance .info 获取 PE，配合价格历史反推。
        """
        # 对指数也走 yfinance 逻辑
        return self.fetch_us_stock_valuation(symbol, name)

    def fetch_crypto_valuation(self, symbol: str, name: str) -> Optional[pd.DataFrame]:
        """加密货币: 无 PE/PB，只用价格分位

        返回 DataFrame 但 pe_ttm/pb/ps 均为 None，
        后续 percentile 计算时会跳过 PE 但保留价格分位信息。
        """
        rows = fetchall(
            """SELECT date, close FROM monthly_kline
               WHERE symbol = ? ORDER BY date ASC""",
            (symbol,),
        )
        if not rows:
            return None

        df = pd.DataFrame([dict(r) for r in rows])
        df["symbol"] = symbol
        df["pe_ttm"] = None
        df["pb"] = None
        df["ps"] = None

        logger.info(f"✅ {name}({symbol}): {len(df)} 条（加密，无 PE/PB）")
        return df[["symbol", "date", "pe_ttm", "pb", "ps"]]

    def fetch_valuation(self, key: str, info: dict) -> Optional[pd.DataFrame]:
        """根据标的类型选择采集策略"""
        symbol = info["code"]
        name = info.get("name", key)
        asset_type = info.get("type", "stock")
        market = info.get("market", "us")

        if asset_type == "crypto":
            return self.fetch_crypto_valuation(symbol, name)
        elif asset_type == "index":
            return self.fetch_index_valuation(symbol, name, market)
        else:
            return self.fetch_us_stock_valuation(symbol, name)

    @staticmethod
    def calc_rolling_percentile(series: pd.Series, window: int = 120) -> pd.Series:
        """计算滚动百分位

        对每个月，计算该值在过去 window 个月中的分位数。
        window 默认 120（10年月度数据）。
        """
        result = pd.Series(index=series.index, dtype=float)

        for i in range(len(series)):
            if pd.isna(series.iloc[i]):
                result.iloc[i] = None
                continue

            # 取过去 window 个数据（含当前）
            start = max(0, i - window + 1)
            window_data = series.iloc[start:i + 1].dropna()

            if len(window_data) < 6:
                # 数据太少，百分位不可靠
                result.iloc[i] = None
                continue

            current = series.iloc[i]
            # 百分位 = 小于等于当前值的比例
            pct = (window_data <= current).sum() / len(window_data) * 100
            result.iloc[i] = round(pct, 1)

        return result

    def save_to_db(self, df: pd.DataFrame) -> int:
        """将估值数据（含百分位）写入 valuation 表（UPSERT）"""
        if df is None or df.empty:
            return 0

        conn = get_db()
        inserted = 0

        for _, row in df.iterrows():
            try:
                conn.execute(
                    """INSERT INTO valuation (symbol, date, pe_ttm, pb, ps, pe_percentile, pb_percentile)
                       VALUES (?, ?, ?, ?, ?, ?, ?)
                       ON CONFLICT(symbol, date) DO UPDATE SET
                           pe_ttm=excluded.pe_ttm, pb=excluded.pb, ps=excluded.ps,
                           pe_percentile=excluded.pe_percentile, pb_percentile=excluded.pb_percentile
                    """,
                    (
                        row["symbol"], row["date"],
                        row.get("pe_ttm"), row.get("pb"), row.get("ps"),
                        row.get("pe_percentile"), row.get("pb_percentile"),
                    ),
                )
                inserted += 1
            except Exception as e:
                logger.error(f"写入失败 {row['symbol']} {row['date']}: {e}")

        conn.commit()
        return inserted

    def collect_all(self) -> dict:
        """采集 WATCHLIST 中所有标的的估值数据并回填

        Returns:
            dict: {标的键: 写入条数}
        """
        results = {}
        for key, info in WATCHLIST.items():
            try:
                df = self.fetch_valuation(key, info)
                if df is not None and not df.empty:
                    # 计算滚动百分位
                    if df["pe_ttm"].notna().any():
                        df["pe_percentile"] = self.calc_rolling_percentile(df["pe_ttm"])
                    else:
                        df["pe_percentile"] = None

                    if df["pb"].notna().any():
                        df["pb_percentile"] = self.calc_rolling_percentile(df["pb"])
                    else:
                        df["pb_percentile"] = None

                    count = self.save_to_db(df)
                    results[key] = count
                else:
                    results[key] = 0

                # 避免请求过快被限流
                time.sleep(1)
            except Exception as e:
                logger.error(f"❌ {key} 估值采集失败: {e}")
                results[key] = 0

        total = sum(results.values())
        logger.info(f"📊 估值采集完成: 共写入 {total} 条数据")
        return results
