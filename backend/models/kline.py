"""K线数据模型"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class MonthlyKline:
    """月线K线 — 对应 monthly_kline 表"""
    symbol: str
    date: str               # 'YYYY-MM'
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    close: Optional[float] = None
    volume: Optional[float] = None
    adj_close: Optional[float] = None
    id: Optional[int] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "symbol": self.symbol,
            "date": self.date,
            "open": self.open,
            "high": self.high,
            "low": self.low,
            "close": self.close,
            "volume": self.volume,
            "adj_close": self.adj_close,
        }

    @classmethod
    def from_row(cls, row) -> "MonthlyKline":
        keys = row.keys()
        return cls(
            id=row["id"] if "id" in keys else None,
            symbol=row["symbol"],
            date=row["date"],
            open=row["open"] if "open" in keys else None,
            high=row["high"] if "high" in keys else None,
            low=row["low"] if "low" in keys else None,
            close=row["close"] if "close" in keys else None,
            volume=row["volume"] if "volume" in keys else None,
            adj_close=row["adj_close"] if "adj_close" in keys else None,
        )
