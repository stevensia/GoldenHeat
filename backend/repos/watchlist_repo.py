"""关注列表 Repository"""

from typing import Optional

from backend.models.watchlist import WatchlistItem
from backend.repos.base import BaseRepository


class WatchlistRepo(BaseRepository):
    table = "watchlist"

    def get_all(self, enabled_only: bool = False) -> list[WatchlistItem]:
        """获取所有关注标的"""
        if enabled_only:
            rows = self.raw_query(
                "SELECT * FROM watchlist WHERE enabled = 1 ORDER BY market, symbol"
            )
        else:
            rows = self.raw_query(
                "SELECT * FROM watchlist ORDER BY market, symbol"
            )
        return [WatchlistItem.from_row(r) for r in rows]

    def get_by_symbol(self, symbol: str) -> Optional[WatchlistItem]:
        """按 symbol 查找"""
        row = self.raw_query_one(
            "SELECT * FROM watchlist WHERE symbol = ?", (symbol,)
        )
        return WatchlistItem.from_row(row) if row else None

    def add(self, item: WatchlistItem) -> int:
        """添加关注标的"""
        return self.upsert(
            {
                "symbol": item.symbol,
                "name": item.name,
                "type": item.type,
                "market": item.market,
                "sector": item.sector,
                "enabled": 1 if item.enabled else 0,
            },
            conflict_keys=["symbol"],
        )

    def remove(self, symbol: str) -> bool:
        """删除关注标的"""
        count = self.raw_execute(
            "DELETE FROM watchlist WHERE symbol = ?", (symbol,)
        )
        return count > 0

    def toggle(self, symbol: str) -> bool:
        """切换启用/禁用"""
        count = self.raw_execute(
            "UPDATE watchlist SET enabled = CASE WHEN enabled = 1 THEN 0 ELSE 1 END WHERE symbol = ?",
            (symbol,),
        )
        return count > 0

    def get_symbols(self, enabled_only: bool = True) -> list[str]:
        """获取所有 symbol 列表"""
        sql = "SELECT symbol FROM watchlist"
        if enabled_only:
            sql += " WHERE enabled = 1"
        sql += " ORDER BY market, symbol"
        rows = self.raw_query(sql)
        return [r["symbol"] for r in rows]
