"""Telegram 通知 — 美林时钟更新推送（stub）

当前为 stub 实现，仅记录日志。
后续对接 Telegram Bot API 或 OpenClaw API。

调用示例:
    from backend.notify.telegram_notify import send_clock_update
    await send_clock_update(assessment_dict)
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# 阶段中文标签
PHASE_LABELS = {
    "recovery": "复苏",
    "overheat": "过热",
    "stagflation": "滞胀",
    "recession": "衰退",
}


def _format_message(assessment: dict) -> str:
    """格式化通知消息"""
    final_phase = assessment.get("final_phase", "未知")
    phase_label = PHASE_LABELS.get(final_phase, final_phase)
    position = assessment.get("final_position", 0)
    confidence = assessment.get("final_confidence", 0)
    market = assessment.get("market", "cn")
    trigger = assessment.get("trigger_type", "manual")

    # 检查是否有阶段变化
    algo_phase = assessment.get("algo_phase", "")
    algo_label = PHASE_LABELS.get(algo_phase, algo_phase)
    phase_change = ""
    if algo_phase != final_phase:
        phase_change = f" (算法: {algo_label})"

    trigger_label = {
        "manual": "手动评估",
        "quarterly_auto": "季度自动",
        "data_update": "数据更新",
    }.get(trigger, trigger)

    msg = (
        f"🕐 美林时钟更新 | {market.upper()}\n"
        f"阶段: {phase_label}{phase_change}\n"
        f"点位: {position} / 12\n"
        f"置信度: {round(confidence * 100)}%\n"
        f"来源: {trigger_label}"
    )

    # 人工确认信息
    if assessment.get("human_confirmed_at"):
        msg += f"\n👤 已人工确认 ({assessment.get('human_confirmed_by', '未知')})"

    return msg


async def send_clock_update(assessment: dict) -> bool:
    """发送时钟更新通知（stub）

    Args:
        assessment: clock_assessments 表的完整记录

    Returns:
        是否发送成功
    """
    message = _format_message(assessment)

    # --- STUB: 目前只记录日志，后续对接 Telegram ---
    logger.info(f"[Telegram Stub] 通知内容:\n{message}")

    # TODO: 对接 Telegram Bot API
    # import httpx
    # TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
    # TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
    # if TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID:
    #     async with httpx.AsyncClient() as client:
    #         await client.post(
    #             f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
    #             json={"chat_id": TELEGRAM_CHAT_ID, "text": message, "parse_mode": "HTML"},
    #         )
    #     return True

    return False  # stub 模式返回 False 表示未实际发送
