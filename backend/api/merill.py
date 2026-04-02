"""Merill Clock API — 美林时钟状态

GET /api/merill — 当前美林时钟阶段、置信度、推荐配置、预警
"""

import logging

from fastapi import APIRouter

from backend.engines.merill_clock import MerillClock
from backend.api.response import ok, error, server_error

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/merill")
async def get_merill_clock(market: str = "cn"):
    """美林时钟状态

    Args:
        market: 'cn' (中国) 或 'us' (美国)，默认 cn

    Returns:
        阶段判断 + 置信度 + GDP/CPI趋势 + PMI矫正 + 推荐配置 + 预警
    """
    if market not in ("cn", "us"):
        return error("INVALID_MARKET", f"Unknown market: {market}. Use 'cn' or 'us'.")

    try:
        clock = MerillClock()
        result = clock.judge_phase(market=market)
        return ok(result.to_dict())
    except Exception as e:
        logger.error(f"美林时钟判断失败 ({market}): {e}")
        return server_error(f"美林时钟判断失败: {e}")
