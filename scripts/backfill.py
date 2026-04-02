#!/usr/bin/env python3
"""历史数据一次性回填脚本

拉取所有标的 10 年月线 + 中美宏观数据，写入 SQLite
"""

import sys
import logging
from pathlib import Path

# 添加项目根目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from backend.db.connection import init_db
from backend.collectors.kline import KlineCollector
from backend.collectors.macro_cn import MacroCNCollector
from backend.collectors.macro_us import MacroUSCollector

# 日志配置
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


def main():
    """执行全量历史数据回填"""
    logger.info("=" * 60)
    logger.info("GoldenHeat 历史数据回填")
    logger.info("=" * 60)

    # 1. 初始化数据库
    logger.info("\n📋 步骤 1: 初始化数据库")
    init_db()

    # 2. 拉取月线K线数据
    logger.info("\n📊 步骤 2: 拉取月线K线数据（10年）")
    kline_collector = KlineCollector(years=10)
    kline_results = kline_collector.collect_all()
    logger.info(f"K线结果: {kline_results}")

    # 3. 拉取中国宏观数据
    logger.info("\n🇨🇳 步骤 3: 拉取中国宏观数据")
    cn_collector = MacroCNCollector()
    cn_results = cn_collector.collect_all()
    logger.info(f"中国宏观结果: {cn_results}")

    # 4. 拉取美国宏观数据
    logger.info("\n🇺🇸 步骤 4: 拉取美国宏观数据")
    us_collector = MacroUSCollector(years=10)
    us_results = us_collector.collect_all()
    logger.info(f"美国宏观结果: {us_results}")

    # 汇总
    logger.info("\n" + "=" * 60)
    logger.info("📋 回填汇总:")
    logger.info(f"  K线标的数: {len(kline_results)}, 总条数: {sum(kline_results.values())}")
    logger.info(f"  中国宏观指标: {len(cn_results)}, 总条数: {sum(cn_results.values())}")
    logger.info(f"  美国宏观指标: {len(us_results)}, 总条数: {sum(us_results.values())}")
    logger.info("=" * 60)
    logger.info("✅ 回填完成!")


if __name__ == "__main__":
    main()
