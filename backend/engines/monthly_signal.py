"""月线信号系统 — 标的级别买卖时机判断

对每个关注标的，综合以下维度计算月线级别信号:
1. MA5/MA10/MA20 均线系统 → 趋势判断
2. 回调位置判断 → 回踩哪根均线
3. 成交量分析 → 缩量/放量确认
4. 估值锚定 → PE/PB 分位数加减分
5. 综合评分 0-100 → 信号级别

信号级别:
  🔴 强买入 ≥80: 深度回调 + 低估 + 缩量 + 美林利好
  🟡 关注  60-79: 部分条件满足，等待确认
  ⚪ 持有  40-59: 趋势正常，无需操作
  🟡 警惕  20-39: 见顶信号，考虑减仓
  🔴 强卖出 <20: 跌破关键支撑 + 高估 + 放量
"""

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import numpy as np
import pandas as pd

from backend.config import WATCHLIST, MONTHLY_SIGNAL
from backend.repos.kline_repo import KlineRepo
from backend.repos.valuation_repo import ValuationRepo

logger = logging.getLogger(__name__)


class Trend(Enum):
    """月线趋势"""
    BULLISH = "bullish"       # 多头排列 — 主升段
    BEARISH = "bearish"       # 空头排列 — 主跌段
    SIDEWAYS = "sideways"     # 均线纠缠 — 震荡区间


class PullbackLevel(Enum):
    """回调位置"""
    ABOVE_MA5 = "above_ma5"           # 在 MA5 之上（无回调）
    AT_MA5 = "at_ma5"                 # 回踩 MA5 — 强势回调
    AT_MA10 = "at_ma10"               # 回踩 MA10 — 标准回调
    AT_MA20 = "at_ma20"               # 回踩 MA20 — 深度回调
    BELOW_MA20 = "below_ma20"         # 跌破 MA20 — 趋势可能反转


class SignalLevel(Enum):
    """信号级别"""
    STRONG_BUY = "strong_buy"       # 🔴 强买入 ≥80
    WATCH = "watch"                 # 🟡 关注 60-79
    HOLD = "hold"                   # ⚪ 持有 40-59
    CAUTION = "caution"             # 🟡 警惕 20-39
    STRONG_SELL = "strong_sell"     # 🔴 强卖出 <20


SIGNAL_LEVEL_MAP = {
    SignalLevel.STRONG_BUY:  {"label": "强买入", "emoji": "🔴", "min": 80, "max": 100},
    SignalLevel.WATCH:       {"label": "关注",   "emoji": "🟡", "min": 60, "max": 79},
    SignalLevel.HOLD:        {"label": "持有",   "emoji": "⚪", "min": 40, "max": 59},
    SignalLevel.CAUTION:     {"label": "警惕",   "emoji": "🟡", "min": 20, "max": 39},
    SignalLevel.STRONG_SELL: {"label": "强卖出", "emoji": "🔴", "min": 0,  "max": 19},
}


@dataclass
class SignalResult:
    """月线信号计算结果"""
    symbol: str
    name: str
    score: float                           # 综合评分 0-100
    level: SignalLevel                     # 信号级别
    trend: Trend                           # 趋势判断
    pullback: PullbackLevel                # 回调位置
    ma5: Optional[float] = None            # MA5 值
    ma10: Optional[float] = None           # MA10 值
    ma20: Optional[float] = None           # MA20 值
    current_price: Optional[float] = None  # 当前月线收盘价
    volume_signal: Optional[str] = None    # 成交量信号
    volume_ratio: Optional[float] = None   # 量比（当前/前N月均量）
    valuation_score: Optional[float] = None  # 估值分（-20 ~ +20）
    trend_score: float = 0.0               # 趋势分 (0-40)
    pullback_score: float = 0.0            # 回调分 (0-30)
    volume_score: float = 0.0              # 成交量分 (-10 ~ +10)
    detail: dict = field(default_factory=dict)  # 详细信息

    def to_dict(self) -> dict:
        level_info = SIGNAL_LEVEL_MAP[self.level]
        return {
            "symbol": self.symbol,
            "name": self.name,
            "score": round(self.score, 1),
            "level": self.level.value,
            "level_label": level_info["label"],
            "level_emoji": level_info["emoji"],
            "trend": self.trend.value,
            "trend_label": {"bullish": "多头排列", "bearish": "空头排列", "sideways": "震荡区间"}[self.trend.value],
            "pullback": self.pullback.value,
            "pullback_label": {
                "above_ma5": "MA5之上", "at_ma5": "回踩MA5",
                "at_ma10": "回踩MA10", "at_ma20": "回踩MA20",
                "below_ma20": "跌破MA20",
            }[self.pullback.value],
            "current_price": self.current_price,
            "ma5": round(self.ma5, 2) if self.ma5 else None,
            "ma10": round(self.ma10, 2) if self.ma10 else None,
            "ma20": round(self.ma20, 2) if self.ma20 else None,
            "volume_signal": self.volume_signal,
            "volume_ratio": round(self.volume_ratio, 2) if self.volume_ratio else None,
            "breakdown": {
                "trend_score": round(self.trend_score, 1),
                "pullback_score": round(self.pullback_score, 1),
                "volume_score": round(self.volume_score, 1),
                "valuation_score": round(self.valuation_score, 1) if self.valuation_score is not None else None,
            },
        }


class MonthlySignal:
    """月线信号引擎

    对 WATCHLIST 中每个标的，计算月线级别的综合买卖信号。
    用 pandas rolling 手算 MA，不依赖 TA-Lib。
    """

    def __init__(self, kline_repo: KlineRepo | None = None, valuation_repo: ValuationRepo | None = None):
        self.ma_periods = MONTHLY_SIGNAL["ma_periods"]  # [5, 10, 20]
        self.pe_low = MONTHLY_SIGNAL["pe_low_percentile"]   # 30
        self.pe_high = MONTHLY_SIGNAL["pe_high_percentile"]  # 70
        self.vol_threshold = MONTHLY_SIGNAL["volume_change_threshold"]  # 1.5
        self.kline_repo = kline_repo or KlineRepo()
        self.valuation_repo = valuation_repo or ValuationRepo()

    def _load_kline(self, symbol: str) -> pd.DataFrame:
        """从 DB 加载月线K线数据（通过 KlineRepo）"""
        rows = self.kline_repo.raw_query(
            """SELECT date, open, high, low, close, volume, adj_close
               FROM monthly_kline WHERE symbol = ?
               ORDER BY date ASC""",
            (symbol,),
        )
        if not rows:
            return pd.DataFrame()

        df = pd.DataFrame([dict(r) for r in rows])
        for col in ["open", "high", "low", "close", "volume", "adj_close"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")
        # 过滤掉 close 为 NULL 的行（如当月未结束的数据）
        df = df.dropna(subset=["close"]).reset_index(drop=True)
        return df

    def _calc_ma(self, df: pd.DataFrame) -> pd.DataFrame:
        """计算 MA5/MA10/MA20（用 pandas rolling，不依赖 TA-Lib）"""
        for period in self.ma_periods:
            df[f"ma{period}"] = df["close"].rolling(window=period).mean()
        return df

    def judge_trend(self, df: pd.DataFrame) -> Trend:
        """趋势判断 — 基于均线排列

        多头排列: MA5 > MA10 > MA20 → 主升段
        空头排列: MA5 < MA10 < MA20 → 主跌段
        其他: 震荡区间
        """
        if len(df) < 20:
            return Trend.SIDEWAYS

        last = df.iloc[-1]
        ma5 = last.get("ma5")
        ma10 = last.get("ma10")
        ma20 = last.get("ma20")

        if pd.isna(ma5) or pd.isna(ma10) or pd.isna(ma20):
            return Trend.SIDEWAYS

        if ma5 > ma10 > ma20:
            return Trend.BULLISH
        elif ma5 < ma10 < ma20:
            return Trend.BEARISH
        else:
            return Trend.SIDEWAYS

    def judge_pullback(self, df: pd.DataFrame) -> PullbackLevel:
        """回调位置判断 — 当前价格相对均线的位置

        用于在多头趋势中判断回调买入区:
        - 回踩 MA5 → 强势回调（小仓买入）
        - 回踩 MA10 → 标准回调（标准买入）
        - 回踩 MA20 → 深度回调（重仓买入）
        - 跌破 MA20 → 趋势可能反转
        """
        if len(df) < 20:
            return PullbackLevel.ABOVE_MA5

        last = df.iloc[-1]
        close = last["close"]
        ma5 = last.get("ma5")
        ma10 = last.get("ma10")
        ma20 = last.get("ma20")

        if pd.isna(ma5) or pd.isna(ma10) or pd.isna(ma20):
            return PullbackLevel.ABOVE_MA5

        # 定义"接近"的阈值：价格在均线 ±3% 以内视为回踩
        tolerance = 0.03

        if close < ma20 * (1 - tolerance):
            return PullbackLevel.BELOW_MA20
        elif close < ma20 * (1 + tolerance):
            return PullbackLevel.AT_MA20
        elif close < ma10 * (1 + tolerance):
            return PullbackLevel.AT_MA10
        elif close < ma5 * (1 + tolerance):
            return PullbackLevel.AT_MA5
        else:
            return PullbackLevel.ABOVE_MA5

    def analyze_volume(self, df: pd.DataFrame) -> tuple[str, float]:
        """成交量分析

        计算量比 = 当月成交量 / 过去6个月平均成交量
        - 量比 < 0.7 → 缩量
        - 量比 > 1.5 → 放量
        - 其他 → 正常

        结合价格变动:
        - 缩量回调 → 健康（加分）
        - 放量下跌 → 恐慌（减分）
        - 放量上涨/突破 → 确认趋势（加分）

        Returns:
            (signal_str, volume_ratio)
        """
        if len(df) < 7:
            return ("数据不足", 1.0)

        current_vol = df.iloc[-1]["volume"]
        avg_vol = df.iloc[-7:-1]["volume"].mean()  # 前6个月均量

        if avg_vol is None or avg_vol == 0 or pd.isna(avg_vol) or pd.isna(current_vol):
            return ("无量数据", 1.0)

        vol_ratio = current_vol / avg_vol

        # 当月价格变动方向
        price_change = df.iloc[-1]["close"] - df.iloc[-2]["close"] if len(df) >= 2 else 0
        price_up = price_change > 0

        if vol_ratio < 0.7:
            if not price_up:
                return ("缩量回调", vol_ratio)
            else:
                return ("缩量上涨", vol_ratio)
        elif vol_ratio > self.vol_threshold:
            if price_up:
                return ("放量突破", vol_ratio)
            else:
                return ("放量下跌", vol_ratio)
        else:
            return ("量能正常", vol_ratio)

    def valuation_score_calc(self, symbol: str) -> Optional[float]:
        """估值锚定 — PE/PB 分位数

        从 valuation 表读取，如果无数据返回 None（不影响总分）

        Returns:
            估值分 (-20 ~ +20)
            - PE < 30% 分位 → +20 (低估加分)
            - PE 30-70% → 0 (中性)
            - PE > 70% → -20 (高估减分)
        """
        row = None
        rows = self.valuation_repo.raw_query(
            """SELECT pe_percentile, pb_percentile FROM valuation
               WHERE symbol = ? ORDER BY date DESC LIMIT 1""",
            (symbol,),
        )
        if rows:
            row = rows[0]

        if not row:
            # 没有估值数据，用价格历史近似估值分位
            # 用当前价格在10年价格区间中的位置近似
            return self._price_percentile_fallback(symbol)

        pe_pct = row["pe_percentile"]
        if pe_pct is None:
            return None

        if pe_pct < self.pe_low:
            # 低估，线性插值: 0% → +20, 30% → 0
            return 20 * (1 - pe_pct / self.pe_low)
        elif pe_pct > self.pe_high:
            # 高估，线性插值: 70% → 0, 100% → -20
            return -20 * (pe_pct - self.pe_high) / (100 - self.pe_high)
        else:
            return 0.0

    def _price_percentile_fallback(self, symbol: str) -> Optional[float]:
        """用价格历史分位数近似估值

        当没有 PE/PB 数据时的降级方案：
        当前价格在10年价格区间中的位置
        """
        rows = self.kline_repo.raw_query(
            """SELECT close FROM monthly_kline
               WHERE symbol = ? ORDER BY date ASC""",
            (symbol,),
        )
        if not rows or len(rows) < 12:
            return None

        closes = [r["close"] for r in rows if r["close"] is not None]
        if not closes:
            return None

        current = closes[-1]
        min_price = min(closes)
        max_price = max(closes)

        if max_price == min_price:
            return 0.0

        # 当前价格在历史区间中的百分位
        pct = (current - min_price) / (max_price - min_price) * 100

        if pct < self.pe_low:
            return 20 * (1 - pct / self.pe_low)
        elif pct > self.pe_high:
            return -20 * (pct - self.pe_high) / (100 - self.pe_high)
        else:
            return 0.0

    def calc_signal(self, key: str, info: dict) -> SignalResult:
        """计算单个标的的综合月线信号

        评分体系 (基准50分，范围 0-100):
        - 趋势分: 0-40（多头满分，空头零分，震荡中间）
        - 回调分: 0-30（回踩越深分越高，但跌破MA20扣分）
        - 成交量分: -10 ~ +10（缩量回调加分，放量下跌减分）
        - 估值分: -20 ~ +20（低估加分，高估减分）

        Args:
            key: WATCHLIST 键名
            info: 标的信息 dict

        Returns:
            SignalResult
        """
        symbol = info["code"]
        name = info.get("name", key)

        # 加载数据 & 计算均线
        df = self._load_kline(symbol)
        if df.empty or len(df) < 5:
            logger.warning(f"{name}({symbol}) 数据不足，无法计算信号")
            return SignalResult(
                symbol=symbol, name=name, score=50.0,
                level=SignalLevel.HOLD, trend=Trend.SIDEWAYS,
                pullback=PullbackLevel.ABOVE_MA5,
            )

        df = self._calc_ma(df)

        # 1. 趋势判断 (0-40分)
        trend = self.judge_trend(df)
        if trend == Trend.BULLISH:
            trend_score = 40.0
        elif trend == Trend.SIDEWAYS:
            trend_score = 20.0
        else:  # BEARISH
            trend_score = 0.0

        # 2. 回调位置 (0-30分)
        pullback = self.judge_pullback(df)
        pullback_scores = {
            PullbackLevel.ABOVE_MA5: 10.0,    # 在MA5之上：中性偏低（没有好的买入点）
            PullbackLevel.AT_MA5: 15.0,       # 回踩MA5：强势回调
            PullbackLevel.AT_MA10: 22.0,      # 回踩MA10：标准回调（好机会）
            PullbackLevel.AT_MA20: 30.0,      # 回踩MA20：深度回调（最佳机会）
            PullbackLevel.BELOW_MA20: 5.0,    # 跌破MA20：趋势反转风险
        }
        pullback_score = pullback_scores[pullback]

        # 空头趋势下，回调不是买入机会
        if trend == Trend.BEARISH:
            pullback_score = max(0, pullback_score - 15)

        # 3. 成交量分析 (-10 ~ +10)
        vol_signal, vol_ratio = self.analyze_volume(df)
        vol_score_map = {
            "缩量回调": 10.0,   # 健康回调，加分
            "放量突破": 8.0,    # 趋势确认，加分
            "缩量上涨": 3.0,    # 温和上涨
            "量能正常": 0.0,    # 中性
            "放量下跌": -10.0,  # 恐慌出逃，减分
            "数据不足": 0.0,
            "无量数据": 0.0,
        }
        volume_score = vol_score_map.get(vol_signal, 0.0)

        # 4. 估值分 (-20 ~ +20)
        val_score = self.valuation_score_calc(symbol)
        if val_score is None:
            val_score = 0.0

        # 综合评分: 基准线调整 + 各维度得分
        # 满分: 40 + 30 + 10 + 20 = 100
        # 最低: 0 + 0 + (-10) + (-20) = -30 → 归零
        raw_score = trend_score + pullback_score + volume_score + val_score
        score = max(0.0, min(100.0, raw_score))

        # 确定信号级别
        if score >= 80:
            level = SignalLevel.STRONG_BUY
        elif score >= 60:
            level = SignalLevel.WATCH
        elif score >= 40:
            level = SignalLevel.HOLD
        elif score >= 20:
            level = SignalLevel.CAUTION
        else:
            level = SignalLevel.STRONG_SELL

        last = df.iloc[-1]
        result = SignalResult(
            symbol=symbol,
            name=name,
            score=score,
            level=level,
            trend=trend,
            pullback=pullback,
            ma5=last.get("ma5"),
            ma10=last.get("ma10"),
            ma20=last.get("ma20"),
            current_price=last["close"],
            volume_signal=vol_signal,
            volume_ratio=vol_ratio,
            valuation_score=val_score,
            trend_score=trend_score,
            pullback_score=pullback_score,
            volume_score=volume_score,
        )

        logger.info(
            f"📊 {name}({symbol}): {score:.0f}分 [{SIGNAL_LEVEL_MAP[level]['label']}] "
            f"趋势={trend.value} 回调={pullback.value} 量={vol_signal}"
        )

        return result

    def calc_all(self) -> list[SignalResult]:
        """计算 WATCHLIST 中所有标的的月线信号

        Returns:
            list of SignalResult，按评分降序排列
        """
        results = []
        for key, info in WATCHLIST.items():
            try:
                result = self.calc_signal(key, info)
                results.append(result)
            except Exception as e:
                logger.error(f"❌ {key} 信号计算失败: {e}")

        # 按评分降序排列
        results.sort(key=lambda r: r.score, reverse=True)
        return results
