"""技术分析信号 API (v1)

GET /signal/technical?symbol=NVDA — 个股技术分析 9 指标 + 综合评分
"""

import logging
from fastapi import APIRouter, Query
from backend.engines.technical_analyzer import TechnicalAnalyzer
from backend.api.response import ok, error, server_error

logger = logging.getLogger(__name__)
router = APIRouter()

_analyzer = TechnicalAnalyzer()

# 合法标的 (从 monthly_kline 表中有数据的标的)
_VALID_SYMBOLS: set[str] | None = None


def _get_valid_symbols() -> set[str]:
    global _VALID_SYMBOLS
    if _VALID_SYMBOLS is None:
        from backend.db.connection import fetchall
        rows = fetchall("SELECT DISTINCT symbol FROM monthly_kline")
        _VALID_SYMBOLS = {r["symbol"] for r in rows}
    return _VALID_SYMBOLS


@router.get("/signal/technical")
async def get_technical_signal(
    symbol: str = Query(..., description="标的代码，如 NVDA"),
):
    """个股月线技术分析

    Returns:
        {symbol, name, price, trend, composite_score, composite_signal,
         indicators, key_levels, alerts}
    """
    valid = _get_valid_symbols()
    if symbol not in valid:
        return error(
            "INVALID_SYMBOL",
            f"标的 {symbol} 无数据。可用: {', '.join(sorted(valid))}",
        )

    try:
        result = _analyzer.analyze(symbol)
        if result is None:
            return error("INSUFFICIENT_DATA", f"标的 {symbol} 数据不足，无法计算技术指标")
        return ok(result)
    except Exception as e:
        logger.error(f"技术分析失败 [{symbol}]: {e}")
        return server_error(f"技术分析失败: {e}")
