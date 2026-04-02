"""GoldenHeat FastAPI 入口

- CORS 白名单
- Rate Limiting (自定义 middleware)
- Bearer Token 认证 (写入接口)
- 路由挂载: /api/ (旧兼容) + /api/v1/ (新)
"""

import time
import logging
from collections import defaultdict
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.config import CORS_ORIGINS, RATE_LIMIT_READ, RATE_LIMIT_WRITE
from backend.db.connection import init_db

# 路由模块 — 现有 API
from backend.api.dashboard import router as dashboard_router
from backend.api.signals import router as signals_router
from backend.api.merill import router as merill_router
from backend.api.bullbear import router as bullbear_router
from backend.api.admin import router as admin_router
from backend.api.admin_clock import router as admin_clock_router
from backend.api.valuation import router as valuation_router
from backend.api.kline_history import router as kline_history_router
from backend.api.macro import router as macro_router
from backend.api.clock_public import router as clock_public_router
from backend.api.auth_routes import router as auth_router

# V2.5 新增路由
from backend.api.admin_watchlist import router as admin_watchlist_router
from backend.api.admin_config import router as admin_config_router
from backend.api.data_health import router as data_health_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# 创建 FastAPI 应用
app = FastAPI(
    title="GoldenHeat API",
    description="AI 中长周期投资决策系统",
    version="2.5.0",
)

# ===== CORS 配置 =====
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


# ===== Rate Limiting Middleware =====
# 简单的内存 rate limiter（按 IP 滑动窗口）
_rate_store: dict[str, list[float]] = defaultdict(list)
_WINDOW = 60  # 60 秒窗口


def _check_rate_limit(client_ip: str, limit: int) -> bool:
    """检查 IP 是否超过速率限制"""
    now = time.time()
    timestamps = _rate_store[client_ip]

    # 清理过期记录
    _rate_store[client_ip] = [t for t in timestamps if now - t < _WINDOW]

    if len(_rate_store[client_ip]) >= limit:
        return False

    _rate_store[client_ip].append(now)
    return True


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """Rate Limiting 中间件

    - GET 请求: RATE_LIMIT_READ req/min per IP
    - POST/PUT/DELETE 请求: RATE_LIMIT_WRITE req/min per IP
    """
    client_ip = request.client.host if request.client else "unknown"

    if request.method in ("POST", "PUT", "DELETE"):
        limit = RATE_LIMIT_WRITE
    else:
        limit = RATE_LIMIT_READ

    if not _check_rate_limit(client_ip, limit):
        return JSONResponse(
            status_code=429,
            content={"detail": f"Rate limit exceeded: {limit} requests per minute"},
        )

    response = await call_next(request)
    return response


# ===== 路由挂载 — /api/ (旧兼容) =====
app.include_router(dashboard_router, prefix="/api", tags=["Dashboard"])
app.include_router(signals_router, prefix="/api", tags=["Signals"])
app.include_router(merill_router, prefix="/api", tags=["Merill Clock"])
app.include_router(bullbear_router, prefix="/api", tags=["Bull Bear"])
app.include_router(admin_router, prefix="/api", tags=["Admin"])
app.include_router(admin_clock_router, prefix="/api", tags=["Admin Clock"])
app.include_router(valuation_router, prefix="/api", tags=["Valuation"])
app.include_router(kline_history_router, prefix="/api", tags=["K-Line"])
app.include_router(macro_router, prefix="/api", tags=["Macro"])
app.include_router(clock_public_router, prefix="/api", tags=["Clock Public"])
app.include_router(auth_router, prefix="/api", tags=["Auth"])

# ===== 路由挂载 — /api/v1/ (新) =====
# 复制现有路由到 v1 前缀（向后兼容）
app.include_router(dashboard_router, prefix="/api/v1", tags=["V1 Dashboard"])
app.include_router(signals_router, prefix="/api/v1", tags=["V1 Signals"])
app.include_router(merill_router, prefix="/api/v1", tags=["V1 Merill Clock"])
app.include_router(bullbear_router, prefix="/api/v1", tags=["V1 Bull Bear"])
app.include_router(admin_router, prefix="/api/v1", tags=["V1 Admin"])
app.include_router(admin_clock_router, prefix="/api/v1", tags=["V1 Admin Clock"])
app.include_router(valuation_router, prefix="/api/v1", tags=["V1 Valuation"])
app.include_router(kline_history_router, prefix="/api/v1", tags=["V1 K-Line"])
app.include_router(macro_router, prefix="/api/v1", tags=["V1 Macro"])
app.include_router(clock_public_router, prefix="/api/v1", tags=["V1 Clock Public"])
app.include_router(auth_router, prefix="/api/v1", tags=["V1 Auth"])

# V2.5 新增 API（仅 /api/v1/ 前缀）
app.include_router(admin_watchlist_router, prefix="/api/v1", tags=["V1 Watchlist"])
app.include_router(admin_config_router, prefix="/api/v1", tags=["V1 Config"])
app.include_router(data_health_router, prefix="/api/v1", tags=["V1 Health"])


@app.on_event("startup")
async def startup():
    """启动时初始化数据库 + 运行迁移"""
    init_db()
    logger.info("🚀 GoldenHeat API v2.5 启动完成")


@app.get("/api/health")
async def health():
    """健康检查"""
    from backend.api.response import ok
    return ok({"status": "ok", "service": "GoldenHeat", "version": "2.5.0"})
