"""估值百分位 API (v1)

GET /valuation/overview — 所有指数估值总览
GET /valuation/pe-history?symbol=000300.SS&months=120 — PE 历史
"""

import logging
from fastapi import APIRouter, Query
from backend.engines.percentile_analyzer import PercentileAnalyzer
from backend.api.response import ok, server_error

logger = logging.getLogger(__name__)
router = APIRouter()

_analyzer = PercentileAnalyzer()


@router.get("/valuation/overview")
async def valuation_overview():
    """估值总览 — 所有指数 PE 百分位

    Returns:
        [{symbol, name, pe_ttm, pe_pct_5y, pe_pct_10y, zone, zone_color, latest_date, ...}]
    """
    try:
        data = _analyzer.get_overview()
        return ok(data)
    except Exception as e:
        logger.error(f"估值总览查询失败: {e}")
        return server_error(f"估值总览查询失败: {e}")


@router.get("/valuation/pe-history")
async def valuation_pe_history(
    symbol: str = Query(..., description="指数代码，如 000300.SS"),
    months: int = Query(120, description="返回最近多少个月数据", ge=1, le=240),
):
    """PE 历史时间序列

    Returns:
        [{date, pe_ttm, pe_static, pe_median, index_value}]
    """
    try:
        data = _analyzer.get_pe_history(symbol, months)
        return ok(data, meta={"symbol": symbol, "months": months, "count": len(data)})
    except Exception as e:
        logger.error(f"PE 历史查询失败 [{symbol}]: {e}")
        return server_error(f"PE 历史查询失败: {e}")
