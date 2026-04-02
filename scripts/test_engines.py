#!/usr/bin/env python3
"""美林时钟历史验证脚本

用 backfill 的历史数据跑美林时钟 2020-2025:
- 按季度输出：日期 → 阶段判断 → 置信度 → 推荐配置
- 与实际市场表现对比，输出合理性分析
"""

import sys
import logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from backend.db.connection import fetchall
from backend.engines.merill_clock import MerillClock, PHASE_ALLOCATION

logging.basicConfig(
    level=logging.WARNING,  # 只显示警告以上，避免引擎日志干扰输出
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


# 实际市场重大事件参考（用于合理性对比）
MARKET_EVENTS = {
    "2020-03": "COVID-19 全球爆发，美股熔断，全球衰退",
    "2020-06": "各国大规模财政+货币刺激，经济触底反弹",
    "2020-09": "复苏持续，科技股领涨",
    "2020-12": "疫苗上市，复苏预期强化",
    "2021-03": "经济强劲复苏，通胀开始抬头",
    "2021-06": "通胀加速（美国CPI>5%），商品暴涨",
    "2021-09": "通胀持续高企，Taper预期",
    "2021-12": "Omicron 变异株，但经济韧性强",
    "2022-03": "俄乌战争，油价暴涨，滞胀担忧",
    "2022-06": "美联储激进加息75bp，全球紧缩",
    "2022-09": "持续加息，科技股暴跌，强美元",
    "2022-12": "加息放缓预期，中国放开防疫",
    "2023-03": "硅谷银行危机，中国复苏不及预期",
    "2023-06": "AI 热潮（NVDA），美国经济韧性超预期",
    "2023-09": "Higher for longer，美债收益率飙升",
    "2023-12": "降息预期升温，年末大涨",
    "2024-03": "AI 持续催化，日股新高，中国房地产困境",
    "2024-06": "全球通胀回落，降息预期",
    "2024-09": "美联储首次降息50bp",
    "2024-12": "Trump当选，政策不确定性",
    "2025-03": "中国刺激政策加码，港股反弹",
    "2025-06": "全球经济分化，AI投资持续",
}

# 各阶段对应的"理想"市场表现（用于合理性评分）
PHASE_EXPECTATIONS = {
    "recovery": "股票上涨、债券收益率上升、经济数据改善",
    "overheat": "商品上涨、通胀高企、央行收紧",
    "stagflation": "股市承压、商品高位、经济放缓",
    "recession": "债券上涨、股市下跌、央行宽松",
}


def get_sp500_performance() -> dict:
    """获取标普500按季度收益率，用于对比"""
    rows = fetchall(
        """SELECT date, close FROM monthly_kline
           WHERE symbol = '^GSPC'
           ORDER BY date ASC"""
    )
    if not rows:
        return {}

    # 按季度取最后一个月的收盘价
    quarterly = {}
    for row in rows:
        date = row["date"]
        year_month = date[:7]
        month = int(year_month.split("-")[1])
        # 季度末月份: 3, 6, 9, 12
        if month in (3, 6, 9, 12):
            quarterly[year_month] = row["close"]

    # 计算季度收益率
    dates = sorted(quarterly.keys())
    returns = {}
    for i in range(1, len(dates)):
        prev = quarterly[dates[i - 1]]
        curr = quarterly[dates[i]]
        if prev and prev > 0:
            returns[dates[i]] = round((curr - prev) / prev * 100, 2)

    return returns


def get_sse_performance() -> dict:
    """获取上证指数按季度收益率"""
    rows = fetchall(
        """SELECT date, close FROM monthly_kline
           WHERE symbol = '000001.SS'
           ORDER BY date ASC"""
    )
    if not rows:
        return {}

    quarterly = {}
    for row in rows:
        date = row["date"]
        year_month = date[:7]
        month = int(year_month.split("-")[1])
        if month in (3, 6, 9, 12):
            quarterly[year_month] = row["close"]

    dates = sorted(quarterly.keys())
    returns = {}
    for i in range(1, len(dates)):
        prev = quarterly[dates[i - 1]]
        curr = quarterly[dates[i]]
        if prev and prev > 0:
            returns[dates[i]] = round((curr - prev) / prev * 100, 2)

    return returns


def main():
    """运行历史验证"""
    print("=" * 80)
    print("🕐 GoldenHeat 美林时钟历史验证 (2020-2025)")
    print("=" * 80)

    clock = MerillClock()

    # 按季度跑历史判断
    results = clock.judge_phase_historical(
        market="cn",
        start="2020-01",
        end="2025-12",
        freq="QE",  # 季度末
    )

    if not results:
        print("❌ 无法生成历史判断，请先运行 backfill.py 回填数据")
        return

    # 获取市场表现对比数据
    sp500_returns = get_sp500_performance()
    sse_returns = get_sse_performance()

    # 阶段符号映射
    phase_emoji = {
        "recovery": "🟢",
        "overheat": "🔴",
        "stagflation": "🟡",
        "recession": "⚫",
    }

    print(f"\n{'日期':<10} {'阶段':<12} {'置信度':>6} {'GDP':>8} {'CPI':>8} "
          f"{'PMI':>6} {'SP500':>8} {'上证':>8} 市场事件")
    print("-" * 110)

    # 统计
    phase_counts = {}
    phase_transitions = []
    prev_phase = None

    for r in results:
        as_of = r["as_of"]
        phase = r["phase"]
        emoji = phase_emoji.get(phase, "?")
        label = r["phase_label"]
        confidence = r["confidence"]
        gdp_trend = r["gdp_trend"]
        cpi_trend = r["cpi_trend"]
        pmi = r.get("pmi_value")

        # 市场收益率
        sp500_ret = sp500_returns.get(as_of, None)
        sse_ret = sse_returns.get(as_of, None)
        sp500_str = f"{sp500_ret:>+7.1f}%" if sp500_ret is not None else "    N/A"
        sse_str = f"{sse_ret:>+7.1f}%" if sse_ret is not None else "    N/A"

        # 市场事件
        event = MARKET_EVENTS.get(as_of, "")

        # PMI 字符串
        pmi_str = f"{pmi:5.1f}" if pmi is not None else "  N/A"

        print(f"{as_of:<10} {emoji} {label:<8} {confidence:>5.2f} "
              f"  GDP{gdp_trend[0].upper():>2} CPI{cpi_trend[0].upper():>2} "
              f"{pmi_str} {sp500_str} {sse_str}  {event}")

        # 统计
        phase_counts[phase] = phase_counts.get(phase, 0) + 1

        if prev_phase and prev_phase != phase:
            phase_transitions.append((as_of, prev_phase, phase))
        prev_phase = phase

        # 转换预警
        if r.get("transition_warning"):
            print(f"           ⚠️  预警: {r['transition_warning']}")

    # 汇总分析
    print("\n" + "=" * 80)
    print("📊 汇总分析")
    print("=" * 80)

    print("\n阶段分布:")
    total = sum(phase_counts.values())
    for phase, count in sorted(phase_counts.items()):
        pct = count / total * 100
        info = PHASE_ALLOCATION.get(
            next(p for p in PHASE_ALLOCATION if p.value == phase), {}
        )
        label = info.get("label", phase) if info else phase
        print(f"  {phase_emoji.get(phase, '?')} {label}: {count} 个季度 ({pct:.0f}%)")

    print(f"\n阶段转换 ({len(phase_transitions)} 次):")
    for date, from_phase, to_phase in phase_transitions:
        from_label = next((v["label"] for k, v in PHASE_ALLOCATION.items() if k.value == from_phase), from_phase)
        to_label = next((v["label"] for k, v in PHASE_ALLOCATION.items() if k.value == to_phase), to_phase)
        print(f"  {date}: {from_label} → {to_label}")

    # 合理性评估
    print("\n" + "=" * 80)
    print("🔍 合理性评估")
    print("=" * 80)
    print("""
基于中国宏观数据的美林时钟判断需注意:
1. 中国经济周期与经典美林时钟有差异（政策驱动强于市场自发调节）
2. GDP 数据季度更新，存在 1-3 个月滞后
3. CPI/PMI 月度更新，但 akshare 数据发布有延迟
4. 建议结合美国市场数据（FRED）做对比验证

关键时间点对比:
- 2020 Q1-Q2: 应为衰退/复苏期（COVID + 大规模刺激）
- 2021: 应为过热期（通胀飙升、商品暴涨）
- 2022: 应为滞胀→衰退期（加息、经济放缓）
- 2023: 应为衰退→复苏期（通胀回落、降息预期）
- 2024-2025: 复苏期（全球降息周期开始）
""")

    print("✅ 历史验证完成!")


if __name__ == "__main__":
    main()
