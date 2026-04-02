"""关注列表数据模型"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class WatchlistItem:
    """关注标的 — 对应 watchlist 表"""
    symbol: str             # '0700.HK', 'NVDA', 'BTC-USD'
    name: str               # '腾讯', '英伟达'
    type: str               # 'stock', 'index', 'crypto'
    market: str             # 'hk', 'us', 'cn', 'crypto'
    sector: Optional[str] = None
    enabled: bool = True
    added_at: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "name": self.name,
            "type": self.type,
            "market": self.market,
            "sector": self.sector,
            "enabled": self.enabled,
            "added_at": self.added_at,
        }

    @classmethod
    def from_row(cls, row) -> "WatchlistItem":
        keys = row.keys()
        return cls(
            symbol=row["symbol"],
            name=row["name"],
            type=row["type"],
            market=row["market"],
            sector=row["sector"] if "sector" in keys else None,
            enabled=bool(row["enabled"]) if "enabled" in keys else True,
            added_at=row["added_at"] if "added_at" in keys else None,
        )
