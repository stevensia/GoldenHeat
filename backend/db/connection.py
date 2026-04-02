"""SQLite 连接管理"""

import sqlite3
import threading
from pathlib import Path
from backend.config import DB_PATH

# 线程本地存储，每个线程独立连接
_local = threading.local()

# Schema 文件路径
SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def get_db() -> sqlite3.Connection:
    """获取当前线程的数据库连接（线程安全）"""
    if not hasattr(_local, "conn") or _local.conn is None:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        _local.conn = conn
    return _local.conn


def init_db():
    """初始化数据库，执行 schema.sql 建表"""
    conn = get_db()
    schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")
    conn.executescript(schema_sql)
    conn.commit()
    print(f"✅ 数据库初始化完成: {DB_PATH}")


def execute(sql: str, params: tuple = ()) -> sqlite3.Cursor:
    """执行单条 SQL"""
    conn = get_db()
    cursor = conn.execute(sql, params)
    conn.commit()
    return cursor


def executemany(sql: str, params_list: list) -> sqlite3.Cursor:
    """批量执行 SQL"""
    conn = get_db()
    cursor = conn.executemany(sql, params_list)
    conn.commit()
    return cursor


def fetchall(sql: str, params: tuple = ()) -> list:
    """查询所有结果"""
    conn = get_db()
    return conn.execute(sql, params).fetchall()


def fetchone(sql: str, params: tuple = ()):
    """查询单条结果"""
    conn = get_db()
    return conn.execute(sql, params).fetchone()
