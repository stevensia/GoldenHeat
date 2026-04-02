"""Data Health API — 数据新鲜度检查

GET /api/v1/health/data — 所有数据源的新鲜度
"""

import logging

from fastapi import APIRouter

from backend.api.response import ok, server_error
from backend.repos.macro_repo import MacroRepo
from backend.repos.kline_repo import KlineRepo
from backend.repos.valuation_repo import ValuationRepo

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/health")


@router.get("/data")
async def data_health():
    """所有数据源的新鲜度报告

    返回每类数据（宏观/K线/估值）的:
    - 最新日期
    - 数据条数
    - 上次采集时间
    """
    try:
        result = {}

        # 宏观数据新鲜度
        macro_repo = MacroRepo()
        macro_fresh = macro_repo.get_freshness()
        result["macro"] = {
            "count": len(macro_fresh),
            "indicators": [
                {
                    "indicator": r["indicator"],
                    "latest_date": r["latest_date"],
                    "count": r["count"],
                    "last_fetched": r.get("last_fetched"),
                }
                for r in macro_fresh
            ],
        }

        # K线数据新鲜度
        kline_repo = KlineRepo()
        kline_fresh = kline_repo.get_freshness()
        result["kline"] = {
            "count": len(kline_fresh),
            "symbols": [
                {
                    "symbol": r["symbol"],
                    "latest_date": r["latest_date"],
                    "count": r["count"],
                }
                for r in kline_fresh
            ],
        }

        # 估值数据新鲜度
        val_repo = ValuationRepo()
        val_fresh = val_repo.get_freshness()
        result["valuation"] = {
            "count": len(val_fresh),
            "symbols": [
                {
                    "symbol": r["symbol"],
                    "latest_date": r["latest_date"],
                    "count": r["count"],
                }
                for r in val_fresh
            ],
        }

        return ok(result)

    except Exception as e:
        logger.error(f"数据健康检查失败: {e}")
        return server_error(f"数据健康检查失败: {e}")
