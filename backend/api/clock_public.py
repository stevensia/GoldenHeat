"""Clock Public API — 美林时钟公开摘要接口（无需 token）

GET /api/clock/summary — 返回 cn + us 双市场时钟摘要
"""

import json
import logging

from fastapi import APIRouter

from backend.db.connection import fetchone
from backend.engines.merill_clock import MerillClock, PHASE_ALLOCATION, Phase, calc_position
from backend.api.response import ok, server_error

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/clock")


def _clock_from_assessment(market: str) -> dict | None:
    """从 clock_assessments 表获取最新评估结果"""
    row = fetchone(
        """SELECT * FROM clock_assessments
           WHERE market = ? ORDER BY assessed_at DESC LIMIT 1""",
        (market,),
    )
    if not row:
        return None

    phase_str = row["final_phase"]
    try:
        phase_enum = Phase(phase_str)
    except ValueError:
        return None

    phase_info = PHASE_ALLOCATION[phase_enum]

    algo_details = {}
    if row["algo_details"]:
        try:
            algo_details = json.loads(row["algo_details"])
        except json.JSONDecodeError:
            pass

    return {
        "phase": phase_str,
        "phase_label": phase_info["label"],
        "confidence": round(row["final_confidence"], 3),
        "gdp_trend": algo_details.get("gdp_trend", "down" if phase_str in ("stagflation", "recession") else "up"),
        "cpi_trend": algo_details.get("cpi_trend", "up" if phase_str in ("overheat", "stagflation") else "down"),
        "gdp_slope": algo_details.get("gdp_slope", 0),
        "cpi_slope": algo_details.get("cpi_slope", 0),
        "pmi_value": algo_details.get("pmi_value"),
        "pmi_confirm": algo_details.get("pmi_confirm"),
        "m2_growth": algo_details.get("m2_growth"),
        "gdp_growth": algo_details.get("gdp_growth"),
        "credit_signal": algo_details.get("credit_signal"),
        "transition_warning": algo_details.get("transition_warning"),
        "best_asset": phase_info["best_asset"],
        "allocation": phase_info["allocation"],
        "description": phase_info["description"],
        "position": round(row["final_position"], 1),
        "source": "weighted",
    }


def _clock_from_algo(market: str) -> dict:
    """降级：无评估记录时走算法"""
    clock = MerillClock()
    result = clock.judge_phase(market=market)
    d = result.to_dict()
    d["source"] = "algo"
    d["position"] = calc_position(
        Phase(d["phase"]),
        d["confidence"],
        d["gdp_slope"],
        d["cpi_slope"],
    )
    return d


@router.get("/summary")
async def clock_summary():
    """返回 cn + us 双市场时钟摘要（无需 token）"""
    result = {}
    for market in ("cn", "us"):
        try:
            data = _clock_from_assessment(market)
            if data is None:
                data = _clock_from_algo(market)
            result[market] = data
        except Exception as e:
            logger.warning(f"获取 {market} 时钟失败: {e}")
            result[market] = None

    return ok(result)
