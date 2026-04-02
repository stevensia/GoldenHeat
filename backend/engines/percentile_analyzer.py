"""百分位分析引擎

从 index_pe 表计算 PE 百分位:
- 5 年 / 10 年百分位 (rank / total)
- 估值区间: <20% 极度低估 ... >80% 极度高估
- PE 历史时间序列
"""

import logging
from typing import Optional

from backend.db.connection import fetchall, fetchone

logger = logging.getLogger(__name__)

# 指数名称映射
INDEX_NAMES: dict[str, str] = {
    "000001.SS": "上证指数",
    "000016.SS": "上证50",
    "000300.SS": "沪深300",
    "000852.SS": "中证1000",
    "000905.SS": "中证500",
    "000906.SS": "中证800",
    "399673.SZ": "创业板50",
    "^GSPC": "S&P 500",
}

# 估值区间
ZONE_THRESHOLDS = [
    (20, "极度低估", "#16a34a"),
    (40, "低估", "#4ade80"),
    (60, "正常", "#6b7280"),
    (80, "高估", "#f59e0b"),
    (100, "极度高估", "#ef4444"),
]


def _get_zone(percentile: float) -> tuple[str, str]:
    """根据百分位返回 (zone_label, zone_color)"""
    for threshold, label, color in ZONE_THRESHOLDS:
        if percentile < threshold:
            return label, color
    return "极度高估", "#ef4444"


class PercentileAnalyzer:
    """PE 百分位分析器"""

    def calc_percentile(self, symbol: str, window_years: int = 10) -> Optional[dict]:
        """计算单个标的的 PE 百分位

        Args:
            symbol: 标的代码
            window_years: 回看窗口 (年)

        Returns:
            {symbol, name, pe_ttm, pe_pct_5y, pe_pct_10y, zone, zone_color, latest_date,
             pe_avg, pe_min, pe_max}
        """
        # 获取最新 PE
        latest = fetchone(
            "SELECT pe_ttm, pe_static, date FROM index_pe "
            "WHERE symbol = ? AND pe_ttm IS NOT NULL "
            "ORDER BY date DESC LIMIT 1",
            (symbol,),
        )
        if not latest or latest["pe_ttm"] is None:
            return None

        current_pe = latest["pe_ttm"]
        latest_date = latest["date"]

        # 5 年百分位
        pct_5y = self._rank_percentile(symbol, current_pe, 5)
        # 10 年百分位
        pct_10y = self._rank_percentile(symbol, current_pe, 10)

        # 统计值 (5 年)
        stats = fetchone(
            "SELECT AVG(pe_ttm) as avg_pe, MIN(pe_ttm) as min_pe, MAX(pe_ttm) as max_pe "
            "FROM index_pe "
            "WHERE symbol = ? AND pe_ttm IS NOT NULL "
            "AND date >= date(?, '-5 years')",
            (symbol, latest_date),
        )

        # 用 10 年百分位判断估值区间
        zone_pct = pct_10y if pct_10y is not None else (pct_5y or 50)
        zone_label, zone_color = _get_zone(zone_pct)

        return {
            "symbol": symbol,
            "name": INDEX_NAMES.get(symbol, symbol),
            "pe_ttm": round(current_pe, 2),
            "pe_pct_5y": round(pct_5y, 1) if pct_5y is not None else None,
            "pe_pct_10y": round(pct_10y, 1) if pct_10y is not None else None,
            "zone": zone_label,
            "zone_color": zone_color,
            "latest_date": latest_date,
            "pe_5y_avg": round(stats["avg_pe"], 2) if stats and stats["avg_pe"] else None,
            "pe_5y_min": round(stats["min_pe"], 2) if stats and stats["min_pe"] else None,
            "pe_5y_max": round(stats["max_pe"], 2) if stats and stats["max_pe"] else None,
        }

    def _rank_percentile(
        self, symbol: str, current_pe: float, years: int
    ) -> Optional[float]:
        """计算 rank 百分位: 过去 N 年中，低于当前 PE 的占比"""
        row = fetchone(
            "SELECT COUNT(*) as total, "
            "SUM(CASE WHEN pe_ttm < ? THEN 1 ELSE 0 END) as below "
            "FROM index_pe "
            "WHERE symbol = ? AND pe_ttm IS NOT NULL "
            "AND date >= date('now', ? || ' years')",
            (current_pe, symbol, f"-{years}"),
        )
        if not row or row["total"] == 0:
            return None
        return (row["below"] / row["total"]) * 100

    def get_overview(self, symbols: Optional[list[str]] = None) -> list[dict]:
        """获取多个标的的估值总览

        Args:
            symbols: 标的列表，为 None 时返回所有 index_pe 中的标的

        Returns:
            list of calc_percentile results
        """
        if symbols is None:
            rows = fetchall(
                "SELECT DISTINCT symbol FROM index_pe ORDER BY symbol"
            )
            symbols = [r["symbol"] for r in rows]

        results = []
        for sym in symbols:
            try:
                data = self.calc_percentile(sym)
                if data:
                    results.append(data)
            except Exception as e:
                logger.warning(f"计算 {sym} 百分位失败: {e}")
        return results

    def get_pe_history(self, symbol: str, months: int = 120) -> list[dict]:
        """获取 PE 历史时间序列

        Args:
            symbol: 标的代码
            months: 返回最近 N 个月

        Returns:
            [{date, pe_ttm, pe_static, pe_median, index_value}, ...]
        """
        rows = fetchall(
            "SELECT date, pe_ttm, pe_static, pe_median, index_value "
            "FROM index_pe "
            "WHERE symbol = ? AND pe_ttm IS NOT NULL "
            "ORDER BY date DESC "
            "LIMIT ?",
            (symbol, months * 22),  # 每月约 22 个交易日
        )

        data = [
            {
                "date": r["date"],
                "pe_ttm": round(r["pe_ttm"], 2) if r["pe_ttm"] else None,
                "pe_static": round(r["pe_static"], 2) if r["pe_static"] else None,
                "pe_median": round(r["pe_median"], 2) if r["pe_median"] else None,
                "index_value": round(r["index_value"], 2) if r["index_value"] else None,
            }
            for r in rows
        ]
        data.reverse()  # 按日期升序
        return data
