"""Signals API — 标的月线信号

GET /api/signals — 所有标的信号列表
GET /api/signals/{symbol_key} — 单个标的详情
"""

import logging

from fastapi import APIRouter, HTTPException

from backend.config import WATCHLIST
from backend.engines.monthly_signal import MonthlySignal
from backend.api.response import ok, server_error, not_found

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/signals")
async def get_all_signals():
    """所有标的月线信号列表

    返回按评分降序排列的信号列表:
    - 评分、级别、趋势、回调位置
    - 不暴露实际持仓金额/数量
    """
    try:
        engine = MonthlySignal()
        results = engine.calc_all()
        return ok({
            "count": len(results),
            "signals": [r.to_dict() for r in results],
        })
    except Exception as e:
        logger.error(f"信号计算失败: {e}")
        return server_error(f"信号计算失败: {e}")


@router.get("/signals/{symbol_key}")
async def get_signal_detail(symbol_key: str):
    """单个标的月线信号详情

    Args:
        symbol_key: WATCHLIST 中的键名 (如 'nvda', 'btc', 'tencent')
    """
    if symbol_key not in WATCHLIST:
        return not_found(
            f"Unknown symbol key: {symbol_key}. Available: {list(WATCHLIST.keys())}"
        )

    try:
        engine = MonthlySignal()
        info = WATCHLIST[symbol_key]
        result = engine.calc_signal(symbol_key, info)
        return ok(result.to_dict())
    except Exception as e:
        logger.error(f"信号计算失败 ({symbol_key}): {e}")
        return server_error(f"信号计算失败: {e}")
