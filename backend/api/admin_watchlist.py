"""Admin Watchlist API — 关注列表管理

需要 Bearer token 认证。

- GET    /api/v1/admin/watchlist            — 列出关注列表
- POST   /api/v1/admin/watchlist            — 添加标的
- DELETE /api/v1/admin/watchlist/{symbol}   — 删除标的
- PUT    /api/v1/admin/watchlist/{symbol}/toggle — 启用/禁用
"""

import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from backend.api.auth import verify_admin_token
from backend.api.response import ok, error, not_found
from backend.repos.watchlist_repo import WatchlistRepo
from backend.models.watchlist import WatchlistItem

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/watchlist")


class AddWatchlistBody(BaseModel):
    """添加关注标的请求体"""
    symbol: str = Field(..., description="标的代码，如 NVDA, 0700.HK")
    name: str = Field(..., description="中文名称")
    type: str = Field(default="stock", description="类型: stock/index/crypto")
    market: str = Field(default="us", description="市场: us/cn/hk/crypto")
    sector: str = Field(default="", description="板块")


@router.get("")
async def list_watchlist(
    enabled_only: bool = False,
    _: str = Depends(verify_admin_token),
):
    """列出关注列表"""
    repo = WatchlistRepo()
    items = repo.get_all(enabled_only=enabled_only)
    return ok({
        "count": len(items),
        "items": [item.to_dict() for item in items],
    })


@router.post("")
async def add_watchlist(
    body: AddWatchlistBody,
    _: str = Depends(verify_admin_token),
):
    """添加关注标的"""
    repo = WatchlistRepo()

    # 检查是否已存在
    existing = repo.get_by_symbol(body.symbol)
    if existing:
        return error("ALREADY_EXISTS", f"标的 {body.symbol} 已在关注列表中")

    item = WatchlistItem(
        symbol=body.symbol,
        name=body.name,
        type=body.type,
        market=body.market,
        sector=body.sector if body.sector else None,
    )
    repo.add(item)
    logger.info(f"✅ 添加关注: {body.symbol} ({body.name})")

    return ok(item.to_dict())


@router.delete("/{symbol}")
async def remove_watchlist(
    symbol: str,
    _: str = Depends(verify_admin_token),
):
    """删除关注标的"""
    repo = WatchlistRepo()

    if not repo.get_by_symbol(symbol):
        return not_found(f"标的 {symbol} 不在关注列表中")

    repo.remove(symbol)
    logger.info(f"🗑️ 移除关注: {symbol}")
    return ok({"removed": symbol})


@router.put("/{symbol}/toggle")
async def toggle_watchlist(
    symbol: str,
    _: str = Depends(verify_admin_token),
):
    """切换启用/禁用"""
    repo = WatchlistRepo()

    item = repo.get_by_symbol(symbol)
    if not item:
        return not_found(f"标的 {symbol} 不在关注列表中")

    repo.toggle(symbol)
    updated = repo.get_by_symbol(symbol)
    logger.info(f"🔄 切换关注: {symbol} → enabled={updated.enabled}")
    return ok(updated.to_dict())
