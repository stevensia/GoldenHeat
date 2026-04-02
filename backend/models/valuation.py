"""估值数据模型"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class Valuation:
    """估值数据 — 对应 valuation 表"""
    symbol: str
    date: str
    pe_ttm: Optional[float] = None
    pb: Optional[float] = None
    ps: Optional[float] = None
    pe_percentile: Optional[float] = None   # 10年PE分位
    pb_percentile: Optional[float] = None
    id: Optional[int] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "symbol": self.symbol,
            "date": self.date,
            "pe_ttm": self.pe_ttm,
            "pb": self.pb,
            "ps": self.ps,
            "pe_percentile": self.pe_percentile,
            "pb_percentile": self.pb_percentile,
        }

    @classmethod
    def from_row(cls, row) -> "Valuation":
        keys = row.keys()
        return cls(
            id=row["id"] if "id" in keys else None,
            symbol=row["symbol"],
            date=row["date"],
            pe_ttm=row["pe_ttm"] if "pe_ttm" in keys else None,
            pb=row["pb"] if "pb" in keys else None,
            ps=row["ps"] if "ps" in keys else None,
            pe_percentile=row["pe_percentile"] if "pe_percentile" in keys else None,
            pb_percentile=row["pb_percentile"] if "pb_percentile" in keys else None,
        )


@dataclass
class IndexPE:
    """指数 PE 数据（独立来源，非 yfinance）"""
    symbol: str
    date: str
    pe: Optional[float] = None
    pe_percentile: Optional[float] = None
    pe_pct_5y: Optional[float] = None       # 5年PE百分位
    source: Optional[str] = None
    id: Optional[int] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "symbol": self.symbol,
            "date": self.date,
            "pe": self.pe,
            "pe_percentile": self.pe_percentile,
            "pe_pct_5y": self.pe_pct_5y,
            "source": self.source,
        }

    @classmethod
    def from_row(cls, row) -> "IndexPE":
        keys = row.keys()
        return cls(
            id=row["id"] if "id" in keys else None,
            symbol=row["symbol"],
            date=row["date"],
            pe=row["pe"] if "pe" in keys else None,
            pe_percentile=row["pe_percentile"] if "pe_percentile" in keys else None,
            pe_pct_5y=row["pe_pct_5y"] if "pe_pct_5y" in keys else None,
            source=row["source"] if "source" in keys else None,
        )
