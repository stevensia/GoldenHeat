"""Bearer Token 认证依赖"""

from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from backend.config import ADMIN_API_TOKEN

security = HTTPBearer()


async def verify_admin_token(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> str:
    """验证 Bearer Token

    写入接口必须携带 Authorization: Bearer <ADMIN_API_TOKEN>
    """
    if credentials.credentials != ADMIN_API_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid admin token")
    return credentials.credentials
