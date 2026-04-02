"""估值数据回填脚本

回填 WATCHLIST 中所有标的 2016-01 ~ 2026-04 的月度 PE/PB，
并计算滚动百分位写入 valuation 表。

运行方式:
    cd /opt/GoldenHeat && python3 -m backend.scripts.backfill_valuation
"""

import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def main():
    logger.info("🚀 开始回填估值数据...")

    from backend.collectors.valuation import ValuationCollector
    from backend.db.connection import fetchone

    collector = ValuationCollector(years=10)
    results = collector.collect_all()

    # 打印结果
    logger.info("=" * 50)
    logger.info("回填结果:")
    for key, count in results.items():
        status = "✅" if count > 0 else "⚠️"
        logger.info(f"  {status} {key}: {count} 条")

    # 验证
    row = fetchone("SELECT count(*) as cnt, min(date) as min_date, max(date) as max_date FROM valuation")
    if row:
        logger.info(f"\n📊 valuation 表统计: {row['cnt']} 条, {row['min_date']} ~ {row['max_date']}")
    else:
        logger.warning("⚠️ valuation 表为空!")

    total = sum(results.values())
    if total > 0:
        logger.info(f"\n✅ 回填完成，共写入 {total} 条估值数据")
    else:
        logger.error("❌ 未写入任何数据，请检查数据源和网络")
        sys.exit(1)


if __name__ == "__main__":
    main()
