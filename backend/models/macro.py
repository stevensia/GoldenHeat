"""宏观经济数据模型"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class MacroData:
    """宏观指标数据点"""
    indicator: str          # 'cn_cpi', 'us_gdp', 'cn_pmi' ...
    date: str               # 'YYYY-MM'
    value: float
    source: Optional[str] = None
    fetched_at: Optional[str] = None
    id: Optional[int] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "indicator": self.indicator,
            "date": self.date,
            "value": self.value,
            "source": self.source,
            "fetched_at": self.fetched_at,
        }

    @classmethod
    def from_row(cls, row) -> "MacroData":
        """从 sqlite3.Row 构造"""
        return cls(
            id=row["id"] if "id" in row.keys() else None,
            indicator=row["indicator"],
            date=row["date"],
            value=row["value"],
            source=row["source"] if "source" in row.keys() else None,
            fetched_at=row["fetched_at"] if "fetched_at" in row.keys() else None,
        )
