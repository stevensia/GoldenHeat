"""统一 API 响应格式

所有 API 使用统一封装:
- ok(data, meta)  → {"ok": True, "data": ..., "meta": {...}}
- error(code, msg) → {"ok": False, "error": {"code": ..., "message": ...}}
- with_freshness(data) → 自动附加数据新鲜度 meta

向后兼容: 原有 data 结构不变，只多了外层 ok/data/meta 包装。
"""

import logging
from typing import Any, Optional

from fastapi.responses import JSONResponse

from backend.repos.macro_repo import MacroRepo
from backend.repos.kline_repo import KlineRepo
from backend.repos.valuation_repo import ValuationRepo

logger = logging.getLogger(__name__)


def ok(data: Any, meta: Optional[dict] = None) -> dict:
    """成功响应"""
    resp = {"ok": True, "data": data}
    if meta:
        resp["meta"] = meta
    return resp


def error(code: str, message: str, status: int = 400) -> JSONResponse:
    """错误响应"""
    return JSONResponse(
        status_code=status,
        content={
            "ok": False,
            "error": {"code": code, "message": message},
        },
    )


def server_error(message: str, detail: str = "") -> JSONResponse:
    """500 错误响应"""
    logger.error(f"Server error: {message} | {detail}")
    return JSONResponse(
        status_code=500,
        content={
            "ok": False,
            "error": {"code": "INTERNAL_ERROR", "message": message},
        },
    )


def not_found(message: str = "Resource not found") -> JSONResponse:
    """404 响应"""
    return error("NOT_FOUND", message, status=404)


def with_freshness(data: Any) -> dict:
    """给响应自动附加数据新鲜度 meta

    扫描 macro_data / monthly_kline / valuation 表的最新日期，
    帮助前端判断数据是否过时。
    """
    freshness = {}
    try:
        macro_repo = MacroRepo()
        macro_fresh = macro_repo.get_freshness()
        if macro_fresh:
            freshness["macro"] = {
                r["indicator"]: r["latest_date"] for r in macro_fresh
            }
    except Exception:
        pass

    try:
        kline_repo = KlineRepo()
        kline_fresh = kline_repo.get_freshness()
        if kline_fresh:
            # 只取最新的几个
            dates = [r["latest_date"] for r in kline_fresh if r["latest_date"]]
            if dates:
                freshness["kline_latest"] = max(dates)
    except Exception:
        pass

    try:
        val_repo = ValuationRepo()
        val_fresh = val_repo.get_freshness()
        if val_fresh:
            dates = [r["latest_date"] for r in val_fresh if r["latest_date"]]
            if dates:
                freshness["valuation_latest"] = max(dates)
    except Exception:
        pass

    return ok(data, meta={"freshness": freshness})
