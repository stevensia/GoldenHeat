"""估值历史 API

GET /api/valuation/history?symbol=000001.SS&months=120
返回指定标的的估值百分位历史
"""

import logging
from fastapi import APIRouter, Query
from backend.db.connection import fetchall
from backend.api.response import ok, server_error

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/valuation/history")
async def get_valuation_history(
    symbol: str = Query(..., description="标的代码，如 000001.SS"),
    months: int = Query(120, description="返回最近多少个月数据", ge=1, le=240),
):
    """获取标的估值百分位历史

    Returns:
        [{date, pe_ttm, pb, pe_percentile, pb_percentile}, ...]
    """
    try:
        rows = fetchall(
            """SELECT date, pe_ttm, pb, pe_percentile, pb_percentile
               FROM valuation
               WHERE symbol = ?
               ORDER BY date DESC
               LIMIT ?""",
            (symbol, months),
        )

        # 转为 list[dict]，按日期升序返回
        data = [
            {
                "date": r["date"],
                "pe_ttm": round(r["pe_ttm"], 2) if r["pe_ttm"] is not None else None,
                "pb": round(r["pb"], 2) if r["pb"] is not None else None,
                "pe_percentile": round(r["pe_percentile"], 1) if r["pe_percentile"] is not None else None,
                "pb_percentile": round(r["pb_percentile"], 1) if r["pb_percentile"] is not None else None,
            }
            for r in rows
        ]
        data.reverse()  # 升序

        return ok({"symbol": symbol, "months": months, "count": len(data), "data": data})

    except Exception as e:
        logger.error(f"估值历史查询失败: {e}")
        return server_error(f"估值历史查询失败: {e}")
