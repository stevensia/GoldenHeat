"""Admin Clock API — 美林时钟三方加权管理接口

所有接口需要 Bearer token 认证。

- GET  /api/admin/clock/latest     — 最新评估（含三方详情）
- GET  /api/admin/clock/history    — 评估历史
- POST /api/admin/clock/assess     — 触发新评估（算法+AI）
- POST /api/admin/clock/confirm    — 人工确认/修正
- GET  /api/admin/clock/indicators — 当前所有指标最新值
"""

import logging

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from backend.api.auth import verify_admin_token
from backend.engines.clock_assessor import ClockAssessor
from backend.api.response import ok, error, server_error

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/clock")


class ConfirmBody(BaseModel):
    """人工确认请求体"""
    market: str = Field(default="cn", description="市场: cn / us / global")
    phase: str = Field(..., description="阶段: recovery / overheat / stagflation / recession")
    position: float = Field(..., ge=0, le=12, description="0-12 点位")
    confidence: float = Field(..., ge=0, le=1, description="0-1 置信度")
    notes: str = Field(default="", description="备注")


class AssessBody(BaseModel):
    """触发评估请求体"""
    market: str = Field(default="cn", description="市场: cn / us / global")
    trigger_type: str = Field(default="manual", description="触发类型")


@router.get("/latest")
async def get_latest(
    market: str = Query("cn", description="市场"),
    token: str = Depends(verify_admin_token),
):
    """获取最新评估（含三方详情）"""
    assessor = ClockAssessor()
    result = assessor.get_latest_assessment(market)
    if not result:
        return error("NO_ASSESSMENT", f"暂无 {market} 的评估记录，请先运行 /assess", status=404)
    return ok(result)


@router.get("/history")
async def get_history(
    market: str = Query("cn", description="市场"),
    limit: int = Query(20, ge=1, le=100, description="返回条数"),
    token: str = Depends(verify_admin_token),
):
    """评估历史"""
    assessor = ClockAssessor()
    return ok(assessor.get_assessment_history(market, limit))


@router.post("/assess")
async def run_assessment(
    body: AssessBody = None,
    token: str = Depends(verify_admin_token),
):
    """触发新评估（算法+AI）"""
    market = body.market if body else "cn"
    trigger_type = body.trigger_type if body else "manual"

    assessor = ClockAssessor()
    result = await assessor.run_assessment(market=market, trigger_type=trigger_type)
    return ok(result)


@router.post("/confirm")
async def confirm_human(
    body: ConfirmBody,
    token: str = Depends(verify_admin_token),
):
    """人工确认/修正"""
    valid_phases = {"recovery", "overheat", "stagflation", "recession"}
    if body.phase not in valid_phases:
        return error("INVALID_PHASE", f"无效 phase: {body.phase}，可选: {valid_phases}")

    assessor = ClockAssessor()
    try:
        result = assessor.confirm_human(
            market=body.market,
            phase=body.phase,
            position=body.position,
            confidence=body.confidence,
            notes=body.notes,
        )
        return ok(result)
    except ValueError as e:
        return error("CONFIRM_FAILED", str(e))


@router.get("/indicators")
async def get_indicators(
    market: str = Query("cn", description="市场"),
    token: str = Depends(verify_admin_token),
):
    """当前所有指标最新值"""
    from backend.db.connection import fetchone

    if market == "cn":
        indicators = [
            ("cn_gdp", "中国GDP增速", "国家统计局"),
            ("cn_cpi", "中国CPI", "国家统计局"),
            ("cn_pmi", "中国PMI", "国家统计局"),
            ("cn_m2", "中国M2增速", "中国人民银行"),
        ]
    else:
        indicators = [
            ("us_gdp", "美国GDP增速", "FRED"),
            ("us_cpi", "美国CPI", "FRED"),
        ]

    result = []
    for code, name, source in indicators:
        row = fetchone(
            """SELECT date, value FROM macro_data
               WHERE indicator = ? ORDER BY date DESC LIMIT 1""",
            (code,),
        )
        if row:
            result.append({
                "indicator": code,
                "name": name,
                "value": row["value"],
                "date": row["date"],
                "source": source,
            })

    return ok(result)


@router.get("/llm-status")
async def llm_status(_: str = Depends(verify_admin_token)):
    """LLM 配置状态"""
    from backend.llm import get_llm_status
    return ok(get_llm_status())
