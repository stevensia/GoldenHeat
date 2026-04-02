"""指数PE Repository"""

from typing import Optional

from backend.models.valuation import IndexPE
from backend.repos.base import BaseRepository


class IndexPERepo(BaseRepository):
    table = "index_pe"

    def get_history(self, symbol: str, years: int = 10) -> list[IndexPE]:
        """获取指数 PE 历史"""
        months = years * 12
        rows = self.raw_query(
            """SELECT * FROM index_pe
               WHERE symbol = ?
               ORDER BY date DESC
               LIMIT ?""",
            (symbol, months),
        )
        return [IndexPE.from_row(r) for r in rows]

    def get_latest(self, symbol: str) -> Optional[IndexPE]:
        """获取最新指数 PE"""
        row = self.raw_query_one(
            """SELECT * FROM index_pe
               WHERE symbol = ? ORDER BY date DESC LIMIT 1""",
            (symbol,),
        )
        return IndexPE.from_row(row) if row else None

    def save_batch(self, data_list: list[dict]) -> int:
        """批量保存指数 PE 数据"""
        return self.upsert_many(data_list, conflict_keys=["symbol", "date"])
