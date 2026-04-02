"""月线K线数据采集 — 基于 yfinance

支持 config.py 中 WATCHLIST 的所有标的（A/港/美/BTC/指数）
至少拉取 10 年历史月线数据，存入 monthly_kline 表
"""

import logging
import time
from datetime import datetime, timedelta

import pandas as pd
import yfinance as yf

from backend.config import WATCHLIST
from backend.db.connection import get_db

logger = logging.getLogger(__name__)

# 重试参数
MAX_RETRIES = 3
RETRY_DELAY = 2  # 秒


class KlineCollector:
    """月线K线采集器"""

    def __init__(self, years: int = 10):
        """
        Args:
            years: 拉取历史数据的年份数，默认10年
        """
        self.years = years

    def fetch_symbol(self, key: str, info: dict) -> pd.DataFrame | None:
        """拉取单个标的的月线数据

        Args:
            key: WATCHLIST 中的标的键名
            info: 标的信息 dict（包含 code, name, type, market）

        Returns:
            月线 DataFrame 或 None（失败时）
        """
        symbol = info["code"]
        name = info.get("name", key)

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                logger.info(f"[{attempt}/{MAX_RETRIES}] 拉取 {name}({symbol}) 月线数据...")

                # 计算起止日期
                end_date = datetime.now()
                start_date = end_date - timedelta(days=self.years * 365)

                # yfinance 拉取月线 (interval='1mo')
                ticker = yf.Ticker(symbol)
                df = ticker.history(
                    start=start_date.strftime("%Y-%m-%d"),
                    end=end_date.strftime("%Y-%m-%d"),
                    interval="1mo",
                )

                if df.empty:
                    logger.warning(f"{name}({symbol}) 返回空数据")
                    return None

                # 标准化列名
                df = df.reset_index()
                df = df.rename(columns={
                    "Date": "date",
                    "Open": "open",
                    "High": "high",
                    "Low": "low",
                    "Close": "close",
                    "Volume": "volume",
                })

                # 处理 adj_close（yfinance 新版可能没有 Adj Close）
                if "Adj Close" in df.columns:
                    df = df.rename(columns={"Adj Close": "adj_close"})
                else:
                    df["adj_close"] = df["close"]

                # 日期转为 'YYYY-MM' 格式
                df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m")
                df["symbol"] = symbol

                # 去重（同月只保留最后一条）
                df = df.drop_duplicates(subset=["date"], keep="last")

                logger.info(f"✅ {name}({symbol}): 获取 {len(df)} 条月线数据")
                return df[["symbol", "date", "open", "high", "low", "close", "volume", "adj_close"]]

            except Exception as e:
                logger.error(f"❌ {name}({symbol}) 第{attempt}次失败: {e}")
                if attempt < MAX_RETRIES:
                    time.sleep(RETRY_DELAY * attempt)

        logger.error(f"❌ {name}({symbol}) 全部重试失败")
        return None

    def save_to_db(self, df: pd.DataFrame):
        """将 K 线数据写入 monthly_kline 表（UPSERT）"""
        if df is None or df.empty:
            return 0

        conn = get_db()
        rows = df.to_dict("records")
        inserted = 0

        for row in rows:
            try:
                conn.execute(
                    """INSERT INTO monthly_kline (symbol, date, open, high, low, close, volume, adj_close)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                       ON CONFLICT(symbol, date) DO UPDATE SET
                           open=excluded.open, high=excluded.high, low=excluded.low,
                           close=excluded.close, volume=excluded.volume, adj_close=excluded.adj_close
                    """,
                    (row["symbol"], row["date"], row["open"], row["high"],
                     row["low"], row["close"], row["volume"], row["adj_close"]),
                )
                inserted += 1
            except Exception as e:
                logger.error(f"写入失败 {row['symbol']} {row['date']}: {e}")

        conn.commit()
        return inserted

    def collect_all(self) -> dict:
        """拉取 WATCHLIST 中所有标的的月线数据

        Returns:
            dict: {标的键: 写入条数}
        """
        results = {}
        for key, info in WATCHLIST.items():
            df = self.fetch_symbol(key, info)
            count = self.save_to_db(df)
            results[key] = count
            # 避免请求过快被限流
            time.sleep(1)

        total = sum(results.values())
        logger.info(f"📊 K线采集完成: 共写入 {total} 条数据")
        return results
