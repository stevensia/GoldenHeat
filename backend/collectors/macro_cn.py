"""中国宏观经济数据采集 — 基于 akshare

数据源优先级:
  1. NBS 直接接口 (macro_china_cpi/ppi/pmi/gdp) — 更新最快，到月级别
  2. NBS 货币统计 (macro_china_supply_of_money) — M2 到月级别
  3. investing.com 接口 (*_yearly) — 备选

采集指标:
  - CPI 同比 (cn_cpi) — macro_china_cpi
  - PPI 同比 (cn_ppi) — macro_china_ppi
  - PMI 制造业 (cn_pmi) — macro_china_pmi
  - GDP 增速 (cn_gdp) — macro_china_gdp
  - M2 增速 (cn_m2) — macro_china_supply_of_money
  - LPR 利率 (cn_lpr) — macro_china_lpr
"""

import logging
import re
from datetime import datetime
from typing import Optional

import pandas as pd

from backend.db.connection import get_db

logger = logging.getLogger(__name__)


def _safe_import_akshare():
    try:
        import akshare as ak
        return ak
    except ImportError:
        logger.error("akshare 未安装，跳过中国宏观数据采集")
        return None


def _parse_cn_period(text: str) -> Optional[str]:
    """解析中文时间表达式为 YYYY-MM 格式

    支持: '2026年02月份', '2026年第1-4季度', '2026.2' 等
    """
    text = str(text).strip()

    # 2026年02月份
    m = re.match(r"(\d{4})年(\d{1,2})月", text)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}"

    # 2026.2 (NBS supply_of_money 格式)
    m = re.match(r"(\d{4})\.(\d{1,2})", text)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}"

    # 2025年第1-4季度 → 取最后的季度作为月份
    m = re.match(r"(\d{4})年第\d+-(\d)季度", text)
    if m:
        q = int(m.group(2))
        month = q * 3  # Q1→3, Q2→6, Q3→9, Q4→12
        return f"{m.group(1)}-{month:02d}"

    # 2025年第1季度
    m = re.match(r"(\d{4})年第(\d)季度", text)
    if m:
        q = int(m.group(2))
        month = q * 3
        return f"{m.group(1)}-{month:02d}"

    # ISO date (2025-07-15)
    m = re.match(r"(\d{4})-(\d{2})", text)
    if m:
        return f"{m.group(1)}-{m.group(2)}"

    return None


class MacroCNCollector:
    """中国宏观数据采集器 — NBS 优先, investing.com 备选"""

    def __init__(self):
        self.ak = _safe_import_akshare()

    def _save_indicator(self, indicator: str, data: list[tuple[str, float]], source: str = "akshare") -> int:
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
                           fetched_at=datetime('now')""",
                    (indicator, date_str, float(value), source),
                )
                inserted += 1
            except Exception as e:
                logger.error(f"写入 {indicator} {date_str} 失败: {e}")
        conn.commit()
        logger.info(f"✅ {indicator}: 写入 {inserted} 条 (source={source})")
        return inserted

    # ──────────────── CPI ────────────────
    def collect_cpi(self) -> int:
        """CPI 同比 — 优先 NBS 直接接口"""
        if not self.ak:
            return 0

        # 方法1: NBS 直接 (macro_china_cpi) — 数据到月, 2026-02
        try:
            df = self.ak.macro_china_cpi()
            if df is not None and not df.empty:
                data = []
                for _, row in df.iterrows():
                    period = _parse_cn_period(row.iloc[0])  # '月份' col
                    value = row["全国-同比增长"]
                    if period and pd.notna(value):
                        data.append((period, float(value)))
                if data:
                    logger.info(f"CPI: NBS直接接口 {len(data)} 条, 最新 {data[0][0]}")
                    return self._save_indicator("cn_cpi", data, "nbs")
        except Exception as e:
            logger.warning(f"CPI NBS直接失败: {e}")

        # 方法2: investing.com (macro_china_cpi_yearly)
        return self._collect_investing("cn_cpi", "macro_china_cpi_yearly")

    # ──────────────── PPI ────────────────
    def collect_ppi(self) -> int:
        """PPI 同比 — 优先 NBS 直接接口"""
        if not self.ak:
            return 0

        try:
            df = self.ak.macro_china_ppi()
            if df is not None and not df.empty:
                data = []
                for _, row in df.iterrows():
                    period = _parse_cn_period(row.iloc[0])
                    value = row["当月同比增长"]
                    if period and pd.notna(value):
                        data.append((period, float(value)))
                if data:
                    logger.info(f"PPI: NBS直接接口 {len(data)} 条, 最新 {data[0][0]}")
                    return self._save_indicator("cn_ppi", data, "nbs")
        except Exception as e:
            logger.warning(f"PPI NBS直接失败: {e}")

        return self._collect_investing("cn_ppi", "macro_china_ppi_yearly")

    # ──────────────── PMI ────────────────
    def collect_pmi(self) -> int:
        """PMI 制造业 — 优先 NBS 直接接口"""
        if not self.ak:
            return 0

        try:
            df = self.ak.macro_china_pmi()
            if df is not None and not df.empty:
                data = []
                for _, row in df.iterrows():
                    period = _parse_cn_period(row.iloc[0])
                    value = row["制造业-指数"]
                    if period and pd.notna(value):
                        data.append((period, float(value)))
                if data:
                    logger.info(f"PMI: NBS直接接口 {len(data)} 条, 最新 {data[0][0]}")
                    return self._save_indicator("cn_pmi", data, "nbs")
        except Exception as e:
            logger.warning(f"PMI NBS直接失败: {e}")

        return self._collect_investing("cn_pmi", "macro_china_pmi_yearly")

    # ──────────────── GDP ────────────────
    def collect_gdp(self) -> int:
        """GDP 同比增速 — 优先 NBS 直接接口"""
        if not self.ak:
            return 0

        try:
            df = self.ak.macro_china_gdp()
            if df is not None and not df.empty:
                data = []
                for _, row in df.iterrows():
                    period = _parse_cn_period(row["季度"])
                    value = row["国内生产总值-同比增长"]
                    if period and pd.notna(value):
                        data.append((period, float(value)))
                if data:
                    logger.info(f"GDP: NBS直接接口 {len(data)} 条, 最新 {data[0][0]}")
                    return self._save_indicator("cn_gdp", data, "nbs")
        except Exception as e:
            logger.warning(f"GDP NBS直接失败: {e}")

        return self._collect_investing("cn_gdp", "macro_china_gdp_yearly")

    # ──────────────── M2 ────────────────
    def collect_m2(self) -> int:
        """M2 同比增速 — 优先 NBS supply_of_money"""
        if not self.ak:
            return 0

        try:
            df = self.ak.macro_china_supply_of_money()
            if df is not None and not df.empty:
                data = []
                for _, row in df.iterrows():
                    period = _parse_cn_period(row["统计时间"])
                    value = row["货币和准货币（广义货币M2）同比增长"]
                    if period and pd.notna(value):
                        data.append((period, float(value)))
                if data:
                    logger.info(f"M2: NBS货币统计 {len(data)} 条, 最新 {data[0][0]}")
                    return self._save_indicator("cn_m2", data, "nbs")
        except Exception as e:
            logger.warning(f"M2 NBS失败: {e}")

        return self._collect_investing("cn_m2", "macro_china_m2_yearly")

    # ──────────────── LPR ────────────────
    def collect_lpr(self) -> int:
        if not self.ak:
            return 0
        try:
            df = self.ak.macro_china_lpr()
            if df is None or df.empty:
                return 0
            data = []
            for _, row in df.iterrows():
                try:
                    dt = pd.to_datetime(row.iloc[0])
                    value = row.iloc[1]  # 1年期 LPR
                    if pd.notna(value):
                        data.append((dt.strftime("%Y-%m"), float(value)))
                except Exception:
                    continue
            return self._save_indicator("cn_lpr", data, "nbs")
        except Exception as e:
            logger.error(f"❌ LPR 采集失败: {e}")
            return 0

    # ──────────────── 备选: investing.com ────────────────
    def _collect_investing(self, indicator: str, func_name: str) -> int:
        """备选采集: investing.com 格式 (商品/日期/今值/预测值/前值)"""
        if not self.ak:
            return 0
        try:
            func = getattr(self.ak, func_name, None)
            if not func:
                logger.error(f"❌ akshare 无 {func_name}")
                return 0
            df = func()
            if df is None or df.empty:
                return 0
            data = []
            for _, row in df.iterrows():
                try:
                    date_val = row.iloc[1]
                    value_val = row.iloc[2]
                    if pd.isna(value_val):
                        continue
                    dt = pd.to_datetime(date_val)
                    data.append((dt.strftime("%Y-%m"), float(value_val)))
                except Exception:
                    continue
            return self._save_indicator(indicator, data, "investing.com")
        except Exception as e:
            logger.error(f"❌ {indicator} investing.com 采集失败: {e}")
            return 0

    # ──────────────── collect_all ────────────────
    def collect_all(self) -> dict:
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
