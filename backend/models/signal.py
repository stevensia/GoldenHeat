"""信号数据模型"""

import json
from dataclasses import dataclass
from typing import Optional


@dataclass
class Signal:
    """信号快照 — 对应 signals 表"""
    date: str
    signal_type: str            # 'merill_phase', 'monthly_buy', 'bull_bear'
    signal_value: str           # JSON string
    symbol: Optional[str] = None    # NULL = 宏观信号
    confidence: Optional[float] = None
    created_at: Optional[str] = None
    id: Optional[int] = None

    def get_value_dict(self) -> dict:
        """解析 signal_value JSON"""
        try:
            return json.loads(self.signal_value)
        except (json.JSONDecodeError, TypeError):
            return {}

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "date": self.date,
            "symbol": self.symbol,
            "signal_type": self.signal_type,
            "signal_value": self.get_value_dict(),
            "confidence": self.confidence,
            "created_at": self.created_at,
        }

    @classmethod
    def from_row(cls, row) -> "Signal":
        keys = row.keys()
        return cls(
            id=row["id"] if "id" in keys else None,
            date=row["date"],
            symbol=row["symbol"] if "symbol" in keys else None,
            signal_type=row["signal_type"],
            signal_value=row["signal_value"],
            confidence=row["confidence"] if "confidence" in keys else None,
            created_at=row["created_at"] if "created_at" in keys else None,
        )
