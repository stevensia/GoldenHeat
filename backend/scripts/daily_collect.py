"""每日数据采集脚本

每天运行一次，按顺序执行:
1. 中国宏观数据 (akshare)
2. 美国宏观数据 (FRED)
3. K线月线数据 (yfinance)
4. 估值数据 (yfinance)
5. 触发时钟评估 (算法+AI)

用法:
  python3 -m backend.scripts.daily_collect
  
或 cron:
  0 8 * * * cd /opt/GoldenHeat && python3 -m backend.scripts.daily_collect >> /opt/GoldenHeat/logs/daily.log 2>&1
"""

import asyncio
import logging
import sys
import time
from datetime import datetime
from pathlib import Path

# 确保项目根目录在 path 中
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from backend.db.connection import init_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger("daily_collect")


def collect_macro_cn() -> dict:
    """采集中国宏观数据"""
    logger.info("🇨🇳 开始采集中国宏观数据...")
    try:
        from backend.collectors.macro_cn import MacroCNCollector
        collector = MacroCNCollector()
        result = collector.collect_all()
        logger.info(f"🇨🇳 中国宏观采集完成: {result}")
        return {"status": "ok", "result": result}
    except Exception as e:
        logger.error(f"🇨🇳 中国宏观采集失败: {e}")
        return {"status": "error", "error": str(e)}


def collect_macro_us() -> dict:
    """采集美国宏观数据"""
    logger.info("🇺🇸 开始采集美国宏观数据...")
    try:
        from backend.collectors.macro_us import MacroUSCollector
        collector = MacroUSCollector()
        result = collector.collect_all()
        logger.info(f"🇺🇸 美国宏观采集完成: {result}")
        return {"status": "ok", "result": result}
    except Exception as e:
        logger.error(f"🇺🇸 美国宏观采集失败: {e}")
        return {"status": "error", "error": str(e)}


def collect_kline() -> dict:
    """采集K线数据"""
    logger.info("📈 开始采集K线数据...")
    try:
        from backend.collectors.kline import KlineCollector
        collector = KlineCollector()
        result = collector.collect_all()
        logger.info(f"📈 K线采集完成: {result}")
        return {"status": "ok", "result": result}
    except Exception as e:
        logger.error(f"📈 K线采集失败: {e}")
        return {"status": "error", "error": str(e)}


def collect_valuation() -> dict:
    """采集估值数据"""
    logger.info("💰 开始采集估值数据...")
    try:
        from backend.collectors.valuation import ValuationCollector
        collector = ValuationCollector()
        result = collector.collect_all()
        logger.info(f"💰 估值采集完成: {result}")
        return {"status": "ok", "result": result}
    except Exception as e:
        logger.error(f"💰 估值采集失败: {e}")
        return {"status": "error", "error": str(e)}


async def run_assessment() -> dict:
    """触发时钟评估"""
    logger.info("🕐 触发时钟评估...")
    try:
        from backend.engines.clock_assessor import ClockAssessor
        assessor = ClockAssessor()
        
        results = {}
        for market in ("cn", "us"):
            result = await assessor.run_assessment(market=market, trigger_type="daily_auto")
            results[market] = {
                "phase": result.get("final_phase"),
                "position": result.get("final_position"),
                "confidence": result.get("final_confidence"),
            }
            logger.info(f"🕐 {market}: {result.get('final_phase')} pos={result.get('final_position')}")
        
        return {"status": "ok", "assessments": results}
    except Exception as e:
        logger.error(f"🕐 时钟评估失败: {e}")
        return {"status": "error", "error": str(e)}


async def main():
    start = time.time()
    logger.info(f"{'='*60}")
    logger.info(f"🚀 GoldenHeat 每日数据采集 — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"{'='*60}")
    
    # 初始化数据库
    init_db()
    
    report = {}
    
    # 1. 宏观数据
    report["macro_cn"] = collect_macro_cn()
    report["macro_us"] = collect_macro_us()
    
    # 2. 行情数据
    report["kline"] = collect_kline()
    report["valuation"] = collect_valuation()
    
    # 3. 时钟评估
    report["assessment"] = await run_assessment()
    
    # 汇总
    elapsed = time.time() - start
    ok = sum(1 for v in report.values() if v.get("status") == "ok")
    fail = sum(1 for v in report.values() if v.get("status") == "error")
    
    logger.info(f"{'='*60}")
    logger.info(f"✅ 采集完成 — 成功: {ok}, 失败: {fail}, 耗时: {elapsed:.1f}s")
    for task, result in report.items():
        status = "✅" if result.get("status") == "ok" else "❌"
        logger.info(f"  {status} {task}: {result.get('status')}")
    logger.info(f"{'='*60}")
    
    return report


if __name__ == "__main__":
    asyncio.run(main())
