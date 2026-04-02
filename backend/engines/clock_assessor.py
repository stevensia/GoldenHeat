"""三方加权评估引擎 — 算法 + AI + 人工

将美林时钟从纯算法判断升级为三方加权系统：
- 算法判断 (w1=0.4): 线性回归斜率
- AI 判断 (w2=0.3): LLM 分析
- 人工判断 (w3=0.3): 后台人工确认/修正

人工未介入时自动调整权重: w1=0.5, w2=0.5
"""

import json
import logging
from datetime import datetime
from typing import Optional

from backend.db.connection import execute, fetchall, fetchone
from backend.repos.clock_repo import ClockRepo, IndicatorHistoryRepo
from backend.repos.macro_repo import MacroRepo
from backend.engines.merill_clock import MerillClock, Phase, calc_position, PHASE_CENTERS
from backend.engines.ai_assessor import assess_with_ai

logger = logging.getLogger(__name__)

# 默认权重
WEIGHTS_FULL = {"algo": 0.4, "ai": 0.3, "human": 0.3}
WEIGHTS_AUTO = {"algo": 0.5, "ai": 0.5, "human": 0.0}


def _position_to_phase(position: float) -> str:
    """根据 0-12 点位反推阶段"""
    p = position % 12
    if p >= 10.5 or p < 1.5:
        return "recovery"
    elif 1.5 <= p < 4.5:
        return "overheat"
    elif 4.5 <= p < 7.5:
        return "stagflation"
    else:
        return "recession"


def _weighted_position(
    algo_pos: float,
    ai_pos: Optional[float],
    human_pos: Optional[float],
    weights: dict,
) -> float:
    """加权计算最终点位（处理环形距离）

    时钟是环形的，0 和 12 是同一个点，需要特殊处理。
    """
    positions = []
    w_list = []

    positions.append(algo_pos)
    w_list.append(weights["algo"])

    if ai_pos is not None and weights["ai"] > 0:
        positions.append(ai_pos)
        w_list.append(weights["ai"])

    if human_pos is not None and weights["human"] > 0:
        positions.append(human_pos)
        w_list.append(weights["human"])

    # 归一化权重
    total_w = sum(w_list)
    w_list = [w / total_w for w in w_list]

    # 环形加权平均（用复数/角度方法）
    import math
    sum_x = 0.0
    sum_y = 0.0
    for pos, w in zip(positions, w_list):
        angle = pos / 12.0 * 2 * math.pi
        sum_x += w * math.cos(angle)
        sum_y += w * math.sin(angle)

    avg_angle = math.atan2(sum_y, sum_x)
    if avg_angle < 0:
        avg_angle += 2 * math.pi

    result = avg_angle / (2 * math.pi) * 12.0
    return round(result, 1)


def _weighted_confidence(
    algo_conf: float,
    ai_conf: Optional[float],
    human_conf: Optional[float],
    weights: dict,
) -> float:
    """加权计算最终置信度"""
    total = weights["algo"] * algo_conf
    w_sum = weights["algo"]

    if ai_conf is not None and weights["ai"] > 0:
        total += weights["ai"] * ai_conf
        w_sum += weights["ai"]

    if human_conf is not None and weights["human"] > 0:
        total += weights["human"] * human_conf
        w_sum += weights["human"]

    return round(total / w_sum, 3) if w_sum > 0 else algo_conf


class ClockAssessor:
    """三方加权评估器"""

    def __init__(self, clock_repo: ClockRepo | None = None, macro_repo: MacroRepo | None = None):
        self.clock = MerillClock()
        self.clock_repo = clock_repo or ClockRepo()
        self.macro_repo = macro_repo or MacroRepo()
        self.indicator_repo = IndicatorHistoryRepo()

    async def run_assessment(
        self, market: str = "cn", trigger_type: str = "manual"
    ) -> dict:
        """执行完整评估流程

        1. 运行算法判断 → algo_position
        2. 运行 AI 判断 → ai_position
        3. 查询最近人工确认 → human_position
        4. 加权计算 final_position
        5. 写入 clock_assessments
        6. 写入 indicator_history
        7. 返回完整结果
        """
        # 1. 算法判断
        algo_result = self.clock.judge_phase(market=market)
        algo_dict = algo_result.to_assessment_dict()
        algo_pos = algo_dict["position"]
        algo_conf = algo_dict["confidence"]
        algo_phase = algo_dict["phase"]

        # 2. AI 判断（失败不阻断）
        ai_result = await assess_with_ai(algo_result.to_dict(), market=market)
        ai_phase = ai_result["phase"] if ai_result else None
        ai_pos = ai_result["position"] if ai_result else None
        ai_conf = ai_result["confidence"] if ai_result else None
        ai_reasoning = ai_result["reasoning"] if ai_result else None

        # 3. 查询最近人工确认
        human = self._get_latest_human(market)
        human_phase = human["human_phase"] if human else None
        human_pos = human["human_position"] if human else None
        human_conf = human["human_confidence"] if human else None
        human_notes = human["human_notes"] if human else None
        human_confirmed_at = human["human_confirmed_at"] if human else None
        human_confirmed_by = human["human_confirmed_by"] if human else None

        # 4. 确定权重
        has_human = human_pos is not None
        weights = WEIGHTS_FULL if has_human else WEIGHTS_AUTO

        # 5. 加权计算
        final_pos = _weighted_position(algo_pos, ai_pos, human_pos, weights)
        final_conf = _weighted_confidence(algo_conf, ai_conf, human_conf, weights)
        final_phase = _position_to_phase(final_pos)

        # 6. 写入 clock_assessments
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        cursor = execute(
            """INSERT INTO clock_assessments
               (assessed_at, market, algo_phase, algo_position, algo_confidence, algo_details,
                ai_phase, ai_position, ai_confidence, ai_reasoning,
                human_phase, human_position, human_confidence, human_notes,
                human_confirmed_at, human_confirmed_by,
                final_phase, final_position, final_confidence, weights,
                trigger_type)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                now, market,
                algo_phase, algo_pos, algo_conf, algo_dict.get("algo_details"),
                ai_phase, ai_pos, ai_conf, ai_reasoning,
                human_phase, human_pos, human_conf, human_notes,
                human_confirmed_at, human_confirmed_by,
                final_phase, final_pos, final_conf, json.dumps(weights),
                trigger_type,
            ),
        )
        assessment_id = cursor.lastrowid

        # 7. 写入 indicator_history
        self._record_indicators(assessment_id, market)

        logger.info(
            f"评估完成(#{assessment_id}): {market} final={final_phase} pos={final_pos} "
            f"conf={final_conf} weights={weights}"
        )

        return self._format_assessment(assessment_id)

    def _get_latest_human(self, market: str) -> Optional[dict]:
        """获取最近一次人工确认"""
        row = fetchone(
            """SELECT human_phase, human_position, human_confidence,
                      human_notes, human_confirmed_at, human_confirmed_by
               FROM clock_assessments
               WHERE market = ? AND human_confirmed_at IS NOT NULL
               ORDER BY human_confirmed_at DESC LIMIT 1""",
            (market,),
        )
        if row:
            return dict(row)
        return None

    def _record_indicators(self, assessment_id: int, market: str):
        """记录指标到 indicator_history"""
        if market == "cn":
            indicators = [
                ("cn_gdp", "国家统计局"),
                ("cn_cpi", "国家统计局"),
                ("cn_pmi", "国家统计局"),
                ("cn_m2", "中国人民银行"),
            ]
        else:
            indicators = [
                ("us_gdp", "FRED"),
                ("us_cpi", "FRED"),
            ]

        for code, source in indicators:
            # 当前值
            current = fetchone(
                """SELECT date, value FROM macro_data
                   WHERE indicator = ? ORDER BY date DESC LIMIT 1""",
                (code,),
            )
            if not current:
                continue

            # 上一条值
            prev = fetchone(
                """SELECT value FROM macro_data
                   WHERE indicator = ? AND date < ?
                   ORDER BY date DESC LIMIT 1""",
                (code, current["date"]),
            )

            execute(
                """INSERT INTO indicator_history
                   (assessment_id, indicator, value, previous_value, date, source)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    assessment_id,
                    code,
                    current["value"],
                    prev["value"] if prev else None,
                    current["date"],
                    source,
                ),
            )

    def _format_assessment(self, assessment_id: int) -> dict:
        """格式化评估结果"""
        row = fetchone(
            "SELECT * FROM clock_assessments WHERE id = ?", (assessment_id,)
        )
        if not row:
            return {}

        d = dict(row)
        # 解析 JSON 字段
        for field in ("algo_details", "weights"):
            if d.get(field) and isinstance(d[field], str):
                try:
                    d[field] = json.loads(d[field])
                except json.JSONDecodeError:
                    pass

        # 附加指标历史
        indicators = fetchall(
            "SELECT * FROM indicator_history WHERE assessment_id = ?",
            (assessment_id,),
        )
        d["indicators"] = [dict(i) for i in indicators]

        return d

    def get_latest_assessment(self, market: str = "cn") -> Optional[dict]:
        """获取最新评估"""
        row = fetchone(
            """SELECT id FROM clock_assessments
               WHERE market = ? ORDER BY assessed_at DESC LIMIT 1""",
            (market,),
        )
        if not row:
            return None
        return self._format_assessment(row["id"])

    def get_assessment_history(
        self, market: str = "cn", limit: int = 20
    ) -> list[dict]:
        """获取评估历史列表"""
        rows = fetchall(
            """SELECT id FROM clock_assessments
               WHERE market = ? ORDER BY assessed_at DESC LIMIT ?""",
            (market, limit),
        )
        return [self._format_assessment(r["id"]) for r in rows]

    def confirm_human(
        self,
        market: str,
        phase: str,
        position: float,
        confidence: float,
        notes: str = "",
        confirmed_by: str = "admin",
    ) -> dict:
        """人工确认/修正最新评估

        更新最新评估的 human_* 字段，并重新计算 final
        """
        latest = fetchone(
            """SELECT id, algo_position, algo_confidence,
                      ai_position, ai_confidence
               FROM clock_assessments
               WHERE market = ? ORDER BY assessed_at DESC LIMIT 1""",
            (market,),
        )
        if not latest:
            raise ValueError(f"没有找到 {market} 的评估记录，请先运行评估")

        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

        # 重新计算 final（使用完整三方权重）
        weights = WEIGHTS_FULL
        final_pos = _weighted_position(
            latest["algo_position"],
            latest["ai_position"],
            position,
            weights,
        )
        final_conf = _weighted_confidence(
            latest["algo_confidence"],
            latest["ai_confidence"],
            confidence,
            weights,
        )
        final_phase = _position_to_phase(final_pos)

        execute(
            """UPDATE clock_assessments SET
               human_phase = ?, human_position = ?, human_confidence = ?,
               human_notes = ?, human_confirmed_at = ?, human_confirmed_by = ?,
               final_phase = ?, final_position = ?, final_confidence = ?,
               weights = ?
               WHERE id = ?""",
            (
                phase, position, confidence,
                notes, now, confirmed_by,
                final_phase, final_pos, final_conf,
                json.dumps(weights),
                latest["id"],
            ),
        )

        logger.info(f"人工确认(#{latest['id']}): {phase} pos={position} → final={final_phase} pos={final_pos}")
        return self._format_assessment(latest["id"])
