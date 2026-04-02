"""迁移脚本 — 创建 clock_assessments 和 indicator_history 表"""

import sys
from pathlib import Path

# 确保可以 import backend
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.db.connection import get_db

MIGRATION_SQL = """
-- 时钟评估历史
CREATE TABLE IF NOT EXISTS clock_assessments (
    id INTEGER PRIMARY KEY,
    assessed_at TEXT NOT NULL DEFAULT (datetime('now')),
    market TEXT NOT NULL DEFAULT 'cn',
    algo_phase TEXT NOT NULL,
    algo_position REAL NOT NULL,
    algo_confidence REAL NOT NULL,
    algo_details TEXT,
    ai_phase TEXT,
    ai_position REAL,
    ai_confidence REAL,
    ai_reasoning TEXT,
    human_phase TEXT,
    human_position REAL,
    human_confidence REAL,
    human_notes TEXT,
    human_confirmed_at TEXT,
    human_confirmed_by TEXT,
    final_phase TEXT NOT NULL,
    final_position REAL NOT NULL,
    final_confidence REAL NOT NULL,
    weights TEXT NOT NULL,
    trigger_type TEXT NOT NULL DEFAULT 'manual',
    notification_sent INTEGER DEFAULT 0,
    UNIQUE(market, assessed_at)
);

-- 指标变更历史
CREATE TABLE IF NOT EXISTS indicator_history (
    id INTEGER PRIMARY KEY,
    assessment_id INTEGER REFERENCES clock_assessments(id),
    indicator TEXT NOT NULL,
    value REAL NOT NULL,
    previous_value REAL,
    date TEXT NOT NULL,
    source TEXT NOT NULL,
    recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_indicator_history_assessment ON indicator_history(assessment_id);
CREATE INDEX IF NOT EXISTS idx_indicator_history_indicator ON indicator_history(indicator, date);
"""


def migrate():
    """执行迁移"""
    conn = get_db()
    conn.executescript(MIGRATION_SQL)
    conn.commit()

    # 验证
    tables = [r[0] for r in conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()]

    assert "clock_assessments" in tables, "clock_assessments 表未创建"
    assert "indicator_history" in tables, "indicator_history 表未创建"

    print("✅ 迁移完成: clock_assessments, indicator_history 表已创建")


if __name__ == "__main__":
    migrate()
