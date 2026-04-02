"""数据库迁移管理

V2.5 新增表:
- watchlist: 关注列表（从 config.py WATCHLIST 迁移）
- dca_plans: 定投计划
- dca_records: 定投记录
- app_config: 运行时配置
- technical_analysis: 技术分析结果

注意: SQLite 不支持 ALTER TABLE ADD COLUMN IF NOT EXISTS，
migration 需要 try/except 处理已存在的列。
"""

import logging
from backend.db.connection import get_db

logger = logging.getLogger(__name__)

# 迁移列表: (版本号, 描述, SQL列表)
MIGRATIONS: list[tuple[str, str, list[str]]] = [
    (
        "v2.5.0",
        "关注列表",
        [
            """CREATE TABLE IF NOT EXISTS watchlist (
                symbol TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL DEFAULT 'stock',
                market TEXT NOT NULL DEFAULT 'us',
                sector TEXT,
                enabled INTEGER NOT NULL DEFAULT 1,
                added_at TEXT DEFAULT (datetime('now'))
            )""",
        ],
    ),
    (
        "v2.5.1",
        "定投计划",
        [
            """CREATE TABLE IF NOT EXISTS dca_plans (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                symbol TEXT NOT NULL,
                strategy TEXT NOT NULL DEFAULT 'fixed',
                amount REAL NOT NULL,
                frequency TEXT NOT NULL DEFAULT 'monthly',
                start_date TEXT NOT NULL,
                pe_low REAL,
                pe_high REAL,
                enabled INTEGER NOT NULL DEFAULT 1
            )""",
        ],
    ),
    (
        "v2.5.2",
        "定投记录",
        [
            """CREATE TABLE IF NOT EXISTS dca_records (
                id INTEGER PRIMARY KEY,
                plan_id INTEGER NOT NULL REFERENCES dca_plans(id),
                date TEXT NOT NULL,
                amount REAL NOT NULL,
                price REAL NOT NULL,
                shares REAL NOT NULL,
                pe_at_buy REAL,
                pe_percentile REAL,
                total_cost REAL,
                total_shares REAL
            )""",
            "CREATE INDEX IF NOT EXISTS idx_dca_records_plan ON dca_records(plan_id)",
            "CREATE INDEX IF NOT EXISTS idx_dca_records_date ON dca_records(date)",
        ],
    ),
    (
        "v2.5.3",
        "运行时配置",
        [
            """CREATE TABLE IF NOT EXISTS app_config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                type TEXT NOT NULL DEFAULT 'string',
                description TEXT,
                updated_at TEXT DEFAULT (datetime('now'))
            )""",
        ],
    ),
    (
        "v2.5.4",
        "技术分析结果",
        [
            """CREATE TABLE IF NOT EXISTS technical_analysis (
                id INTEGER PRIMARY KEY,
                symbol TEXT NOT NULL,
                date TEXT NOT NULL,
                indicators TEXT,
                composite_score REAL,
                alerts TEXT,
                summary TEXT,
                UNIQUE(symbol, date)
            )""",
            "CREATE INDEX IF NOT EXISTS idx_ta_symbol_date ON technical_analysis(symbol, date)",
        ],
    ),
    (
        "v2.5.5",
        "index_pe 增加 5 年百分位列",
        [
            "ALTER TABLE index_pe ADD COLUMN pe_pct_5y REAL",
        ],
    ),
    (
        "v2.5.6",
        "迁移版本跟踪",
        [
            """CREATE TABLE IF NOT EXISTS _migrations (
                version TEXT PRIMARY KEY,
                description TEXT,
                applied_at TEXT DEFAULT (datetime('now'))
            )""",
        ],
    ),
]


def get_applied_versions() -> set[str]:
    """获取已应用的迁移版本"""
    conn = get_db()
    try:
        rows = conn.execute("SELECT version FROM _migrations").fetchall()
        return {r["version"] for r in rows}
    except Exception:
        # _migrations 表可能不存在
        return set()


def run_migrations() -> list[str]:
    """运行所有未应用的迁移

    Returns:
        成功应用的版本号列表
    """
    conn = get_db()

    # 先确保 _migrations 表存在
    conn.execute(
        """CREATE TABLE IF NOT EXISTS _migrations (
            version TEXT PRIMARY KEY,
            description TEXT,
            applied_at TEXT DEFAULT (datetime('now'))
        )"""
    )
    conn.commit()

    applied = get_applied_versions()
    newly_applied = []

    for version, description, sqls in MIGRATIONS:
        if version in applied:
            continue

        logger.info(f"🔄 运行迁移 {version}: {description}")
        success = True

        for sql in sqls:
            try:
                conn.execute(sql)
            except Exception as e:
                # ALTER TABLE ADD COLUMN 如果列已存在会报错，跳过
                if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
                    logger.info(f"  ⏭️  跳过 (已存在): {e}")
                else:
                    logger.error(f"  ❌ 迁移 {version} 失败: {e}")
                    success = False
                    break

        if success:
            conn.execute(
                "INSERT OR IGNORE INTO _migrations (version, description) VALUES (?, ?)",
                (version, description),
            )
            conn.commit()
            newly_applied.append(version)
            logger.info(f"  ✅ {version} 完成")

    if newly_applied:
        logger.info(f"📦 迁移完成: 应用了 {len(newly_applied)} 个版本")
    else:
        logger.info("📦 无需迁移，数据库已是最新")

    return newly_applied


def seed_watchlist() -> int:
    """从 config.py WATCHLIST 迁移种子数据到 watchlist 表"""
    from backend.config import WATCHLIST

    conn = get_db()
    inserted = 0

    for key, item in WATCHLIST.items():
        try:
            conn.execute(
                """INSERT OR IGNORE INTO watchlist (symbol, name, type, market, enabled)
                   VALUES (?, ?, ?, ?, 1)""",
                (item["code"], item["name"], item["type"], item["market"]),
            )
            inserted += 1
        except Exception as e:
            logger.error(f"种子数据 {key} 写入失败: {e}")

    conn.commit()
    logger.info(f"🌱 Watchlist 种子数据: {inserted} 条")
    return inserted


def seed_default_config() -> int:
    """写入默认配置到 app_config 表"""
    from backend.config import MERILL_CLOCK, MONTHLY_SIGNAL

    defaults = [
        ("merill.gdp_trend_window", str(MERILL_CLOCK["gdp_trend_window"]), "int", "GDP趋势窗口(季度)"),
        ("merill.cpi_trend_window", str(MERILL_CLOCK["cpi_trend_window"]), "int", "CPI趋势窗口(月)"),
        ("merill.pmi_threshold", str(MERILL_CLOCK["pmi_threshold"]), "int", "PMI荣枯线"),
        ("signal.ma_periods", str(MONTHLY_SIGNAL["ma_periods"]), "json", "月线均线周期"),
        ("signal.pe_low_percentile", str(MONTHLY_SIGNAL["pe_low_percentile"]), "int", "PE低估阈值"),
        ("signal.pe_high_percentile", str(MONTHLY_SIGNAL["pe_high_percentile"]), "int", "PE高估阈值"),
        ("signal.volume_change_threshold", str(MONTHLY_SIGNAL["volume_change_threshold"]), "float", "放量阈值"),
    ]

    conn = get_db()
    inserted = 0
    for key, value, type_, desc in defaults:
        try:
            conn.execute(
                """INSERT OR IGNORE INTO app_config (key, value, type, description)
                   VALUES (?, ?, ?, ?)""",
                (key, value, type_, desc),
            )
            inserted += 1
        except Exception as e:
            logger.error(f"默认配置 {key} 写入失败: {e}")

    conn.commit()
    logger.info(f"⚙️ 默认配置: {inserted} 条")
    return inserted
