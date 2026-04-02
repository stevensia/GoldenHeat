"""宏观数据明细 API

GET /api/macro/details
返回所有宏观指标的最新值、日期、数据源和趋势
"""

import logging
from fastapi import APIRouter
from backend.db.connection import fetchall

logger = logging.getLogger(__name__)
router = APIRouter()

# 指标元数据: indicator_code → (中文名, 数据源)
INDICATOR_META = {
    "cn_gdp":      ("中国GDP增速", "国家统计局"),
    "cn_cpi":      ("中国CPI", "国家统计局"),
    "cn_ppi":      ("中国PPI", "国家统计局"),
    "cn_pmi":      ("中国PMI", "国家统计局"),
    "cn_m2":       ("中国M2增速", "中国人民银行"),
    "cn_lpr":      ("中国LPR", "中国人民银行"),
    "us_gdp":      ("美国GDP增速", "FRED"),
    "us_cpi":      ("美国CPI", "FRED"),
    "us_fed_rate": ("美国联邦基金利率", "FRED"),
    "us_payroll":  ("美国非农就业", "FRED"),
}


def _calc_trend(indicator: str) -> str | None:
    """计算指标近期趋势: up / down / flat"""
    rows = fetchall(
        """SELECT value FROM macro_data
           WHERE indicator = ?
           ORDER BY date DESC LIMIT 3""",
        (indicator,),
    )
    if not rows or len(rows) < 2:
        return None

    values = [r["value"] for r in rows if r["value"] is not None]
    if len(values) < 2:
        return None

    # 最近两个值比较
    if values[0] > values[1] * 1.005:
        return "up"
    elif values[0] < values[1] * 0.995:
        return "down"
    else:
        return "flat"


@router.get("/macro/details")
async def get_macro_details():
    """获取所有宏观指标明细

    Returns:
        {indicators: [{name, value, date, source, trend, indicator}, ...]}
    """
    try:
        indicators = []

        for code, (name, source) in INDICATOR_META.items():
            # 获取最新值
            rows = fetchall(
                """SELECT date, value FROM macro_data
                   WHERE indicator = ?
                   ORDER BY date DESC LIMIT 1""",
                (code,),
            )

            if not rows:
                continue

            row = rows[0]
            trend = _calc_trend(code)

            indicators.append({
                "indicator": code,
                "name": name,
                "value": round(row["value"], 2) if row["value"] is not None else None,
                "date": row["date"],
                "source": source,
                "trend": trend,
            })

        return {"indicators": indicators}

    except Exception as e:
        logger.error(f"宏观数据查询失败: {e}")
        return {"error": str(e)}
