"""Admin API — 管理接口（需 Bearer Token）

POST /api/refresh — 手动刷新数据
"""

import logging

from fastapi import APIRouter, Depends

from backend.api.auth import verify_admin_token
from backend.collectors.kline import KlineCollector
from backend.collectors.macro_cn import MacroCNCollector
from backend.collectors.macro_us import MacroUSCollector

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/refresh")
async def refresh_data(token: str = Depends(verify_admin_token)):
    """手动刷新数据（Bearer Token 保护）

    触发所有数据采集器重新拉取最新数据。
    需要 Authorization: Bearer <ADMIN_API_TOKEN> header。
    """
    logger.info("🔄 手动刷新数据开始...")

    results = {}

    try:
        # 刷新K线
        kline = KlineCollector(years=1)  # 只拉最近1年
        results["kline"] = kline.collect_all()
    except Exception as e:
        logger.error(f"K线刷新失败: {e}")
        results["kline"] = {"error": str(e)}

    try:
        # 刷新中国宏观
        macro_cn = MacroCNCollector()
        results["macro_cn"] = macro_cn.collect_all()
    except Exception as e:
        logger.error(f"中国宏观刷新失败: {e}")
        results["macro_cn"] = {"error": str(e)}

    try:
        # 刷新美国宏观
        macro_us = MacroUSCollector(years=1)
        results["macro_us"] = macro_us.collect_all()
    except Exception as e:
        logger.error(f"美国宏观刷新失败: {e}")
        results["macro_us"] = {"error": str(e)}

    logger.info("✅ 手动刷新完成")
    return {"status": "ok", "results": results}
