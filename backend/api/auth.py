"""GoldenHeat 认证系统

支持三种认证方式（可叠加）：
1. 本地密码登录 → 颁发 JWT
2. Bearer Token（ADMIN_API_TOKEN）→ 兼容旧接口
3. OAuth2 / OpenID Connect → 预留 Entra ID（Azure AD）

所有方式统一返回 JWT access_token，前端用 Bearer <JWT> 调用受保护接口。
"""

import hashlib
import hmac
import logging
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

from backend.config import ADMIN_API_TOKEN

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# JWT 配置
# ──────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET", ADMIN_API_TOKEN + "-jwt-signing-key")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "72"))  # 默认3天

# ──────────────────────────────────────────────
# 本地用户（后续可迁移到 DB）
# ──────────────────────────────────────────────
# 格式: { username: { password_hash, role, display_name } }
# password_hash = sha256(password + salt)
_SALT = os.getenv("AUTH_SALT", "goldenheat-2026-salt")

def _hash_password(password: str) -> str:
    return hashlib.sha256((password + _SALT).encode()).hexdigest()

# 默认管理员账号 — 从环境变量读取，或 fallback
_DEFAULT_ADMIN_USER = os.getenv("ADMIN_USERNAME", "admin")
_DEFAULT_ADMIN_PASS = os.getenv("ADMIN_PASSWORD", "changeme")

LOCAL_USERS: dict[str, dict] = {
    _DEFAULT_ADMIN_USER: {
        "password_hash": _hash_password(_DEFAULT_ADMIN_PASS),
        "role": "admin",
        "display_name": "Steven Li",
    }
}

# ──────────────────────────────────────────────
# OAuth2 / Entra ID 配置（预留）
# ──────────────────────────────────────────────
OAUTH_ENABLED = os.getenv("OAUTH_ENABLED", "false").lower() == "true"
OAUTH_PROVIDER = os.getenv("OAUTH_PROVIDER", "entra")  # entra / google / github

# Entra ID (Azure AD) 配置
ENTRA_TENANT_ID = os.getenv("ENTRA_TENANT_ID", "")
ENTRA_CLIENT_ID = os.getenv("ENTRA_CLIENT_ID", "")
ENTRA_CLIENT_SECRET = os.getenv("ENTRA_CLIENT_SECRET", "")
ENTRA_REDIRECT_URI = os.getenv("ENTRA_REDIRECT_URI", "")
# Discovery: https://login.microsoftonline.com/{tenant}/v2.0/.well-known/openid-configuration
ENTRA_AUTHORITY = f"https://login.microsoftonline.com/{ENTRA_TENANT_ID}" if ENTRA_TENANT_ID else ""
ENTRA_TOKEN_URL = f"{ENTRA_AUTHORITY}/oauth2/v2.0/token" if ENTRA_AUTHORITY else ""
ENTRA_AUTH_URL = f"{ENTRA_AUTHORITY}/oauth2/v2.0/authorize" if ENTRA_AUTHORITY else ""
ENTRA_JWKS_URL = f"https://login.microsoftonline.com/{ENTRA_TENANT_ID}/discovery/v2.0/keys" if ENTRA_TENANT_ID else ""

# 允许的 OAuth 邮箱域名（安全白名单）
OAUTH_ALLOWED_DOMAINS = os.getenv("OAUTH_ALLOWED_DOMAINS", "").split(",")

# ──────────────────────────────────────────────
# 数据模型
# ──────────────────────────────────────────────
class TokenPayload(BaseModel):
    sub: str                # 用户标识
    role: str               # admin / viewer
    display_name: str       # 显示名
    provider: str           # local / entra / token
    exp: float              # 过期时间戳
    iat: float              # 签发时间戳

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int         # 秒
    user: dict

class OAuthCallbackRequest(BaseModel):
    code: str
    state: Optional[str] = None

# ──────────────────────────────────────────────
# JWT 工具
# ──────────────────────────────────────────────
def create_jwt(sub: str, role: str, display_name: str, provider: str = "local") -> LoginResponse:
    """生成 JWT token"""
    now = datetime.now(timezone.utc)
    exp = now + timedelta(hours=JWT_EXPIRE_HOURS)
    payload = {
        "sub": sub,
        "role": role,
        "display_name": display_name,
        "provider": provider,
        "iat": now.timestamp(),
        "exp": exp.timestamp(),
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return LoginResponse(
        access_token=token,
        expires_in=JWT_EXPIRE_HOURS * 3600,
        user={
            "username": sub,
            "role": role,
            "display_name": display_name,
            "provider": provider,
        }
    )

def decode_jwt(token: str) -> TokenPayload:
    """解析并验证 JWT"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return TokenPayload(**payload)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token 已过期，请重新登录")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"无效 Token: {e}")

# ──────────────────────────────────────────────
# 本地登录
# ──────────────────────────────────────────────
def authenticate_local(username: str, password: str) -> LoginResponse:
    """本地密码认证 → JWT"""
    user = LOCAL_USERS.get(username)
    if not user:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    
    if not hmac.compare_digest(user["password_hash"], _hash_password(password)):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    
    return create_jwt(
        sub=username,
        role=user["role"],
        display_name=user["display_name"],
        provider="local",
    )

# ──────────────────────────────────────────────
# OAuth2 / Entra ID（预留实现）
# ──────────────────────────────────────────────
def get_oauth_authorize_url(state: str = "") -> dict:
    """生成 OAuth 授权 URL（Entra ID）"""
    if not OAUTH_ENABLED or not ENTRA_CLIENT_ID:
        raise HTTPException(status_code=501, detail="OAuth 未配置")
    
    params = {
        "client_id": ENTRA_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": ENTRA_REDIRECT_URI,
        "scope": "openid profile email",
        "state": state,
        "response_mode": "query",
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return {
        "authorize_url": f"{ENTRA_AUTH_URL}?{query}",
        "provider": "entra",
    }

async def authenticate_oauth(code: str) -> LoginResponse:
    """OAuth 回调 → 换 token → 解析用户 → 颁发 JWT
    
    流程: 前端 redirect → Entra 登录 → 回调带 code → 后端换 access_token → 读 userinfo → 颁发本地 JWT
    """
    if not OAUTH_ENABLED or not ENTRA_CLIENT_ID:
        raise HTTPException(status_code=501, detail="OAuth 未配置")

    import httpx
    
    # Step 1: code → access_token
    async with httpx.AsyncClient() as client:
        resp = await client.post(ENTRA_TOKEN_URL, data={
            "client_id": ENTRA_CLIENT_ID,
            "client_secret": ENTRA_CLIENT_SECRET,
            "code": code,
            "redirect_uri": ENTRA_REDIRECT_URI,
            "grant_type": "authorization_code",
            "scope": "openid profile email",
        })
        if resp.status_code != 200:
            logger.error(f"Entra token exchange failed: {resp.text}")
            raise HTTPException(status_code=401, detail="OAuth 认证失败")
        
        token_data = resp.json()
        id_token = token_data.get("id_token", "")
    
    # Step 2: 解析 id_token（简单解码 payload，生产环境应验证签名）
    try:
        # 注意：生产环境需要用 JWKS 验证签名
        # 这里先用 decode without verification，后续加 JWKS 验证
        unverified = jwt.decode(id_token, options={"verify_signature": False})
        email = unverified.get("email", unverified.get("preferred_username", ""))
        name = unverified.get("name", email.split("@")[0])
        oid = unverified.get("oid", "")  # Entra Object ID
    except Exception as e:
        logger.error(f"Failed to decode Entra id_token: {e}")
        raise HTTPException(status_code=401, detail="OAuth token 解析失败")
    
    # Step 3: 域名白名单检查
    if OAUTH_ALLOWED_DOMAINS and OAUTH_ALLOWED_DOMAINS[0]:
        domain = email.split("@")[-1] if "@" in email else ""
        if domain not in OAUTH_ALLOWED_DOMAINS:
            raise HTTPException(status_code=403, detail=f"邮箱域名 {domain} 不在白名单中")
    
    # Step 4: 颁发本地 JWT
    return create_jwt(
        sub=email or oid,
        role="admin",  # 可根据 Entra group claims 分配角色
        display_name=name,
        provider="entra",
    )

# ──────────────────────────────────────────────
# FastAPI 认证依赖
# ──────────────────────────────────────────────
security = HTTPBearer(auto_error=False)

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
) -> TokenPayload:
    """统一认证入口 — 支持 JWT / 旧 Admin Token
    
    认证优先级:
    1. JWT → decode 验证
    2. 旧 ADMIN_API_TOKEN → 兼容，生成虚拟 payload
    3. 都不是 → 401
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="需要认证，请提供 Bearer token")
    
    token = credentials.credentials
    
    # 兼容旧 Admin Token
    if token == ADMIN_API_TOKEN:
        return TokenPayload(
            sub="admin",
            role="admin",
            display_name="Admin (Token)",
            provider="token",
            exp=time.time() + 86400,
            iat=time.time(),
        )
    
    # JWT 验证
    return decode_jwt(token)

async def require_admin(user: TokenPayload = Depends(get_current_user)) -> TokenPayload:
    """要求 admin 角色"""
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return user

# 保持向后兼容的别名
verify_admin_token = require_admin
