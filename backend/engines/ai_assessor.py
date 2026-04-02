"""AI 评估模块 — 调用 LLM 分析美林时钟阶段

调用 copilot-proxy (localhost:4399) 对当前宏观数据进行分析，
输出 AI 判断的 phase / position / confidence / reasoning。
失败时返回 None，不影响算法判断。
"""

import json
import logging
from typing import Optional

import httpx

from backend.config import LLM_BASE_URL, LLM_MODEL

logger = logging.getLogger(__name__)

# AI 分析的 prompt 模板
SYSTEM_PROMPT = """你是一名专业宏观经济分析师，精通美林投资时钟理论。
请根据提供的宏观经济数据，判断当前经济周期所处阶段。

美林时钟四阶段（用 0-12 点位表示，类似钟表）:
- 复苏期 (recovery): 点位 10.5-1.5, 中心 12/0。GDP↑ CPI↓，超配股票
- 过热期 (overheat): 点位 1.5-4.5, 中心 3。GDP↑ CPI↑，超配商品
- 滞胀期 (stagflation): 点位 4.5-7.5, 中心 6。GDP↓ CPI↑，超配现金
- 衰退期 (recession): 点位 7.5-10.5, 中心 9。GDP↓ CPI↓，超配债券

请严格按以下 JSON 格式返回（不要包含其他内容）:
{
  "phase": "recovery|overheat|stagflation|recession",
  "position": 0.0到12.0之间的数字,
  "confidence": 0.0到1.0之间的数字,
  "reasoning": "简短的中文推理过程（不超过200字）"
}"""

USER_PROMPT_TEMPLATE = """以下是{market_label}的最新宏观经济数据:

算法判断结果: {algo_phase}（置信度 {algo_confidence}）

指标详情:
- GDP 趋势: {gdp_trend}（斜率 {gdp_slope}）
- CPI 趋势: {cpi_trend}（斜率 {cpi_slope}）
{extra_indicators}

请给出你的独立判断（可以与算法不同）。"""


def _build_user_prompt(algo_result: dict, market: str) -> str:
    """构建用户 prompt"""
    market_labels = {"cn": "中国市场", "us": "美国市场", "global": "全球市场"}
    market_label = market_labels.get(market, market)

    extra_lines = []
    if algo_result.get("pmi_value") is not None:
        extra_lines.append(f"- PMI: {algo_result['pmi_value']}")
    if algo_result.get("m2_growth") is not None:
        extra_lines.append(f"- M2 增速: {algo_result['m2_growth']}")
    if algo_result.get("gdp_growth") is not None:
        extra_lines.append(f"- GDP 增速: {algo_result['gdp_growth']}")
    if algo_result.get("credit_signal"):
        extra_lines.append(f"- 信贷信号: {algo_result['credit_signal']}")
    if algo_result.get("transition_warning"):
        extra_lines.append(f"- 转换预警: {algo_result['transition_warning']}")

    return USER_PROMPT_TEMPLATE.format(
        market_label=market_label,
        algo_phase=algo_result.get("phase_label", algo_result.get("phase", "未知")),
        algo_confidence=algo_result.get("confidence", 0),
        gdp_trend=algo_result.get("gdp_trend", "未知"),
        gdp_slope=algo_result.get("gdp_slope", 0),
        cpi_trend=algo_result.get("cpi_trend", "未知"),
        cpi_slope=algo_result.get("cpi_slope", 0),
        extra_indicators="\n".join(extra_lines) if extra_lines else "（无额外指标）",
    )


async def assess_with_ai(algo_result: dict, market: str = "cn") -> Optional[dict]:
    """调用 LLM 获取 AI 判断

    Args:
        algo_result: 算法判断结果（PhaseResult.to_dict()）
        market: 市场代码

    Returns:
        {phase, position, confidence, reasoning} 或 None（失败时）
    """
    try:
        user_prompt = _build_user_prompt(algo_result, market)

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{LLM_BASE_URL}/chat/completions",
                json={
                    "model": LLM_MODEL,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.3,
                    "max_tokens": 500,
                },
            )
            response.raise_for_status()

        data = response.json()
        content = data["choices"][0]["message"]["content"].strip()

        # 解析 JSON（处理可能的 markdown 包裹）
        if content.startswith("```"):
            # 去掉 ```json 和 ```
            lines = content.split("\n")
            content = "\n".join(lines[1:-1])

        result = json.loads(content)

        # 验证字段
        valid_phases = {"recovery", "overheat", "stagflation", "recession"}
        phase = result.get("phase", "")
        if phase not in valid_phases:
            logger.warning(f"AI 返回无效 phase: {phase}")
            return None

        position = float(result.get("position", 0))
        if not (0 <= position <= 12):
            logger.warning(f"AI 返回无效 position: {position}")
            return None

        confidence = float(result.get("confidence", 0.5))
        confidence = max(0.0, min(1.0, confidence))

        reasoning = str(result.get("reasoning", ""))[:500]

        logger.info(f"AI 评估完成: {phase} 点位={position} 置信度={confidence}")
        return {
            "phase": phase,
            "position": round(position, 1),
            "confidence": round(confidence, 3),
            "reasoning": reasoning,
        }

    except httpx.HTTPStatusError as e:
        logger.error(f"AI 评估 HTTP 错误: {e.response.status_code} {e.response.text[:200]}")
        return None
    except json.JSONDecodeError as e:
        logger.error(f"AI 评估返回非 JSON: {e}")
        return None
    except Exception as e:
        logger.error(f"AI 评估失败: {e}")
        return None
