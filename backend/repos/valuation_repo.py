"""估值数据 Repository"""

from typing import Optional

from backend.models.valuation import Valuation
from backend.repos.base import BaseRepository


class ValuationRepo(BaseRepository):
    table = "valuation"

    def get_pe_history(self, symbol: str, years: int = 10) -> list[Valuation]:
        """获取 PE 历史（默认10年）"""
        months = years * 12
        rows = self.raw_query(
            """SELECT * FROM valuation
               WHERE symbol = ?
               ORDER BY date DESC
               LIMIT ?""",
            (symbol, months),
        )
        return [Valuation.from_row(r) for r in rows]

    def get_latest(self, symbol: str) -> Optional[Valuation]:
        """获取最新估值"""
        row = self.raw_query_one(
            """SELECT * FROM valuation
               WHERE symbol = ? ORDER BY date DESC LIMIT 1""",
            (symbol,),
        )
        return Valuation.from_row(row) if row else None

    def get_latest_pe_percentile(self, symbol: str) -> Optional[float]:
        """获取最新 PE 百分位"""
        row = self.raw_query_one(
            """SELECT pe_percentile FROM valuation
               WHERE symbol = ? AND pe_percentile IS NOT NULL
               ORDER BY date DESC LIMIT 1""",
            (symbol,),
        )
        if row and row["pe_percentile"] is not None:
            return round(float(row["pe_percentile"]), 1)
        return None

    def calc_percentile(self, symbol: str, window: int = 120) -> Optional[float]:
        """计算当前 PE 在 window 个月内的百分位"""
        rows = self.raw_query(
            """SELECT pe_ttm FROM valuation
               WHERE symbol = ? AND pe_ttm IS NOT NULL
               ORDER BY date DESC LIMIT ?""",
            (symbol, window),
        )
        if not rows or len(rows) < 2:
            return None

        current_pe = rows[0]["pe_ttm"]
        all_pe = [r["pe_ttm"] for r in rows]
        below = sum(1 for p in all_pe if p < current_pe)
        return round(below / len(all_pe) * 100, 1)

    def save(self, data: dict) -> int:
        """保存估值数据（upsert by symbol+date）"""
        return self.upsert(data, conflict_keys=["symbol", "date"])

    def save_batch(self, data_list: list[dict]) -> int:
        """批量保存估值数据"""
        return self.upsert_many(data_list, conflict_keys=["symbol", "date"])

    def get_freshness(self) -> list[dict]:
        """获取估值数据新鲜度"""
        return self.raw_query(
            """SELECT symbol,
                      MAX(date) as latest_date,
                      COUNT(*) as count
               FROM valuation
               GROUP BY symbol
               ORDER BY symbol"""
        )
