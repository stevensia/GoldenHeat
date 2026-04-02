"""Bull Bear API — 牛熊分割线

GET /api/bullbear — 各市场牛熊状态 + 仓位建议
"""

import logging

from fastapi import APIRouter

from backend.engines.bull_bear import BullBearJudge
from backend.engines.temperature import MarketTemperature

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/bullbear")
async def get_bull_bear():
    """各市场牛熊状态

    返回所有标的的牛熊阶段判断:
    - 四阶段: 牛市格局/牛市初期/熊市初期/熊市格局
    - 仓位建议: 0-20%/20-50%/50-80%/80-100%
    - 不暴露实际持仓金额
    """
    try:
        judge = BullBearJudge()
        results = judge.judge_all()

        # 市场温度
        temp_engine = MarketTemperature()
        market_avg = temp_engine.calc_market_avg()

        return {
            "count": len(results),
            "market_temperature": market_avg.to_dict() if market_avg else None,
            "markets": [r.to_dict() for r in results],
        }
    except Exception as e:
        logger.error(f"牛熊判断失败: {e}")
        return {"error": str(e)}
