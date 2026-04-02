"""GoldenHeat LLM 统一客户端

支持两种后端:
1. 本地 copilot-proxy (localhost:4399) — 默认
2. Azure AI Foundry (Azure OpenAI) — 通过环境变量配置

所有 LLM 调用统一走 llm_chat()，自动选择可用后端。
"""

import json
import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# 配置
# ──────────────────────────────────────────────

# 后端选择: local / azure / auto（先试 local，失败走 azure）
LLM_BACKEND = os.getenv("LLM_BACKEND", "auto")

# 本地 copilot-proxy
LOCAL_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:4399/v1")
LOCAL_MODEL = os.getenv("LLM_MODEL", "claude-opus-4-5")
LOCAL_API_KEY = os.getenv("LLM_API_KEY", "not-needed")

# Azure AI Foundry (Azure OpenAI)
AZURE_ENDPOINT = os.getenv("AZURE_LLM_ENDPOINT", "")  # e.g. https://xxx.openai.azure.com
AZURE_API_KEY = os.getenv("AZURE_LLM_API_KEY", "")
AZURE_DEPLOYMENT = os.getenv("AZURE_LLM_DEPLOYMENT", "gpt-4o")  # deployment name
AZURE_API_VERSION = os.getenv("AZURE_LLM_API_VERSION", "2024-08-01-preview")
# Azure AI Foundry 也支持 Managed Identity（无需 API Key）
AZURE_USE_MANAGED_IDENTITY = os.getenv("AZURE_USE_MANAGED_IDENTITY", "false").lower() == "true"

# 通用参数
LLM_TIMEOUT = int(os.getenv("LLM_TIMEOUT", "60"))
LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "1000"))
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.3"))


# ──────────────────────────────────────────────
# Azure Managed Identity Token
# ──────────────────────────────────────────────
_azure_token_cache: dict = {"token": "", "expires_at": 0}

async def _get_azure_mi_token() -> str:
    """通过 Azure Managed Identity 获取 access token"""
    import time
    now = time.time()
    if _azure_token_cache["token"] and _azure_token_cache["expires_at"] > now + 60:
        return _azure_token_cache["token"]
    
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            "http://169.254.169.254/metadata/identity/oauth2/token",
            params={
                "api-version": "2018-02-01",
                "resource": "https://cognitiveservices.azure.com",
            },
            headers={"Metadata": "true"},
        )
        resp.raise_for_status()
        data = resp.json()
        _azure_token_cache["token"] = data["access_token"]
        _azure_token_cache["expires_at"] = now + int(data.get("expires_in", 3600)) - 120
        return data["access_token"]


# ──────────────────────────────────────────────
# 统一 Chat Completion 接口
# ──────────────────────────────────────────────

async def _call_local(
    messages: list[dict],
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
) -> dict:
    """调用本地 copilot-proxy"""
    async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
        resp = await client.post(
            f"{LOCAL_BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {LOCAL_API_KEY}"},
            json={
                "model": model or LOCAL_MODEL,
                "messages": messages,
                "temperature": temperature if temperature is not None else LLM_TEMPERATURE,
                "max_tokens": max_tokens or LLM_MAX_TOKENS,
            },
        )
        resp.raise_for_status()
        return resp.json()


async def _call_azure(
    messages: list[dict],
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
) -> dict:
    """调用 Azure AI Foundry (Azure OpenAI)"""
    deployment = model or AZURE_DEPLOYMENT
    url = f"{AZURE_ENDPOINT}/openai/deployments/{deployment}/chat/completions?api-version={AZURE_API_VERSION}"
    
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if AZURE_USE_MANAGED_IDENTITY:
        token = await _get_azure_mi_token()
        headers["Authorization"] = f"Bearer {token}"
    elif AZURE_API_KEY:
        headers["api-key"] = AZURE_API_KEY
    else:
        raise ValueError("Azure LLM: 需要 AZURE_LLM_API_KEY 或 AZURE_USE_MANAGED_IDENTITY=true")
    
    async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
        resp = await client.post(
            url,
            headers=headers,
            json={
                "messages": messages,
                "temperature": temperature if temperature is not None else LLM_TEMPERATURE,
                "max_tokens": max_tokens or LLM_MAX_TOKENS,
            },
        )
        resp.raise_for_status()
        return resp.json()


async def llm_chat(
    messages: list[dict],
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    backend: Optional[str] = None,
) -> Optional[dict]:
    """统一 LLM 调用入口
    
    Args:
        messages: OpenAI 格式 messages
        model: 模型名（可选，用默认）
        temperature: 温度（可选）
        max_tokens: 最大 token 数（可选）
        backend: 强制指定后端 "local"/"azure"（可选，默认用 LLM_BACKEND 配置）
    
    Returns:
        OpenAI Chat Completion 格式响应，或 None（全部失败时）
    """
    target = backend or LLM_BACKEND
    
    if target == "local":
        return await _call_local(messages, model, temperature, max_tokens)
    
    if target == "azure":
        if not AZURE_ENDPOINT:
            logger.warning("Azure LLM 未配置 AZURE_LLM_ENDPOINT")
            return None
        return await _call_azure(messages, model, temperature, max_tokens)
    
    # auto: 先试 local，失败走 azure
    try:
        return await _call_local(messages, model, temperature, max_tokens)
    except Exception as e:
        logger.warning(f"Local LLM 不可用 ({e}), 尝试 Azure...")
    
    if AZURE_ENDPOINT:
        try:
            return await _call_azure(messages, model, temperature, max_tokens)
        except Exception as e:
            logger.error(f"Azure LLM 也失败: {e}")
            return None
    
    logger.error("所有 LLM 后端均不可用")
    return None


def extract_content(response: Optional[dict]) -> Optional[str]:
    """从 LLM 响应中提取文本内容"""
    if not response:
        return None
    try:
        return response["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError):
        return None


def extract_json(response: Optional[dict]) -> Optional[dict]:
    """从 LLM 响应中提取 JSON（处理 markdown 包裹）"""
    content = extract_content(response)
    if not content:
        return None
    
    # 去掉 ```json 包裹
    if content.startswith("```"):
        lines = content.split("\n")
        content = "\n".join(lines[1:-1])
    
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        logger.warning(f"LLM 返回非 JSON: {content[:200]}")
        return None


def get_llm_status() -> dict:
    """返回 LLM 配置状态（用于 admin 页面）"""
    return {
        "backend": LLM_BACKEND,
        "local": {
            "url": LOCAL_BASE_URL,
            "model": LOCAL_MODEL,
        },
        "azure": {
            "configured": bool(AZURE_ENDPOINT),
            "endpoint": AZURE_ENDPOINT[:50] + "..." if len(AZURE_ENDPOINT) > 50 else AZURE_ENDPOINT,
            "deployment": AZURE_DEPLOYMENT,
            "managed_identity": AZURE_USE_MANAGED_IDENTITY,
        },
        "timeout": LLM_TIMEOUT,
        "temperature": LLM_TEMPERATURE,
    }
