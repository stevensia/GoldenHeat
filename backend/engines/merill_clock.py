"""美林时钟引擎 — 四阶段经济周期判断

基于 GDP 趋势 + CPI 趋势判断经济周期阶段，
辅以 PMI 矫正和信贷领先指标提高准确性。

四阶段:
- 复苏 (Recovery): GDP↑ CPI↓ → 超配股票
- 过热 (Overheat): GDP↑ CPI↑ → 超配商品
- 滞胀 (Stagflation): GDP↓ CPI↑ → 超配现金
- 衰退 (Recession): GDP↓ CPI↓ → 超配债券
"""

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

from backend.config import MERILL_CLOCK
from backend.db.connection import fetchall

logger = logging.getLogger(__name__)


class Phase(Enum):
    """美林时钟四阶段"""
    RECOVERY = "recovery"         # 复苏期
    OVERHEAT = "overheat"         # 过热期
    STAGFLATION = "stagflation"   # 滞胀期
    RECESSION = "recession"       # 衰退期


# 各阶段推荐资产配置
PHASE_ALLOCATION = {
    Phase.RECOVERY: {
        "label": "复苏期",
        "best_asset": "股票",
        "second_asset": "商品",
        "allocation": {"股票": 0.6, "商品": 0.2, "债券": 0.1, "现金": 0.1},
        "description": "经济增长加速、通胀温和，股市表现最佳",
    },
    Phase.OVERHEAT: {
        "label": "过热期",
        "best_asset": "商品",
        "second_asset": "股票",
        "allocation": {"商品": 0.4, "股票": 0.3, "现金": 0.2, "债券": 0.1},
        "description": "经济增长强劲但通胀升温，商品受益于价格上涨",
    },
    Phase.STAGFLATION: {
        "label": "滞胀期",
        "best_asset": "现金",
        "second_asset": "商品",
        "allocation": {"现金": 0.5, "商品": 0.2, "债券": 0.2, "股票": 0.1},
        "description": "经济放缓但通胀高企，持有现金防守为主",
    },
    Phase.RECESSION: {
        "label": "衰退期",
        "best_asset": "债券",
        "second_asset": "现金",
        "allocation": {"债券": 0.5, "现金": 0.3, "股票": 0.1, "商品": 0.1},
        "description": "经济收缩、通胀下降，债券因降息预期表现最佳",
    },
}


@dataclass
class PhaseResult:
    """美林时钟判断结果"""
    phase: Phase                          # 当前阶段
    confidence: float                      # 置信度 (0-1)
    gdp_trend: str                        # GDP 趋势: 'up' / 'down'
    cpi_trend: str                        # CPI 趋势: 'up' / 'down'
    gdp_slope: float                      # GDP 线性回归斜率
    cpi_slope: float                      # CPI 线性回归斜率
    pmi_value: Optional[float] = None     # 最新 PMI 值
    pmi_confirm: Optional[bool] = None    # PMI 是否确认经济方向
    m2_growth: Optional[float] = None     # 最新 M2 增速
    gdp_growth: Optional[float] = None    # 最新 GDP 增速
    credit_signal: Optional[str] = None   # 信贷领先信号
    transition_warning: Optional[str] = None  # 阶段转换预警
    allocation: dict = field(default_factory=dict)  # 推荐配置

    def to_dict(self) -> dict:
        """转换为字典"""
        phase_info = PHASE_ALLOCATION[self.phase]
        return {
            "phase": self.phase.value,
            "phase_label": phase_info["label"],
            "confidence": round(self.confidence, 3),
            "gdp_trend": self.gdp_trend,
            "cpi_trend": self.cpi_trend,
            "gdp_slope": round(self.gdp_slope, 4),
            "cpi_slope": round(self.cpi_slope, 4),
            "pmi_value": self.pmi_value,
            "pmi_confirm": self.pmi_confirm,
            "m2_growth": self.m2_growth,
            "gdp_growth": self.gdp_growth,
            "credit_signal": self.credit_signal,
            "transition_warning": self.transition_warning,
            "best_asset": phase_info["best_asset"],
            "allocation": self.allocation or phase_info["allocation"],
            "description": phase_info["description"],
        }

    def to_assessment_dict(self) -> dict:
        """返回完整评估数据（含各指标详情），用于写入 clock_assessments 表"""
        import json
        base = self.to_dict()
        base["position"] = calc_position(self.phase, self.confidence, self.gdp_slope, self.cpi_slope)
        base["algo_details"] = json.dumps({
            "gdp_slope": round(self.gdp_slope, 4),
            "cpi_slope": round(self.cpi_slope, 4),
            "pmi_value": self.pmi_value,
            "pmi_confirm": self.pmi_confirm,
            "m2_growth": self.m2_growth,
            "gdp_growth": self.gdp_growth,
            "credit_signal": self.credit_signal,
        }, ensure_ascii=False)
        return base


# === 点位计算 ===
# 将 phase + confidence + 斜率 映射为 0-12 时钟点位
# 各阶段中心: recovery=0/12, overheat=3, stagflation=6, recession=9
PHASE_RANGES = {
    Phase.RECOVERY:    (10.5, 13.5),   # 以 12/0 为中心，跨越 10.5→13.5（mod 12）
    Phase.OVERHEAT:    (1.5, 4.5),     # 以 3 为中心
    Phase.STAGFLATION: (4.5, 7.5),     # 以 6 为中心
    Phase.RECESSION:   (7.5, 10.5),    # 以 9 为中心
}

PHASE_CENTERS = {
    Phase.RECOVERY: 12.0,
    Phase.OVERHEAT: 3.0,
    Phase.STAGFLATION: 6.0,
    Phase.RECESSION: 9.0,
}


def calc_position(phase: Phase, confidence: float, gdp_slope: float, cpi_slope: float) -> float:
    """将 phase + confidence + 斜率大小 转为 0-12 点位

    在该阶段的范围内，用 confidence 和斜率决定精确位置：
    - confidence 越高 → 越靠近中心
    - 斜率越大 → 偏移方向由顺时针趋势决定
    """
    center = PHASE_CENTERS[phase]
    lo, hi = PHASE_RANGES[phase]
    half = (hi - lo) / 2  # 1.5

    # 斜率强度（归一化到 0-1）
    slope_mag = min(abs(gdp_slope) + abs(cpi_slope), 1.0)

    # 偏移量：confidence 低或斜率弱时远离中心
    # confidence 高且斜率强 → 偏移接近 0（在中心）
    # confidence 低 → 偏移较大（靠近边界）
    offset = half * (1.0 - confidence) * 0.6 + half * (1.0 - slope_mag) * 0.4

    # 偏移方向：用 CPI 斜率正负决定（正=顺时针=+，负=逆时针=-）
    if cpi_slope >= 0:
        position = center + offset
    else:
        position = center - offset

    # 归一化到 0-12
    position = position % 12
    return round(position, 1)


class MerillClock:
    """美林时钟判断引擎

    核心逻辑:
    1. calc_trend: 滑动窗口线性回归计算趋势方向
    2. judge_phase: 基于 GDP+CPI 趋势的四阶段判断
    3. PMI 矫正: PMI 领先 GDP 3-6 个月，用于矫正置信度
    4. 信贷领先指标: M2 增速 vs GDP 增速，预判经济方向
    """

    def __init__(self):
        self.gdp_window = MERILL_CLOCK["gdp_trend_window"]  # 4 季度
        self.cpi_window = MERILL_CLOCK["cpi_trend_window"]  # 6 月
        self.pmi_threshold = MERILL_CLOCK["pmi_threshold"]  # 50

    @staticmethod
    def calc_trend(series: pd.Series, window: int) -> tuple[str, float]:
        """滑动窗口趋势计算（线性回归斜率）

        Args:
            series: 时间序列数据
            window: 窗口大小（数据点个数）

        Returns:
            (trend, slope): 趋势方向 'up'/'down' 和斜率值
        """
        if series is None or len(series) < window:
            # 数据不足，返回中性
            logger.warning(f"数据不足: {len(series) if series is not None else 0} < {window}")
            return ("up", 0.0)

        # 取最近 window 个数据点
        recent = series.dropna().tail(window).values

        if len(recent) < 2:
            return ("up", 0.0)

        # 线性回归计算斜率
        X = np.arange(len(recent)).reshape(-1, 1)
        y = recent.astype(float)

        model = LinearRegression()
        model.fit(X, y)
        slope = model.coef_[0]

        trend = "up" if slope > 0 else "down"
        return (trend, float(slope))

    def _load_indicator(self, indicator: str, limit: int = 500) -> pd.Series:
        """从数据库加载指标数据（全量加载，按日期升序）

        Args:
            indicator: 指标名 (如 'cn_cpi', 'cn_gdp')
            limit: 最多加载多少条

        Returns:
            pd.Series，index 为日期字符串
        """
        rows = fetchall(
            """SELECT date, value FROM macro_data
               WHERE indicator = ?
               ORDER BY date ASC
               LIMIT ?""",
            (indicator, limit),
        )
        if not rows:
            return pd.Series(dtype=float)

        dates = [row["date"] for row in rows]
        values = [row["value"] for row in rows]
        return pd.Series(values, index=dates, dtype=float)

    def judge_phase(self, market: str = "cn", as_of: str | None = None) -> PhaseResult:
        """判断当前美林时钟阶段

        Args:
            market: 市场 'cn'(中国) 或 'us'(美国)
            as_of: 截止日期 (YYYY-MM)，为 None 则取最新数据

        Returns:
            PhaseResult 判断结果
        """
        # 加载数据
        if market == "cn":
            gdp_series = self._load_indicator("cn_gdp")
            cpi_series = self._load_indicator("cn_cpi")
            pmi_series = self._load_indicator("cn_pmi")
            m2_series = self._load_indicator("cn_m2")
        else:
            gdp_series = self._load_indicator("us_gdp")
            cpi_series = self._load_indicator("us_cpi")
            pmi_series = pd.Series(dtype=float)  # 美国PMI暂未采集
            m2_series = pd.Series(dtype=float)

        # 如果指定了截止日期，截断数据
        if as_of:
            gdp_series = gdp_series[gdp_series.index <= as_of]
            cpi_series = cpi_series[cpi_series.index <= as_of]
            pmi_series = pmi_series[pmi_series.index <= as_of] if len(pmi_series) > 0 else pmi_series
            m2_series = m2_series[m2_series.index <= as_of] if len(m2_series) > 0 else m2_series

        # 1. 核心指标：GDP 趋势 + CPI 趋势
        gdp_trend, gdp_slope = self.calc_trend(gdp_series, self.gdp_window)
        cpi_trend, cpi_slope = self.calc_trend(cpi_series, self.cpi_window)

        # 2. 基础判断
        confidence = 1.0

        if gdp_trend == "up" and cpi_trend == "down":
            phase = Phase.RECOVERY
        elif gdp_trend == "up" and cpi_trend == "up":
            phase = Phase.OVERHEAT
        elif gdp_trend == "down" and cpi_trend == "up":
            phase = Phase.STAGFLATION
        else:  # gdp down, cpi down
            phase = Phase.RECESSION

        # 3. PMI 矫正（PMI 领先 GDP 3-6 个月）
        pmi_value = None
        pmi_confirm = None
        if len(pmi_series) > 0:
            pmi_value = float(pmi_series.iloc[-1])
            pmi_above_threshold = pmi_value > self.pmi_threshold
            gdp_up = (gdp_trend == "up")

            pmi_confirm = (pmi_above_threshold == gdp_up)

            if not pmi_confirm:
                # PMI 与 GDP 方向不一致，可能正在转换阶段
                confidence *= 0.7
                logger.info(f"PMI({pmi_value}) 与 GDP 趋势({gdp_trend})不一致，降低置信度")

        # 4. 信贷领先指标（M2 增速 vs GDP 增速）
        m2_growth = None
        gdp_growth = None
        credit_signal = None
        if len(m2_series) > 0 and len(gdp_series) > 0:
            m2_growth = float(m2_series.iloc[-1])
            gdp_growth = float(gdp_series.iloc[-1])

            if m2_growth > gdp_growth:
                credit_signal = "宽松"  # 信贷扩张，经济可能即将回暖
                if phase in (Phase.RECESSION, Phase.STAGFLATION):
                    confidence *= 0.85  # 可能正在转向复苏
            else:
                credit_signal = "紧缩"  # 信贷收紧，经济可能即将放缓
                if phase in (Phase.RECOVERY, Phase.OVERHEAT):
                    confidence *= 0.85  # 可能正在转向衰退

        # 5. 斜率强度影响置信度
        # 斜率越大（趋势越明显），置信度越高
        slope_magnitude = abs(gdp_slope) + abs(cpi_slope)
        if slope_magnitude < 0.1:
            # 斜率过小，趋势不明显
            confidence *= 0.8
            logger.info(f"趋势不明显(slope_mag={slope_magnitude:.3f})，降低置信度")

        # 6. 阶段转换预警
        transition_warning = self._check_transition(
            gdp_trend, cpi_trend, gdp_slope, cpi_slope, pmi_value, pmi_confirm
        )

        # 确保置信度在 [0, 1] 范围
        confidence = max(0.0, min(1.0, confidence))

        result = PhaseResult(
            phase=phase,
            confidence=confidence,
            gdp_trend=gdp_trend,
            cpi_trend=cpi_trend,
            gdp_slope=gdp_slope,
            cpi_slope=cpi_slope,
            pmi_value=pmi_value,
            pmi_confirm=pmi_confirm,
            m2_growth=m2_growth,
            gdp_growth=gdp_growth,
            credit_signal=credit_signal,
            transition_warning=transition_warning,
            allocation=PHASE_ALLOCATION[phase]["allocation"],
        )

        logger.info(
            f"美林时钟判断({market}): {PHASE_ALLOCATION[phase]['label']} "
            f"(置信度={confidence:.2f}, GDP={gdp_trend}/{gdp_slope:.3f}, CPI={cpi_trend}/{cpi_slope:.3f})"
        )

        return result

    def _check_transition(
        self,
        gdp_trend: str,
        cpi_trend: str,
        gdp_slope: float,
        cpi_slope: float,
        pmi_value: Optional[float],
        pmi_confirm: Optional[bool],
    ) -> Optional[str]:
        """检查阶段转换预警信号

        当指标出现以下情况时发出预警：
        - 斜率接近 0（趋势可能反转）
        - PMI 与 GDP 方向矛盾
        - 核心指标快速变化
        """
        warnings = []

        # GDP 斜率接近 0，可能反转
        if abs(gdp_slope) < 0.05:
            warnings.append(f"GDP趋势微弱(斜率={gdp_slope:.3f})，可能即将反转")

        # CPI 斜率接近 0
        if abs(cpi_slope) < 0.05:
            warnings.append(f"CPI趋势微弱(斜率={cpi_slope:.3f})，可能即将反转")

        # PMI 预警
        if pmi_value is not None and pmi_confirm is False:
            if pmi_value > 50 and gdp_trend == "down":
                warnings.append(f"PMI({pmi_value})显示扩张但GDP下行，可能即将转向复苏")
            elif pmi_value < 50 and gdp_trend == "up":
                warnings.append(f"PMI({pmi_value})显示收缩但GDP上行，可能即将转向衰退")

        if warnings:
            return " | ".join(warnings)
        return None

    def judge_phase_historical(
        self, market: str = "cn", start: str = "2020-01", end: str = "2025-12", freq: str = "Q"
    ) -> list[dict]:
        """对历史区间按季度/月度跑美林时钟判断

        Args:
            market: 市场 'cn' 或 'us'
            start: 起始日期 (YYYY-MM)
            end: 结束日期 (YYYY-MM)
            freq: 频率 'Q'(季度) 或 'M'(月度)

        Returns:
            list of PhaseResult.to_dict()
        """
        # 生成日期序列
        date_range = pd.date_range(start=start, end=end, freq=freq)
        results = []

        for date in date_range:
            as_of = date.strftime("%Y-%m")
            try:
                result = self.judge_phase(market=market, as_of=as_of)
                result_dict = result.to_dict()
                result_dict["as_of"] = as_of
                results.append(result_dict)
            except Exception as e:
                logger.error(f"历史判断 {as_of} 失败: {e}")
                continue

        return results
