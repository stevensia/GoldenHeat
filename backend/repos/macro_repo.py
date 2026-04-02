"""宏观数据 Repository"""

from typing import Optional

import pandas as pd

from backend.models.macro import MacroData
from backend.repos.base import BaseRepository


class MacroRepo(BaseRepository):
    table = "macro_data"

    def get_latest(self, indicator: str) -> Optional[MacroData]:
        """获取某指标最新一条数据"""
        row = self.raw_query_one(
            """SELECT * FROM macro_data
               WHERE indicator = ? ORDER BY date DESC LIMIT 1""",
            (indicator,),
        )
        return MacroData.from_row(row) if row else None

    def get_history(self, indicator: str, months: int = 120) -> list[MacroData]:
        """获取某指标历史数据（默认10年）"""
        rows = self.raw_query(
            """SELECT * FROM macro_data
               WHERE indicator = ?
               ORDER BY date ASC
               LIMIT ?""",
            (indicator, months),
        )
        return [MacroData.from_row(r) for r in rows]

    def get_series(self, indicator: str, limit: int = 500) -> pd.Series:
        """获取指标的 pandas Series（供引擎使用）

        Returns:
            pd.Series，index 为日期字符串，值为 float
        """
        rows = self.raw_query(
            """SELECT date, value FROM macro_data
               WHERE indicator = ?
               ORDER BY date ASC
               LIMIT ?""",
            (indicator, limit),
        )
        if not rows:
            return pd.Series(dtype=float)
        dates = [r["date"] for r in rows]
        values = [r["value"] for r in rows]
        return pd.Series(values, index=dates, dtype=float)

    def get_freshness(self) -> list[dict]:
        """获取所有指标的数据新鲜度（最新日期+条数）"""
        return self.raw_query(
            """SELECT indicator,
                      MAX(date) as latest_date,
                      COUNT(*) as count,
                      MAX(fetched_at) as last_fetched
               FROM macro_data
               GROUP BY indicator
               ORDER BY indicator"""
        )

    def save_indicator(
        self, indicator: str, date: str, value: float, source: str = "unknown"
    ) -> int:
        """保存单条指标数据（upsert）"""
        return self.upsert(
            {
                "indicator": indicator,
                "date": date,
                "value": value,
                "source": source,
            },
            conflict_keys=["indicator", "date"],
        )

    def save_indicator_batch(
        self, indicator: str, data: list[tuple[str, float]], source: str = "unknown"
    ) -> int:
        """批量保存指标数据"""
        if not data:
            return 0
        rows = [
            {"indicator": indicator, "date": d, "value": v, "source": source}
            for d, v in data
        ]
        return self.upsert_many(rows, conflict_keys=["indicator", "date"])
