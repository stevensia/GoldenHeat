"""GoldenHeat 配置"""

import os
from pathlib import Path

# 项目根目录
PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
DB_PATH = DATA_DIR / "goldenheat.db"

# LLM (copilot-proxy)
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:4399/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "claude-opus-4-5")

# 数据源
FRED_API_KEY = os.getenv("FRED_API_KEY", "")

# 关注标的
WATCHLIST = {
    # 港股
    "tencent":  {"code": "0700.HK", "name": "腾讯", "type": "stock", "market": "hk"},
    "alibaba":  {"code": "9988.HK", "name": "阿里巴巴", "type": "stock", "market": "hk"},
    # 美股
    "nvda":     {"code": "NVDA", "name": "英伟达", "type": "stock", "market": "us"},
    "tsla":     {"code": "TSLA", "name": "特斯拉", "type": "stock", "market": "us"},
    "msft":     {"code": "MSFT", "name": "微软", "type": "stock", "market": "us"},
    # 加密
    "btc":      {"code": "BTC-USD", "name": "比特币", "type": "crypto", "market": "crypto"},
    # 指数
    "sp500":    {"code": "^GSPC", "name": "标普500", "type": "index", "market": "us"},
    "sse":      {"code": "000001.SS", "name": "上证指数", "type": "index", "market": "cn"},
    "hsi":      {"code": "^HSI", "name": "恒生指数", "type": "index", "market": "hk"},
}

# 美林时钟参数
MERILL_CLOCK = {
    "gdp_trend_window": 4,   # 季度
    "cpi_trend_window": 6,   # 月
    "pmi_threshold": 50,
}

# 月线信号参数
MONTHLY_SIGNAL = {
    "ma_periods": [5, 10, 20],   # 月线均线
    "pe_low_percentile": 30,     # 低估阈值
    "pe_high_percentile": 70,    # 高估阈值
    "volume_change_threshold": 1.5,  # 放量阈值
}
