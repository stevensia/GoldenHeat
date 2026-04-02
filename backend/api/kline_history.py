"""K线历史 API

GET /api/kline/history?symbol=000001.SS&months=120
返回月线 OHLCV + 动态计算 MA12/MA24
"""

import logging
from fastapi import APIRouter, Query
from backend.db.connection import fetchall

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/kline/history")
async def get_kline_history(
    symbol: str = Query(..., description="标的代码，如 000001.SS"),
    months: int = Query(120, description="返回最近多少个月数据", ge=1, le=240),
):
    """获取标的月线 K 线历史（含 MA12/MA24）

    MA12/MA24 在查询时动态计算，需多加载 24 条数据用于均线预热。

    Returns:
        [{date, open, high, low, close, volume, ma12, ma24}, ...]
    """
    try:
        # 多加载 24 条用于均线预热
        fetch_limit = months + 24
        rows = fetchall(
            """SELECT date, open, high, low, close, volume
               FROM monthly_kline
               WHERE symbol = ?
               ORDER BY date ASC""",
            (symbol,),
        )

        if not rows:
            return {"symbol": symbol, "months": months, "count": 0, "data": []}

        # 转为 list[dict]
        all_data = [
            {
                "date": r["date"],
                "open": r["open"],
                "high": r["high"],
                "low": r["low"],
                "close": r["close"],
                "volume": r["volume"],
            }
            for r in rows
        ]

        # 动态计算 MA12 / MA24
        closes = [d["close"] for d in all_data]
        for i, d in enumerate(all_data):
            # MA12
            if i >= 11 and all(c is not None for c in closes[i - 11:i + 1]):
                d["ma12"] = round(sum(closes[i - 11:i + 1]) / 12, 2)
            else:
                d["ma12"] = None

            # MA24
            if i >= 23 and all(c is not None for c in closes[i - 23:i + 1]):
                d["ma24"] = round(sum(closes[i - 23:i + 1]) / 24, 2)
            else:
                d["ma24"] = None

        # 只返回最近 months 条
        result_data = all_data[-months:] if len(all_data) > months else all_data

        return {"symbol": symbol, "months": months, "count": len(result_data), "data": result_data}

    except Exception as e:
        logger.error(f"K线历史查询失败: {e}")
        return {"error": str(e)}
