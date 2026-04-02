"""时钟评估 Repository"""

import json
from typing import Optional

from backend.models.clock import ClockAssessment, IndicatorHistory
from backend.repos.base import BaseRepository


class ClockRepo(BaseRepository):
    table = "clock_assessments"

    def save_assessment(self, assessment: dict) -> int:
        """保存评估记录，返回 id"""
        return self.insert(assessment)

    def get_latest(self, market: str = "cn") -> Optional[ClockAssessment]:
        """获取某市场最新评估"""
        row = self.raw_query_one(
            """SELECT * FROM clock_assessments
               WHERE market = ? ORDER BY assessed_at DESC LIMIT 1""",
            (market,),
        )
        return ClockAssessment.from_row(row) if row else None

    def get_history(self, market: str = "cn", limit: int = 20) -> list[ClockAssessment]:
        """获取某市场评估历史"""
        rows = self.raw_query(
            """SELECT * FROM clock_assessments
               WHERE market = ? ORDER BY assessed_at DESC LIMIT ?""",
            (market, limit),
        )
        return [ClockAssessment.from_row(r) for r in rows]

    def update_human(
        self,
        assessment_id: int,
        phase: str,
        position: float,
        confidence: float,
        notes: str = "",
        confirmed_by: str = "admin",
    ) -> bool:
        """更新人工确认"""
        return self.update(assessment_id, {
            "human_phase": phase,
            "human_position": position,
            "human_confidence": confidence,
            "human_notes": notes,
            "human_confirmed_at": "datetime('now')",
            "human_confirmed_by": confirmed_by,
        })

    def update_final(
        self,
        assessment_id: int,
        final_phase: str,
        final_position: float,
        final_confidence: float,
        weights: dict,
    ) -> bool:
        """更新最终加权结果"""
        return self.update(assessment_id, {
            "final_phase": final_phase,
            "final_position": final_position,
            "final_confidence": final_confidence,
            "weights": json.dumps(weights),
        })


class IndicatorHistoryRepo(BaseRepository):
    table = "indicator_history"

    def save_batch(self, assessment_id: int, indicators: list[dict]) -> int:
        """批量保存指标历史"""
        rows = []
        for ind in indicators:
            rows.append({
                "assessment_id": assessment_id,
                "indicator": ind["indicator"],
                "value": ind["value"],
                "previous_value": ind.get("previous_value"),
                "date": ind["date"],
                "source": ind["source"],
            })
        if not rows:
            return 0
        return self.insert_many(rows)

    def get_by_assessment(self, assessment_id: int) -> list[IndicatorHistory]:
        """获取某次评估关联的指标历史"""
        rows = self.raw_query(
            """SELECT * FROM indicator_history
               WHERE assessment_id = ? ORDER BY indicator""",
            (assessment_id,),
        )
        return [IndicatorHistory.from_row(r) for r in rows]
