"""中国宏观经济数据采集 — 基于 akshare

采集指标：
- CPI 同比 (cn_cpi) — macro_china_cpi_yearly
- PPI 同比 (cn_ppi) — macro_china_ppi_yearly
- PMI 制造业 (cn_pmi) — macro_china_pmi_yearly
- GDP 增速 (cn_gdp) — macro_china_gdp_yearly（季度）
- M2 增速 (cn_m2) — macro_china_m2_yearly
- LPR 利率 (cn_lpr) — macro_china_lpr

注意: akshare 接口经常变更，失败时跳过并标记 TODO
"""

import logging
from datetime import datetime

import pandas as pd

from backend.db.connection import get_db

logger = logging.getLogger(__name__)


def _safe_import_akshare():
    """安全导入 akshare，失败时返回 None"""
    try:
        import akshare as ak
        return ak
    except ImportError:
        logger.error("akshare 未安装，跳过中国宏观数据采集")
        return None


class MacroCNCollector:
    """中国宏观数据采集器"""

    def __init__(self):
        self.ak = _safe_import_akshare()

    def _save_indicator(self, indicator: str, data: list[tuple[str, float]], source: str = "akshare"):
        """将指标数据写入 macro_data 表

        Args:
            indicator: 指标名 (如 'cn_cpi')
            data: [(date_str, value), ...] 列表
            source: 数据源名称
        """
        if not data:
            return 0

        conn = get_db()
        inserted = 0
        for date_str, value in data:
            try:
                conn.execute(
                    """INSERT INTO macro_data (indicator, date, value, source)
                       VALUES (?, ?, ?, ?)
                       ON CONFLICT(indicator, date) DO UPDATE SET
                           value=excluded.value, source=excluded.source,
                           fetched_at=datetime('now')
                    """,
                    (indicator, date_str, float(value), source),
                )
                inserted += 1
            except Exception as e:
                logger.error(f"写入 {indicator} {date_str} 失败: {e}")

        conn.commit()
        logger.info(f"✅ {indicator}: 写入 {inserted} 条数据")
        return inserted

    def _collect_yearly_format(self, indicator: str, func_name: str) -> int:
        """通用采集方法: 处理 akshare _yearly 格式

        这类接口返回格式: ['商品', '日期', '今值', '预测值', '前值']
        日期列为发布日期，今值为实际数据值
        """
        if not self.ak:
            return 0
        try:
            func = getattr(self.ak, func_name, None)
            if func is None:
                logger.error(f"❌ akshare 无 {func_name} 接口")
                return 0

            df = func()
            if df is None or df.empty:
                logger.warning(f"{indicator} 数据为空")
                return 0

            data = []
            for _, row in df.iterrows():
                try:
                    # 日期列（发布日期，用于定位月份）
                    date_val = row.iloc[1]  # '日期' 列
                    value_val = row.iloc[2]  # '今值' 列

                    # 跳过空值
                    if pd.isna(value_val):
                        continue

                    # 解析日期为 YYYY-MM
                    dt = pd.to_datetime(date_val)
                    date_str = dt.strftime("%Y-%m")

                    data.append((date_str, float(value_val)))
                except Exception:
                    continue

            return self._save_indicator(indicator, data)

        except Exception as e:
            # TODO: akshare 接口可能变更，需要定期检查
            logger.error(f"❌ {indicator} 采集失败（{func_name}）: {e}")
            return 0

    def collect_cpi(self) -> int:
        """采集 CPI 同比数据"""
        return self._collect_yearly_format("cn_cpi", "macro_china_cpi_yearly")

    def collect_ppi(self) -> int:
        """采集 PPI 同比数据"""
        return self._collect_yearly_format("cn_ppi", "macro_china_ppi_yearly")

    def collect_pmi(self) -> int:
        """采集 PMI 制造业数据"""
        return self._collect_yearly_format("cn_pmi", "macro_china_pmi_yearly")

    def collect_gdp(self) -> int:
        """采集 GDP 增速数据（季度）"""
        return self._collect_yearly_format("cn_gdp", "macro_china_gdp_yearly")

    def collect_m2(self) -> int:
        """采集 M2 增速数据"""
        return self._collect_yearly_format("cn_m2", "macro_china_m2_yearly")

    def collect_lpr(self) -> int:
        """采集 LPR 利率数据"""
        if not self.ak:
            return 0
        try:
            df = self.ak.macro_china_lpr()
            if df is None or df.empty:
                logger.warning("LPR 数据为空")
                return 0

            data = []
            for _, row in df.iterrows():
                try:
                    date_val = row.iloc[0]
                    # 1年期LPR 通常在第二列
                    value_val = row.iloc[1]

                    # 跳过 NaN 值
                    if pd.isna(value_val):
                        continue

                    dt = pd.to_datetime(date_val)
                    data.append((dt.strftime("%Y-%m"), float(value_val)))
                except Exception:
                    continue

            return self._save_indicator("cn_lpr", data)

        except Exception as e:
            # TODO: akshare 接口可能变更
            logger.error(f"❌ LPR 采集失败: {e}")
            return 0

    def collect_all(self) -> dict:
        """采集所有中国宏观数据

        Returns:
            dict: {指标名: 写入条数}
        """
        results = {}
        collectors = [
            ("cn_cpi", self.collect_cpi),
            ("cn_ppi", self.collect_ppi),
            ("cn_pmi", self.collect_pmi),
            ("cn_gdp", self.collect_gdp),
            ("cn_m2", self.collect_m2),
            ("cn_lpr", self.collect_lpr),
        ]

        for name, func in collectors:
            try:
                results[name] = func()
            except Exception as e:
                logger.error(f"❌ {name} 采集异常: {e}")
                results[name] = 0

        total = sum(results.values())
        logger.info(f"🇨🇳 中国宏观数据采集完成: 共写入 {total} 条")
        return results
