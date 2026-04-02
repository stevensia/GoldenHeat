"""K线数据 Repository"""

from typing import Optional

from backend.models.kline import MonthlyKline
from backend.repos.base import BaseRepository


class KlineRepo(BaseRepository):
    table = "monthly_kline"

    def get_monthly(self, symbol: str, months: int = 60) -> list[MonthlyKline]:
        """获取月线数据（默认5年）"""
        rows = self.raw_query(
            """SELECT * FROM monthly_kline
               WHERE symbol = ?
               ORDER BY date DESC
               LIMIT ?""",
            (symbol, months),
        )
        # 返回时按时间正序
        return [MonthlyKline.from_row(r) for r in reversed(rows)]

    def get_latest(self, symbol: str) -> Optional[MonthlyKline]:
        """获取最新月线"""
        row = self.raw_query_one(
            """SELECT * FROM monthly_kline
               WHERE symbol = ? ORDER BY date DESC LIMIT 1""",
            (symbol,),
        )
        return MonthlyKline.from_row(row) if row else None

    def save(self, data: dict) -> int:
        """保存月线数据（upsert by symbol+date）"""
        return self.upsert(data, conflict_keys=["symbol", "date"])

    def save_batch(self, data_list: list[dict]) -> int:
        """批量保存月线数据"""
        return self.upsert_many(data_list, conflict_keys=["symbol", "date"])

    def get_freshness(self) -> list[dict]:
        """获取K线数据新鲜度"""
        return self.raw_query(
            """SELECT symbol,
                      MAX(date) as latest_date,
                      COUNT(*) as count
               FROM monthly_kline
               GROUP BY symbol
               ORDER BY symbol"""
        )
