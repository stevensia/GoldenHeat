"""BaseRepository — 通用数据访问基类

所有 repo 继承此类，获得标准 CRUD 操作。
通过 backend.db.connection 获取线程安全的 SQLite 连接。
"""

import logging
from typing import Any, Optional

from backend.db.connection import get_db

logger = logging.getLogger(__name__)


class BaseRepository:
    """通用 Repository 基类"""

    table: str = ""  # 子类必须设置

    # ── 查询 ──

    def get_by_id(self, id: int) -> Optional[dict]:
        """按主键查询单条"""
        conn = get_db()
        row = conn.execute(
            f"SELECT * FROM {self.table} WHERE id = ?", (id,)
        ).fetchone()
        return dict(row) if row else None

    def find(
        self,
        filters: Optional[dict[str, Any]] = None,
        order_by: Optional[str] = None,
        limit: Optional[int] = None,
        offset: int = 0,
    ) -> list[dict]:
        """条件查询

        Args:
            filters: 等值过滤条件 {column: value}
            order_by: 排序子句 (如 'date DESC')
            limit: 限制条数
            offset: 偏移量
        """
        sql = f"SELECT * FROM {self.table}"
        params: list[Any] = []

        if filters:
            clauses = []
            for col, val in filters.items():
                if val is None:
                    clauses.append(f"{col} IS NULL")
                else:
                    clauses.append(f"{col} = ?")
                    params.append(val)
            if clauses:
                sql += " WHERE " + " AND ".join(clauses)

        if order_by:
            sql += f" ORDER BY {order_by}"
        if limit is not None:
            sql += f" LIMIT {int(limit)}"
            if offset:
                sql += f" OFFSET {int(offset)}"

        conn = get_db()
        rows = conn.execute(sql, tuple(params)).fetchall()
        return [dict(r) for r in rows]

    def find_one(
        self,
        filters: Optional[dict[str, Any]] = None,
        order_by: Optional[str] = None,
    ) -> Optional[dict]:
        """查询单条"""
        results = self.find(filters=filters, order_by=order_by, limit=1)
        return results[0] if results else None

    # ── 写入 ──

    def insert(self, data: dict[str, Any]) -> int:
        """插入一条记录，返回 lastrowid"""
        cols = list(data.keys())
        placeholders = ", ".join(["?"] * len(cols))
        col_names = ", ".join(cols)
        values = [data[c] for c in cols]

        conn = get_db()
        cursor = conn.execute(
            f"INSERT INTO {self.table} ({col_names}) VALUES ({placeholders})",
            tuple(values),
        )
        conn.commit()
        return cursor.lastrowid

    def upsert(self, data: dict[str, Any], conflict_keys: list[str]) -> int:
        """插入或更新（ON CONFLICT），返回 lastrowid

        Args:
            data: 数据字典
            conflict_keys: 冲突判断的列名列表 (UNIQUE 约束)
        """
        cols = list(data.keys())
        placeholders = ", ".join(["?"] * len(cols))
        col_names = ", ".join(cols)
        values = [data[c] for c in cols]

        # 更新的列（排除冲突键）
        update_cols = [c for c in cols if c not in conflict_keys]
        if update_cols:
            update_clause = ", ".join(
                [f"{c}=excluded.{c}" for c in update_cols]
            )
            conflict_clause = ", ".join(conflict_keys)
            sql = (
                f"INSERT INTO {self.table} ({col_names}) VALUES ({placeholders}) "
                f"ON CONFLICT({conflict_clause}) DO UPDATE SET {update_clause}"
            )
        else:
            sql = (
                f"INSERT OR IGNORE INTO {self.table} ({col_names}) VALUES ({placeholders})"
            )

        conn = get_db()
        cursor = conn.execute(sql, tuple(values))
        conn.commit()
        return cursor.lastrowid

    def insert_many(self, data_list: list[dict[str, Any]]) -> int:
        """批量插入，返回插入条数"""
        if not data_list:
            return 0
        cols = list(data_list[0].keys())
        placeholders = ", ".join(["?"] * len(cols))
        col_names = ", ".join(cols)

        conn = get_db()
        cursor = conn.executemany(
            f"INSERT INTO {self.table} ({col_names}) VALUES ({placeholders})",
            [tuple(d[c] for c in cols) for d in data_list],
        )
        conn.commit()
        return cursor.rowcount

    def upsert_many(self, data_list: list[dict[str, Any]], conflict_keys: list[str]) -> int:
        """批量 upsert，返回影响行数"""
        if not data_list:
            return 0
        cols = list(data_list[0].keys())
        placeholders = ", ".join(["?"] * len(cols))
        col_names = ", ".join(cols)

        update_cols = [c for c in cols if c not in conflict_keys]
        if update_cols:
            update_clause = ", ".join([f"{c}=excluded.{c}" for c in update_cols])
            conflict_clause = ", ".join(conflict_keys)
            sql = (
                f"INSERT INTO {self.table} ({col_names}) VALUES ({placeholders}) "
                f"ON CONFLICT({conflict_clause}) DO UPDATE SET {update_clause}"
            )
        else:
            sql = f"INSERT OR IGNORE INTO {self.table} ({col_names}) VALUES ({placeholders})"

        conn = get_db()
        cursor = conn.executemany(
            sql, [tuple(d[c] for c in cols) for d in data_list]
        )
        conn.commit()
        return cursor.rowcount

    # ── 更新 & 删除 ──

    def update(self, id: int, data: dict[str, Any]) -> bool:
        """按 id 更新，返回是否成功"""
        if not data:
            return False
        set_clause = ", ".join([f"{c} = ?" for c in data.keys()])
        values = list(data.values()) + [id]

        conn = get_db()
        cursor = conn.execute(
            f"UPDATE {self.table} SET {set_clause} WHERE id = ?",
            tuple(values),
        )
        conn.commit()
        return cursor.rowcount > 0

    def delete(self, id: int) -> bool:
        """按 id 删除，返回是否成功"""
        conn = get_db()
        cursor = conn.execute(
            f"DELETE FROM {self.table} WHERE id = ?", (id,)
        )
        conn.commit()
        return cursor.rowcount > 0

    def count(self, filters: Optional[dict[str, Any]] = None) -> int:
        """统计条数"""
        sql = f"SELECT COUNT(*) as cnt FROM {self.table}"
        params: list[Any] = []

        if filters:
            clauses = []
            for col, val in filters.items():
                if val is None:
                    clauses.append(f"{col} IS NULL")
                else:
                    clauses.append(f"{col} = ?")
                    params.append(val)
            if clauses:
                sql += " WHERE " + " AND ".join(clauses)

        conn = get_db()
        row = conn.execute(sql, tuple(params)).fetchone()
        return row["cnt"] if row else 0

    # ── 原始查询 ──

    def raw_query(self, sql: str, params: tuple = ()) -> list[dict]:
        """执行原始 SQL 查询"""
        conn = get_db()
        rows = conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows]

    def raw_query_one(self, sql: str, params: tuple = ()) -> Optional[dict]:
        """执行原始 SQL 查询单条"""
        conn = get_db()
        row = conn.execute(sql, params).fetchone()
        return dict(row) if row else None

    def raw_execute(self, sql: str, params: tuple = ()) -> int:
        """执行原始 SQL (写入)，返回 rowcount"""
        conn = get_db()
        cursor = conn.execute(sql, params)
        conn.commit()
        return cursor.rowcount
