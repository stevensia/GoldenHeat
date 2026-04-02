"""美国宏观经济数据采集 — 基于 fredapi

采集指标：
- CPI (CPIAUCSL) — 消费者物价指数
- GDP 增速 (GDP)
- 联邦基金利率 (FEDFUNDS)
- 非农就业 (PAYEMS) — 可选

需要 FRED_API_KEY，从 https://fred.stlouisfed.org/docs/api/api_key.html 获取
"""

import logging
from datetime import datetime, timedelta

import pandas as pd

from backend.config import FRED_API_KEY
from backend.db.connection import get_db
from backend.repos.macro_repo import MacroRepo

logger = logging.getLogger(__name__)


class MacroUSCollector:
    """美国宏观数据采集器（FRED）"""

    # FRED 系列 ID 映射
    SERIES = {
        "us_cpi": "CPIAUCSL",       # CPI 城市消费者（季调）
        "us_gdp": "GDP",             # 名义 GDP（季度）
        "us_fed_rate": "FEDFUNDS",   # 联邦基金有效利率
        "us_payroll": "PAYEMS",      # 非农就业（千人）
    }

    def __init__(self, years: int = 10):
        self.years = years
        self.fred = None
        self.macro_repo = MacroRepo()

        if not FRED_API_KEY or FRED_API_KEY == "your_fred_api_key_here":
            logger.warning("⚠️ FRED_API_KEY 未配置，跳过美国宏观数据采集")
        else:
            try:
                from fredapi import Fred
                self.fred = Fred(api_key=FRED_API_KEY)
                logger.info("✅ FRED API 连接成功")
            except Exception as e:
                logger.error(f"❌ FRED API 初始化失败: {e}")

    def _save_indicator(self, indicator: str, data: list[tuple[str, float]], source: str = "fred"):
        """将指标数据写入 macro_data 表（通过 MacroRepo）"""
        if not data:
            return 0
        inserted = self.macro_repo.save_indicator_batch(indicator, data, source=source)
        logger.info(f"✅ {indicator}: 写入 {inserted} 条数据")
        return inserted

    def _fetch_series(self, indicator: str, series_id: str) -> int:
        """拉取单个 FRED 系列数据

        Args:
            indicator: 本地指标名 (如 'us_cpi')
            series_id: FRED 系列 ID (如 'CPIAUCSL')

        Returns:
            写入条数
        """
        if not self.fred:
            return 0

        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=self.years * 365)

            logger.info(f"拉取 FRED {series_id} ({indicator})...")
            series = self.fred.get_series(
                series_id,
                observation_start=start_date.strftime("%Y-%m-%d"),
                observation_end=end_date.strftime("%Y-%m-%d"),
            )

            if series is None or series.empty:
                logger.warning(f"{indicator} ({series_id}) 返回空数据")
                return 0

            # 转换为 (date_str, value) 列表
            data = []
            for date_idx, value in series.items():
                if pd.notna(value):
                    date_str = pd.to_datetime(date_idx).strftime("%Y-%m")
                    data.append((date_str, float(value)))

            return self._save_indicator(indicator, data)

        except Exception as e:
            logger.error(f"❌ {indicator} ({series_id}) 采集失败: {e}")
            return 0

    def collect_cpi(self) -> int:
        """采集 CPI 数据（CPIAUCSL）

        注意：FRED 的 CPIAUCSL 是绝对值，需要计算同比变化率
        """
        if not self.fred:
            return 0

        try:
            end_date = datetime.now()
            # 多拉一年用于计算同比
            start_date = end_date - timedelta(days=(self.years + 1) * 365)

            series = self.fred.get_series(
                "CPIAUCSL",
                observation_start=start_date.strftime("%Y-%m-%d"),
                observation_end=end_date.strftime("%Y-%m-%d"),
            )

            if series is None or series.empty:
                return 0

            # 计算同比变化率 (%)
            df = series.to_frame(name="cpi")
            df["cpi_yoy"] = df["cpi"].pct_change(periods=12) * 100  # 12个月同比

            data = []
            for date_idx, row in df.iterrows():
                if pd.notna(row["cpi_yoy"]):
                    date_str = pd.to_datetime(date_idx).strftime("%Y-%m")
                    data.append((date_str, float(row["cpi_yoy"])))

            return self._save_indicator("us_cpi", data)

        except Exception as e:
            logger.error(f"❌ US CPI 采集失败: {e}")
            return 0

    def collect_gdp(self) -> int:
        """采集 GDP 数据并计算同比增速"""
        if not self.fred:
            return 0

        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=(self.years + 1) * 365)

            series = self.fred.get_series(
                "GDP",
                observation_start=start_date.strftime("%Y-%m-%d"),
                observation_end=end_date.strftime("%Y-%m-%d"),
            )

            if series is None or series.empty:
                return 0

            # 计算同比增速 (%, 4 季度 = 1 年)
            df = series.to_frame(name="gdp")
            df["gdp_yoy"] = df["gdp"].pct_change(periods=4) * 100

            data = []
            for date_idx, row in df.iterrows():
                if pd.notna(row["gdp_yoy"]):
                    date_str = pd.to_datetime(date_idx).strftime("%Y-%m")
                    data.append((date_str, float(row["gdp_yoy"])))

            return self._save_indicator("us_gdp", data)

        except Exception as e:
            logger.error(f"❌ US GDP 采集失败: {e}")
            return 0

    def collect_fed_rate(self) -> int:
        """采集联邦基金利率"""
        return self._fetch_series("us_fed_rate", "FEDFUNDS")

    def collect_payroll(self) -> int:
        """采集非农就业数据（可选）"""
        return self._fetch_series("us_payroll", "PAYEMS")

    def collect_all(self) -> dict:
        """采集所有美国宏观数据

        Returns:
            dict: {指标名: 写入条数}
        """
        if not self.fred:
            logger.warning("⚠️ FRED 未初始化，跳过所有美国宏观数据")
            return {"us_cpi": 0, "us_gdp": 0, "us_fed_rate": 0, "us_payroll": 0}

        results = {}
        collectors = [
            ("us_cpi", self.collect_cpi),
            ("us_gdp", self.collect_gdp),
            ("us_fed_rate", self.collect_fed_rate),
            ("us_payroll", self.collect_payroll),
        ]

        for name, func in collectors:
            try:
                results[name] = func()
            except Exception as e:
                logger.error(f"❌ {name} 采集异常: {e}")
                results[name] = 0

        total = sum(results.values())
        logger.info(f"🇺🇸 美国宏观数据采集完成: 共写入 {total} 条")
        return results
