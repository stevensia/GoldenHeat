"""Dashboard API — 仪表盘聚合数据

GET /api/dashboard
返回: 美林时钟阶段 + 市场温度 + 所有标的信号摘要 + 牛熊状态
"""

import logging

from fastapi import APIRouter

from backend.engines.merill_clock import MerillClock
from backend.engines.monthly_signal import MonthlySignal
from backend.engines.bull_bear import BullBearJudge
from backend.engines.temperature import MarketTemperature

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/dashboard")
async def get_dashboard():
    """仪表盘聚合数据

    一次请求获取所有核心指标:
    - 美林时钟当前阶段
    - 市场温度（综合 + 各标的）
    - 所有标的月线信号摘要
    - 各市场牛熊状态
    """
    try:
        # 美林时钟
        clock = MerillClock()
        merill_cn = clock.judge_phase(market="cn")

        # 市场温度
        temp_engine = MarketTemperature()
        temps = temp_engine.calc_all()
        market_avg = temp_engine.calc_market_avg()

        # 月线信号
        signal_engine = MonthlySignal()
        signals = signal_engine.calc_all()

        # 牛熊分割线
        bb_judge = BullBearJudge()
        bull_bears = bb_judge.judge_all()

        return {
            "merill_clock": merill_cn.to_dict(),
            "market_temperature": {
                "average": market_avg.to_dict() if market_avg else None,
                "details": [t.to_dict() for t in temps],
            },
            "signals": [s.to_dict() for s in signals],
            "bull_bear": [b.to_dict() for b in bull_bears],
        }

    except Exception as e:
        logger.error(f"Dashboard 数据生成失败: {e}")
        return {"error": str(e)}
