"""定投 (DCA) Repository"""

from typing import Optional

from backend.models.dca import DCAPlan, DCARecord
from backend.repos.base import BaseRepository


class DCARepo(BaseRepository):
    table = "dca_plans"

    def get_plans(self, enabled_only: bool = False) -> list[DCAPlan]:
        """获取所有定投计划"""
        if enabled_only:
            rows = self.raw_query(
                "SELECT * FROM dca_plans WHERE enabled = 1 ORDER BY id"
            )
        else:
            rows = self.raw_query("SELECT * FROM dca_plans ORDER BY id")
        return [DCAPlan.from_row(r) for r in rows]

    def get_plan(self, plan_id: int) -> Optional[DCAPlan]:
        """获取单个计划"""
        row = self.get_by_id(plan_id)
        return DCAPlan.from_row(row) if row else None

    def create_plan(self, plan: dict) -> int:
        """创建定投计划"""
        return self.insert(plan)

    def update_plan(self, plan_id: int, data: dict) -> bool:
        """更新定投计划"""
        return self.update(plan_id, data)

    def toggle_plan(self, plan_id: int) -> bool:
        """启用/禁用计划"""
        count = self.raw_execute(
            "UPDATE dca_plans SET enabled = CASE WHEN enabled = 1 THEN 0 ELSE 1 END WHERE id = ?",
            (plan_id,),
        )
        return count > 0

    # ── 定投记录 ──

    def add_record(self, record: dict) -> int:
        """添加定投记录"""
        # 切换到 dca_records 表
        cols = list(record.keys())
        placeholders = ", ".join(["?"] * len(cols))
        col_names = ", ".join(cols)
        values = [record[c] for c in cols]

        from backend.db.connection import get_db
        conn = get_db()
        cursor = conn.execute(
            f"INSERT INTO dca_records ({col_names}) VALUES ({placeholders})",
            tuple(values),
        )
        conn.commit()
        return cursor.lastrowid

    def get_records(self, plan_id: int, limit: int = 100) -> list[DCARecord]:
        """获取定投记录"""
        from backend.db.connection import get_db
        conn = get_db()
        rows = conn.execute(
            """SELECT * FROM dca_records
               WHERE plan_id = ? ORDER BY date DESC LIMIT ?""",
            (plan_id, limit),
        ).fetchall()
        return [DCARecord.from_row(dict(r)) for r in rows]

    def get_history(self, symbol: Optional[str] = None, limit: int = 100) -> list[DCARecord]:
        """获取定投历史"""
        from backend.db.connection import get_db
        conn = get_db()
        if symbol:
            rows = conn.execute(
                """SELECT r.* FROM dca_records r
                   JOIN dca_plans p ON r.plan_id = p.id
                   WHERE p.symbol = ?
                   ORDER BY r.date DESC LIMIT ?""",
                (symbol, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM dca_records ORDER BY date DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [DCARecord.from_row(dict(r)) for r in rows]
