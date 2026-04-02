"""牛熊分割线 — 大级别仓位判断

基于年线（月线 MA12）和两年线（月线 MA24）判断各市场牛熊状态。

四阶段:
  🟢 牛市格局: current > MA12 > MA24 → 80-100% 仓位
  🟡 牛市初期: current > MA12, MA12 < MA24 → 50-80% 仓位
  🟡 熊市初期: current < MA12, MA12 > MA24 → 20-50% 仓位
  🔴 熊市格局: current < MA12 < MA24 → 0-20% 仓位
"""

import logging
from dataclasses import dataclass
from enum import Enum
from typing import Optional

import pandas as pd

from backend.config import WATCHLIST
from backend.repos.kline_repo import KlineRepo

logger = logging.getLogger(__name__)


class MarketPhase(Enum):
    """市场牛熊阶段"""
    BULL = "bull"              # 牛市格局
    BULL_EARLY = "bull_early"  # 牛市初期
    BEAR_EARLY = "bear_early"  # 熊市初期
    BEAR = "bear"              # 熊市格局


# 各阶段信息和仓位映射
PHASE_INFO = {
    MarketPhase.BULL: {
        "label": "牛市格局",
        "emoji": "🟢",
        "position_range": (80, 100),
        "strategy": "月线回调加仓",
        "description": "价格站上年线、年线上穿两年线，牛市格局确立",
    },
    MarketPhase.BULL_EARLY: {
        "label": "牛市初期",
        "emoji": "🟡",
        "position_range": (50, 80),
        "strategy": "逐步建仓",
        "description": "价格站上年线但年线仍在两年线下方，底部初现",
    },
    MarketPhase.BEAR_EARLY: {
        "label": "熊市初期",
        "emoji": "🟡",
        "position_range": (20, 50),
        "strategy": "逐步减仓",
        "description": "价格跌破年线但年线仍在两年线上方，高位回落",
    },
    MarketPhase.BEAR: {
        "label": "熊市格局",
        "emoji": "🔴",
        "position_range": (0, 20),
        "strategy": "空仓等待",
        "description": "价格在年线下方、年线下穿两年线，熊市格局确立",
    },
}


@dataclass
class BullBearResult:
    """牛熊判断结果"""
    symbol: str
    name: str
    phase: MarketPhase
    current_price: float
    ma12: float              # 年线
    ma24: float              # 两年线
    price_vs_ma12: float     # 价格偏离年线百分比
    ma12_vs_ma24: float      # 年线偏离两年线百分比
    position_min: int        # 建议最低仓位
    position_max: int        # 建议最高仓位

    def to_dict(self) -> dict:
        info = PHASE_INFO[self.phase]
        return {
            "symbol": self.symbol,
            "name": self.name,
            "phase": self.phase.value,
            "phase_label": info["label"],
            "phase_emoji": info["emoji"],
            "current_price": round(self.current_price, 2),
            "ma12": round(self.ma12, 2),
            "ma24": round(self.ma24, 2),
            "price_vs_ma12_pct": round(self.price_vs_ma12, 2),
            "ma12_vs_ma24_pct": round(self.ma12_vs_ma24, 2),
            "position_range": f"{self.position_min}-{self.position_max}%",
            "position_min": self.position_min,
            "position_max": self.position_max,
            "strategy": info["strategy"],
            "description": info["description"],
        }


class BullBearJudge:
    """牛熊分割线判断引擎

    核心指标:
    - 年线 = 月线 MA12 (12个月移动平均)
    - 两年线 = 月线 MA24 (24个月移动平均)
    """

    def __init__(self, kline_repo: KlineRepo | None = None):
        self.kline_repo = kline_repo or KlineRepo()

    def _load_kline(self, symbol: str) -> pd.DataFrame:
        """从 DB 加载月线K线数据（通过 KlineRepo）"""
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
        # 过滤掉 close 为 NULL 的行（如当月未结束的数据）
        df = df.dropna(subset=["close"]).reset_index(drop=True)
        return df

    def judge(self, key: str, info: dict) -> Optional[BullBearResult]:
        """判断单个标的/指数的牛熊状态

        Args:
            key: WATCHLIST 键名
            info: 标的信息 dict

        Returns:
            BullBearResult 或 None (数据不足)
        """
        symbol = info["code"]
        name = info.get("name", key)

        df = self._load_kline(symbol)
        if df.empty or len(df) < 24:
            logger.warning(f"{name}({symbol}) 数据不足24个月，无法判断牛熊")
            return None

        # 计算年线 MA12 和两年线 MA24
        df["ma12"] = df["close"].rolling(window=12).mean()
        df["ma24"] = df["close"].rolling(window=24).mean()

        last = df.iloc[-1]
        current = last["close"]
        ma12 = last["ma12"]
        ma24 = last["ma24"]

        if pd.isna(ma12) or pd.isna(ma24):
            logger.warning(f"{name}({symbol}) 均线数据不足")
            return None

        # 四阶段判断
        if current > ma12 and ma12 > ma24:
            phase = MarketPhase.BULL
        elif current > ma12 and ma12 <= ma24:
            phase = MarketPhase.BULL_EARLY
        elif current <= ma12 and ma12 > ma24:
            phase = MarketPhase.BEAR_EARLY
        else:  # current <= ma12 and ma12 <= ma24
            phase = MarketPhase.BEAR

        # 偏离度计算
        price_vs_ma12 = (current - ma12) / ma12 * 100
        ma12_vs_ma24 = (ma12 - ma24) / ma24 * 100

        # 仓位建议
        pos_info = PHASE_INFO[phase]
        pos_min, pos_max = pos_info["position_range"]

        result = BullBearResult(
            symbol=symbol,
            name=name,
            phase=phase,
            current_price=current,
            ma12=ma12,
            ma24=ma24,
            price_vs_ma12=price_vs_ma12,
            ma12_vs_ma24=ma12_vs_ma24,
            position_min=pos_min,
            position_max=pos_max,
        )

        logger.info(
            f"📈 {name}({symbol}): {pos_info['emoji']} {pos_info['label']} "
            f"(价格偏离年线 {price_vs_ma12:+.1f}%, 仓位 {pos_min}-{pos_max}%)"
        )

        return result

    def judge_all(self) -> list[BullBearResult]:
        """判断 WATCHLIST 中所有标的的牛熊状态

        Returns:
            list of BullBearResult
        """
        results = []
        for key, info in WATCHLIST.items():
            try:
                result = self.judge(key, info)
                if result:
                    results.append(result)
            except Exception as e:
                logger.error(f"❌ {key} 牛熊判断失败: {e}")

        return results

    def judge_indices(self) -> list[BullBearResult]:
        """只判断指数类标的（用于大盘牛熊）

        Returns:
            list of BullBearResult (仅 type='index')
        """
        results = []
        for key, info in WATCHLIST.items():
            if info.get("type") == "index":
                try:
                    result = self.judge(key, info)
                    if result:
                        results.append(result)
                except Exception as e:
                    logger.error(f"❌ {key} 牛熊判断失败: {e}")

        return results
