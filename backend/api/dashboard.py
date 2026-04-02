"""Dashboard API — 仪表盘聚合数据

GET /api/dashboard
返回: 美林时钟阶段 + 市场温度 + 所有标的信号摘要 + 牛熊状态
"""

import json
import logging

from fastapi import APIRouter

from backend.engines.merill_clock import MerillClock
from backend.engines.monthly_signal import MonthlySignal
from backend.engines.bull_bear import BullBearJudge
from backend.engines.temperature import MarketTemperature
from backend.db.connection import fetchall, fetchone

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_merill_data_sources(market: str = "cn") -> list[dict]:
    """获取美林时钟使用的宏观指标明细"""
    if market == "cn":
        indicators = [
            ("cn_gdp", "中国GDP增速", "国家统计局"),
            ("cn_cpi", "中国CPI", "国家统计局"),
            ("cn_pmi", "中国PMI", "国家统计局"),
            ("cn_m2", "中国M2增速", "中国人民银行"),
        ]
    else:
        indicators = [
            ("us_gdp", "美国GDP增速", "FRED"),
            ("us_cpi", "美国CPI", "FRED"),
        ]

    sources = []
    for code, name, source in indicators:
        row = fetchone(
            """SELECT date, value FROM macro_data
               WHERE indicator = ? ORDER BY date DESC LIMIT 1""",
            (code,),
        )
        if row:
            sources.append({
                "indicator": code,
                "name": name,
                "value": row["value"],
                "date": row["date"],
                "source": source,
            })

    return sources


def _get_merill_from_assessment(market: str) -> dict | None:
    """从 clock_assessments 表获取最新评估结果，转为前端所需格式"""
    from backend.engines.merill_clock import PHASE_ALLOCATION, Phase

    row = fetchone(
        """SELECT * FROM clock_assessments
           WHERE market = ? ORDER BY assessed_at DESC LIMIT 1""",
        (market,),
    )
    if not row:
        return None

    phase_str = row["final_phase"]
    try:
        phase_enum = Phase(phase_str)
    except ValueError:
        return None

    phase_info = PHASE_ALLOCATION[phase_enum]

    # 解析 algo_details
    algo_details = {}
    if row["algo_details"]:
        try:
            algo_details = json.loads(row["algo_details"])
        except json.JSONDecodeError:
            pass

    return {
        "phase": phase_str,
        "phase_label": phase_info["label"],
        "confidence": round(row["final_confidence"], 3),
        "gdp_trend": algo_details.get("gdp_trend", "down" if phase_str in ("stagflation","recession") else "up"),
        "cpi_trend": algo_details.get("cpi_trend", "up" if phase_str in ("overheat","stagflation") else "down"),
        "gdp_slope": algo_details.get("gdp_slope", 0),
        "cpi_slope": algo_details.get("cpi_slope", 0),
        "pmi_value": algo_details.get("pmi_value"),
        "pmi_confirm": algo_details.get("pmi_confirm"),
        "m2_growth": algo_details.get("m2_growth"),
        "gdp_growth": algo_details.get("gdp_growth"),
        "credit_signal": algo_details.get("credit_signal"),
        "transition_warning": algo_details.get("transition_warning"),
        "best_asset": phase_info["best_asset"],
        "allocation": phase_info["allocation"],
        "description": phase_info["description"],
        "position": round(row["final_position"], 1),
        "source": "weighted",
    }


def _get_pe_percentile(symbol: str) -> float | None:
    """获取标的最新 PE 百分位"""
    row = fetchone(
        """SELECT pe_percentile FROM valuation
           WHERE symbol = ? AND pe_percentile IS NOT NULL
           ORDER BY date DESC LIMIT 1""",
        (symbol,),
    )
    if row and row["pe_percentile"] is not None:
        return round(float(row["pe_percentile"]), 1)
    return None


def _get_prev_signal_score(symbol: str) -> float | None:
    """获取标的上月信号得分（从 signals 表获取，若无则返回 None）"""
    # 先从 signals 表找最近两条该标的的 monthly 信号
    rows = fetchall(
        """SELECT signal_value FROM signals
           WHERE symbol = ? AND signal_type = 'monthly_signal'
           ORDER BY date DESC LIMIT 2""",
        (symbol,),
    )
    if rows and len(rows) >= 2:
        import json
        try:
            prev = json.loads(rows[1]["signal_value"])
            return prev.get("score")
        except Exception:
            pass
    return None


@router.get("/dashboard")
async def get_dashboard():
    """仪表盘聚合数据

    一次请求获取所有核心指标:
    - 美林时钟当前阶段 + data_sources
    - 市场温度（综合 + 各标的 + pe_percentile）
    - 所有标的月线信号摘要 + prev_score
    - 各市场牛熊状态
    """
    try:
        # 美林时钟 — 优先从 clock_assessments 获取（三方加权结果）
        merill_dict = _get_merill_from_assessment("cn")
        if merill_dict is None:
            # 降级：无评估记录时走原有算法
            clock = MerillClock()
            merill_cn = clock.judge_phase(market="cn")
            merill_dict = merill_cn.to_dict()
            merill_dict["source"] = "algo"
            # 补充 position 字段（算法模式也提供）
            from backend.engines.merill_clock import calc_position, Phase
            merill_dict["position"] = calc_position(
                Phase(merill_dict["phase"]),
                merill_dict["confidence"],
                merill_dict["gdp_slope"],
                merill_dict["cpi_slope"],
            )
        merill_dict["data_sources"] = _get_merill_data_sources("cn")

        # 市场温度
        temp_engine = MarketTemperature()
        temps = temp_engine.calc_all()
        market_avg = temp_engine.calc_market_avg()

        # 为每个标的添加 pe_percentile
        temp_details = []
        for t in temps:
            d = t.to_dict()
            d["pe_percentile"] = _get_pe_percentile(t.symbol)
            temp_details.append(d)

        # 月线信号
        signal_engine = MonthlySignal()
        signals = signal_engine.calc_all()

        # 为每个信号添加 prev_score
        signal_list = []
        for s in signals:
            d = s.to_dict()
            d["prev_score"] = _get_prev_signal_score(s.symbol)
            signal_list.append(d)

        # 牛熊分割线
        bb_judge = BullBearJudge()
        bull_bears = bb_judge.judge_all()

        return {
            "merill_clock": merill_dict,
            "market_temperature": {
                "average": market_avg.to_dict() if market_avg else None,
                "details": temp_details,
            },
            "signals": signal_list,
            "bull_bear": [b.to_dict() for b in bull_bears],
        }

    except Exception as e:
        logger.error(f"Dashboard 数据生成失败: {e}")
        return {"error": str(e)}
