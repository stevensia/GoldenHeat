"""认证路由

- POST /api/auth/login — 本地密码登录
- GET  /api/auth/me — 获取当前用户信息
- GET  /api/auth/oauth/authorize — 获取 OAuth 授权 URL
- POST /api/auth/oauth/callback — OAuth 回调换 JWT
"""

import logging

from fastapi import APIRouter, Depends

from backend.api.auth import (
    LoginRequest,
    LoginResponse,
    TokenPayload,
    authenticate_local,
    authenticate_oauth,
    get_current_user,
    get_oauth_authorize_url,
    OAuthCallbackRequest,
    OAUTH_ENABLED,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest):
    """本地密码登录 → JWT
    
    ```
    POST /api/auth/login
    {"username": "steven", "password": "xxx"}
    → {"access_token": "eyJ...", "token_type": "bearer", "expires_in": 259200, "user": {...}}
    ```
    """
    return authenticate_local(body.username, body.password)


@router.get("/me")
async def me(user: TokenPayload = Depends(get_current_user)):
    """获取当前认证用户信息
    
    Headers: Authorization: Bearer <JWT or Admin Token>
    """
    return {
        "username": user.sub,
        "role": user.role,
        "display_name": user.display_name,
        "provider": user.provider,
    }


@router.get("/oauth/config")
async def oauth_config():
    """返回 OAuth 配置状态（前端用来决定是否显示 OAuth 登录按钮）"""
    return {
        "enabled": OAUTH_ENABLED,
        "provider": "entra" if OAUTH_ENABLED else None,
        "label": "Microsoft 登录" if OAUTH_ENABLED else None,
    }


@router.get("/oauth/authorize")
async def oauth_authorize(state: str = ""):
    """获取 OAuth 授权 URL → 前端重定向"""
    return get_oauth_authorize_url(state)


@router.post("/oauth/callback", response_model=LoginResponse)
async def oauth_callback(body: OAuthCallbackRequest):
    """OAuth 回调 → 换 JWT
    
    前端从 OAuth redirect 拿到 code，POST 到这里换本地 JWT。
    """
    return await authenticate_oauth(body.code)
