"""GoldenHeat 数据模型 — dataclass 定义所有实体"""

from backend.models.macro import MacroData
from backend.models.clock import ClockAssessment, IndicatorHistory
from backend.models.valuation import Valuation, IndexPE
from backend.models.kline import MonthlyKline
from backend.models.signal import Signal
from backend.models.watchlist import WatchlistItem
from backend.models.config import AppConfig
from backend.models.dca import DCAPlan, DCARecord

__all__ = [
    "MacroData",
    "ClockAssessment",
    "IndicatorHistory",
    "Valuation",
    "IndexPE",
    "MonthlyKline",
    "Signal",
    "WatchlistItem",
    "AppConfig",
    "DCAPlan",
    "DCARecord",
]
