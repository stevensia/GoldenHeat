"""Admin Config API — 运行时配置管理

需要 Bearer token 认证。

- GET /api/v1/admin/config        — 获取所有配置
- GET /api/v1/admin/config/{key}  — 获取单个配置
- PUT /api/v1/admin/config/{key}  — 修改配置
"""

import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from backend.api.auth import verify_admin_token
from backend.api.response import ok, not_found
from backend.repos.config_repo import ConfigRepo

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/config")


class UpdateConfigBody(BaseModel):
    """修改配置请求体"""
    value: str = Field(..., description="配置值")
    type: str = Field(default="string", description="类型: string/int/float/bool/json")
    description: str = Field(default="", description="描述")


@router.get("")
async def list_config(_: str = Depends(verify_admin_token)):
    """获取所有配置"""
    repo = ConfigRepo()
    configs = repo.get_all()
    return ok({
        "count": len(configs),
        "configs": [c.to_dict() for c in configs],
    })


@router.get("/{key}")
async def get_config(key: str, _: str = Depends(verify_admin_token)):
    """获取单个配置"""
    repo = ConfigRepo()
    config = repo.get(key)
    if not config:
        return not_found(f"配置项 {key} 不存在")
    return ok(config.to_dict())


@router.put("/{key}")
async def update_config(
    key: str,
    body: UpdateConfigBody,
    _: str = Depends(verify_admin_token),
):
    """修改配置"""
    repo = ConfigRepo()
    repo.set(key, body.value, type=body.type, description=body.description)
    logger.info(f"⚙️ 配置更新: {key} = {body.value}")

    config = repo.get(key)
    return ok(config.to_dict())
