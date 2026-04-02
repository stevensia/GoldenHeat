"""定投 (DCA) 数据模型"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class DCAPlan:
    """定投计划 — 对应 dca_plans 表"""
    name: str
    symbol: str
    strategy: str           # 'fixed', 'pe_weighted', 'dynamic'
    amount: float           # 基准金额
    frequency: str          # 'monthly', 'biweekly', 'weekly'
    start_date: str
    pe_low: Optional[float] = None      # PE低估阈值(加码)
    pe_high: Optional[float] = None     # PE高估阈值(减码)
    enabled: bool = True
    id: Optional[int] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "symbol": self.symbol,
            "strategy": self.strategy,
            "amount": self.amount,
            "frequency": self.frequency,
            "start_date": self.start_date,
            "pe_low": self.pe_low,
            "pe_high": self.pe_high,
            "enabled": self.enabled,
        }

    @classmethod
    def from_row(cls, row) -> "DCAPlan":
        keys = row.keys()
        return cls(
            id=row["id"] if "id" in keys else None,
            name=row["name"],
            symbol=row["symbol"],
            strategy=row["strategy"],
            amount=row["amount"],
            frequency=row["frequency"],
            start_date=row["start_date"],
            pe_low=row["pe_low"] if "pe_low" in keys else None,
            pe_high=row["pe_high"] if "pe_high" in keys else None,
            enabled=bool(row["enabled"]) if "enabled" in keys else True,
        )


@dataclass
class DCARecord:
    """定投记录 — 对应 dca_records 表"""
    plan_id: int
    date: str
    amount: float
    price: float
    shares: float
    pe_at_buy: Optional[float] = None
    pe_percentile: Optional[float] = None
    total_cost: Optional[float] = None
    total_shares: Optional[float] = None
    id: Optional[int] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "plan_id": self.plan_id,
            "date": self.date,
            "amount": self.amount,
            "price": self.price,
            "shares": self.shares,
            "pe_at_buy": self.pe_at_buy,
            "pe_percentile": self.pe_percentile,
            "total_cost": self.total_cost,
            "total_shares": self.total_shares,
        }

    @classmethod
    def from_row(cls, row) -> "DCARecord":
        keys = row.keys()
        return cls(
            id=row["id"] if "id" in keys else None,
            plan_id=row["plan_id"],
            date=row["date"],
            amount=row["amount"],
            price=row["price"],
            shares=row["shares"],
            pe_at_buy=row["pe_at_buy"] if "pe_at_buy" in keys else None,
            pe_percentile=row["pe_percentile"] if "pe_percentile" in keys else None,
            total_cost=row["total_cost"] if "total_cost" in keys else None,
            total_shares=row["total_shares"] if "total_shares" in keys else None,
        )
