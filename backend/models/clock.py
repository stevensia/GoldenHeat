"""时钟评估数据模型"""

import json
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ClockAssessment:
    """时钟评估记录 — 对应 clock_assessments 表"""
    market: str                     # cn / us / global
    assessed_at: str

    # 算法判断
    algo_phase: str
    algo_position: float
    algo_confidence: float
    algo_details: Optional[str] = None  # JSON string

    # AI 判断
    ai_phase: Optional[str] = None
    ai_position: Optional[float] = None
    ai_confidence: Optional[float] = None
    ai_reasoning: Optional[str] = None

    # 人工判断
    human_phase: Optional[str] = None
    human_position: Optional[float] = None
    human_confidence: Optional[float] = None
    human_notes: Optional[str] = None
    human_confirmed_at: Optional[str] = None
    human_confirmed_by: Optional[str] = None

    # 最终结果
    final_phase: str = ""
    final_position: float = 0.0
    final_confidence: float = 0.0
    weights: str = "{}"             # JSON string

    # 元数据
    trigger_type: str = "manual"
    notification_sent: int = 0
    id: Optional[int] = None

    def get_algo_details_dict(self) -> dict:
        """解析 algo_details JSON"""
        if self.algo_details:
            try:
                return json.loads(self.algo_details)
            except json.JSONDecodeError:
                pass
        return {}

    def get_weights_dict(self) -> dict:
        """解析 weights JSON"""
        try:
            return json.loads(self.weights)
        except json.JSONDecodeError:
            return {}

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "market": self.market,
            "assessed_at": self.assessed_at,
            "algo_phase": self.algo_phase,
            "algo_position": self.algo_position,
            "algo_confidence": self.algo_confidence,
            "algo_details": self.get_algo_details_dict(),
            "ai_phase": self.ai_phase,
            "ai_position": self.ai_position,
            "ai_confidence": self.ai_confidence,
            "ai_reasoning": self.ai_reasoning,
            "human_phase": self.human_phase,
            "human_position": self.human_position,
            "human_confidence": self.human_confidence,
            "human_notes": self.human_notes,
            "human_confirmed_at": self.human_confirmed_at,
            "final_phase": self.final_phase,
            "final_position": self.final_position,
            "final_confidence": self.final_confidence,
            "weights": self.get_weights_dict(),
            "trigger_type": self.trigger_type,
        }

    @classmethod
    def from_row(cls, row) -> "ClockAssessment":
        keys = row.keys()
        return cls(
            id=row["id"] if "id" in keys else None,
            market=row["market"],
            assessed_at=row["assessed_at"],
            algo_phase=row["algo_phase"],
            algo_position=row["algo_position"],
            algo_confidence=row["algo_confidence"],
            algo_details=row["algo_details"] if "algo_details" in keys else None,
            ai_phase=row["ai_phase"] if "ai_phase" in keys else None,
            ai_position=row["ai_position"] if "ai_position" in keys else None,
            ai_confidence=row["ai_confidence"] if "ai_confidence" in keys else None,
            ai_reasoning=row["ai_reasoning"] if "ai_reasoning" in keys else None,
            human_phase=row["human_phase"] if "human_phase" in keys else None,
            human_position=row["human_position"] if "human_position" in keys else None,
            human_confidence=row["human_confidence"] if "human_confidence" in keys else None,
            human_notes=row["human_notes"] if "human_notes" in keys else None,
            human_confirmed_at=row["human_confirmed_at"] if "human_confirmed_at" in keys else None,
            human_confirmed_by=row["human_confirmed_by"] if "human_confirmed_by" in keys else None,
            final_phase=row["final_phase"],
            final_position=row["final_position"],
            final_confidence=row["final_confidence"],
            weights=row["weights"] if "weights" in keys else "{}",
            trigger_type=row["trigger_type"] if "trigger_type" in keys else "manual",
            notification_sent=row["notification_sent"] if "notification_sent" in keys else 0,
        )


@dataclass
class IndicatorHistory:
    """指标变更历史 — 对应 indicator_history 表"""
    indicator: str
    value: float
    date: str
    source: str
    assessment_id: Optional[int] = None
    previous_value: Optional[float] = None
    recorded_at: Optional[str] = None
    id: Optional[int] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "assessment_id": self.assessment_id,
            "indicator": self.indicator,
            "value": self.value,
            "previous_value": self.previous_value,
            "date": self.date,
            "source": self.source,
            "recorded_at": self.recorded_at,
        }

    @classmethod
    def from_row(cls, row) -> "IndicatorHistory":
        keys = row.keys()
        return cls(
            id=row["id"] if "id" in keys else None,
            assessment_id=row["assessment_id"] if "assessment_id" in keys else None,
            indicator=row["indicator"],
            value=row["value"],
            previous_value=row["previous_value"] if "previous_value" in keys else None,
            date=row["date"],
            source=row["source"],
            recorded_at=row["recorded_at"] if "recorded_at" in keys else None,
        )
