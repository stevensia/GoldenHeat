"""市场温度计 — 综合量化牛熊程度

综合三个维度计算 0-100 的"温度"值:
- PE 分位权重 40%（用价格历史分位数近似）
- 均线位置权重 35%（current vs MA12/MA24）
- 成交量异常权重 25%（量比偏离度）

温度等级:
  0-20  = 极寒（熊市底部区域）
  20-40 = 寒冷（偏熊市）
  40-60 = 温和（中性区间）
  60-80 = 炎热（偏牛市）
  80-100 = 极热（牛市顶部区域）
"""

import logging
from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd

from backend.config import WATCHLIST
from backend.repos.kline_repo import KlineRepo
from backend.repos.valuation_repo import ValuationRepo

logger = logging.getLogger(__name__)


# 温度等级定义
TEMP_LEVELS = [
    (0, 20, "极寒", "❄️", "熊市底部区域，极度恐慌"),
    (20, 40, "寒冷", "🌧️", "偏熊市，市场低迷"),
    (40, 60, "温和", "🌤️", "中性区间，方向不明"),
    (60, 80, "炎热", "🔥", "偏牛市，市场活跃"),
    (80, 100, "极热", "🌋", "牛市顶部区域，极度贪婪"),
]


@dataclass
class TemperatureResult:
    """温度计结果"""
    symbol: str
    name: str
    temperature: float       # 0-100
    level: str               # 极寒/寒冷/温和/炎热/极热
    emoji: str
    description: str
    pe_score: float          # PE 分位分 (0-100)
    ma_score: float          # 均线位置分 (0-100)
    volume_score: float      # 成交量分 (0-100)

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "name": self.name,
            "temperature": round(self.temperature, 1),
            "level": self.level,
            "emoji": self.emoji,
            "description": self.description,
            "breakdown": {
                "pe_score": round(self.pe_score, 1),
                "ma_score": round(self.ma_score, 1),
                "volume_score": round(self.volume_score, 1),
            },
        }


class MarketTemperature:
    """市场温度计引擎"""

    # 权重配置
    PE_WEIGHT = 0.40
    MA_WEIGHT = 0.35
    VOL_WEIGHT = 0.25

    def __init__(self, kline_repo: KlineRepo | None = None, valuation_repo: ValuationRepo | None = None):
        self.kline_repo = kline_repo or KlineRepo()
        self.valuation_repo = valuation_repo or ValuationRepo()

    def _load_kline(self, symbol: str) -> pd.DataFrame:
        """加载月线K线（通过 KlineRepo）"""
        rows = self.kline_repo.raw_query(
            """SELECT date, close, volume FROM monthly_kline
               WHERE symbol = ? ORDER BY date ASC""",
            (symbol,),
        )
        if not rows:
            return pd.DataFrame()
        df = pd.DataFrame([dict(r) for r in rows])
        df["close"] = pd.to_numeric(df["close"], errors="coerce")
        df["volume"] = pd.to_numeric(df["volume"], errors="coerce")
        df = df.dropna(subset=["close"]).reset_index(drop=True)
        return df

    def _pe_score(self, df: pd.DataFrame, symbol: str = "") -> float:
        """PE 分位分

        优先使用 valuation 表的真实 pe_percentile，
        如果无数据则降级回价格历史分位数近似。

        Args:
            df: K线数据
            symbol: 标的代码，用于查询 valuation 表
        """
        # 优先从 valuation 表获取真实 PE 百分位
        if symbol:
            try:
                rows = self.valuation_repo.raw_query(
                    """SELECT pe_percentile FROM valuation
                       WHERE symbol = ? AND pe_percentile IS NOT NULL
                       ORDER BY date DESC LIMIT 1""",
                    (symbol,),
                )
                if rows and rows[0]["pe_percentile"] is not None:
                    real_pct = float(rows[0]["pe_percentile"])
                    logger.debug(f"{symbol} 使用真实 PE 百分位: {real_pct:.1f}")
                    return max(0.0, min(100.0, real_pct))
            except Exception as e:
                logger.warning(f"{symbol} 查询 valuation 表失败，降级回价格近似: {e}")

        # 降级: 用价格历史分位数近似
        if len(df) < 12:
            return 50.0  # 数据不足，返回中性

        closes = df["close"].dropna().values
        current = closes[-1]
        min_p = np.min(closes)
        max_p = np.max(closes)

        if max_p == min_p:
            return 50.0

        pct = (current - min_p) / (max_p - min_p) * 100
        return max(0.0, min(100.0, pct))

    def _ma_score(self, df: pd.DataFrame) -> float:
        """均线位置分

        综合当前价格相对 MA12 和 MA24 的位置:
        - 价格远在均线之上 → 高温（可能过热）
        - 价格在均线附近 → 中性
        - 价格远在均线之下 → 低温（可能超卖）

        评分逻辑:
        - 基准50分
        - 价格在MA12之上: +15，之下: -15
        - MA12在MA24之上: +10，之下: -10
        - 偏离度加成: 偏离越大，温度越极端
        """
        if len(df) < 24:
            return 50.0

        df_calc = df.copy()
        df_calc["ma12"] = df_calc["close"].rolling(12).mean()
        df_calc["ma24"] = df_calc["close"].rolling(24).mean()

        last = df_calc.iloc[-1]
        close = last["close"]
        ma12 = last["ma12"]
        ma24 = last["ma24"]

        if pd.isna(ma12) or pd.isna(ma24):
            return 50.0

        score = 50.0

        # 价格 vs MA12
        if close > ma12:
            score += 15
        else:
            score -= 15

        # MA12 vs MA24
        if ma12 > ma24:
            score += 10
        else:
            score -= 10

        # 偏离度加成（每偏离1%，加减0.5分，最多±25分）
        deviation = (close - ma12) / ma12 * 100
        deviation_bonus = max(-25, min(25, deviation * 0.5))
        score += deviation_bonus

        return max(0.0, min(100.0, score))

    def _volume_score(self, df: pd.DataFrame) -> float:
        """成交量异常分

        量比偏离度:
        - 量比极低（< 0.5）→ 低温（市场冷清）
        - 量比正常（0.7-1.3）→ 中性
        - 量比极高（> 2.0）→ 高温（市场亢奋）

        但需结合价格: 放量下跌是恐慌（低温），放量上涨是亢奋（高温）
        """
        if len(df) < 7:
            return 50.0

        current_vol = df.iloc[-1]["volume"]
        avg_vol = df.iloc[-7:-1]["volume"].mean()

        if pd.isna(current_vol) or pd.isna(avg_vol) or avg_vol == 0:
            return 50.0

        vol_ratio = current_vol / avg_vol

        # 价格变动方向
        price_change = (df.iloc[-1]["close"] - df.iloc[-2]["close"]) if len(df) >= 2 else 0
        price_up = price_change >= 0

        if vol_ratio < 0.5:
            # 极度缩量 → 市场冷清
            return 25.0
        elif vol_ratio < 0.7:
            return 35.0
        elif vol_ratio <= 1.3:
            # 正常量能
            return 50.0
        elif vol_ratio <= 2.0:
            # 温和放量
            return 65.0 if price_up else 35.0
        else:
            # 极度放量
            return 85.0 if price_up else 15.0

    def _get_level(self, temp: float) -> tuple[str, str, str]:
        """获取温度等级"""
        for low, high, level, emoji, desc in TEMP_LEVELS:
            if low <= temp <= high:
                return level, emoji, desc
        return "温和", "🌤️", "中性区间"

    def calc_temperature(self, key: str, info: dict) -> Optional[TemperatureResult]:
        """计算单个标的的市场温度

        Args:
            key: WATCHLIST 键名
            info: 标的信息

        Returns:
            TemperatureResult
        """
        symbol = info["code"]
        name = info.get("name", key)

        df = self._load_kline(symbol)
        if df.empty or len(df) < 12:
            logger.warning(f"{name}({symbol}) 数据不足，无法计算温度")
            return None

        # 三维度评分
        pe_score = self._pe_score(df, symbol=symbol)
        ma_score = self._ma_score(df)
        vol_score = self._volume_score(df)

        # 加权计算综合温度
        temperature = (
            pe_score * self.PE_WEIGHT +
            ma_score * self.MA_WEIGHT +
            vol_score * self.VOL_WEIGHT
        )
        temperature = max(0.0, min(100.0, temperature))

        level, emoji, description = self._get_level(temperature)

        result = TemperatureResult(
            symbol=symbol,
            name=name,
            temperature=temperature,
            level=level,
            emoji=emoji,
            description=description,
            pe_score=pe_score,
            ma_score=ma_score,
            volume_score=vol_score,
        )

        logger.info(f"🌡️ {name}({symbol}): {temperature:.0f}° {emoji}{level}")
        return result

    def calc_all(self) -> list[TemperatureResult]:
        """计算所有标的的温度

        Returns:
            list of TemperatureResult，按温度降序
        """
        results = []
        for key, info in WATCHLIST.items():
            try:
                result = self.calc_temperature(key, info)
                if result:
                    results.append(result)
            except Exception as e:
                logger.error(f"❌ {key} 温度计算失败: {e}")

        results.sort(key=lambda r: r.temperature, reverse=True)
        return results

    def calc_market_avg(self) -> Optional[TemperatureResult]:
        """计算市场整体平均温度（仅指数类标的）

        Returns:
            TemperatureResult (symbol='MARKET_AVG')
        """
        temps = []
        for key, info in WATCHLIST.items():
            if info.get("type") == "index":
                result = self.calc_temperature(key, info)
                if result:
                    temps.append(result.temperature)

        if not temps:
            return None

        avg_temp = sum(temps) / len(temps)
        level, emoji, description = self._get_level(avg_temp)

        return TemperatureResult(
            symbol="MARKET_AVG",
            name="市场综合",
            temperature=avg_temp,
            level=level,
            emoji=emoji,
            description=description,
            pe_score=0,
            ma_score=0,
            volume_score=0,
        )
