"""指数 PE/PB 估值数据采集

数据源:
  1. akshare stock_index_pe_lg — 乐咕乐股 PE (A股: 沪深300/上证50/中证500 等, 5000+ 日数据)
  2. akshare stock_index_pb_lg — 乐咕乐股 PB (同上)
  3. akshare stock_zh_index_value_csindex — 中证指数公司 (近20日, 上证综指等)
  4. multpl.com — S&P 500 PE (月度, 1870 至今)
  5. multpl.com — S&P 500 PB (月度)

存储: index_pe 表 (symbol, date, pe_ttm, pe_static, pb, dividend_yield, source)
"""

import logging
import re
from datetime import datetime
from html import unescape
from typing import Optional

import httpx
import pandas as pd

from backend.db.connection import get_db

logger = logging.getLogger(__name__)

# A 股指数 → akshare 中文名映射 (stock_index_pe_lg 和 stock_index_pb_lg 均使用中文名)
A_SHARE_INDICES = {
    "000300.SS": "沪深300",
    "000016.SS": "上证50",
    "000905.SS": "中证500",
    "000852.SS": "中证1000",
    "399673.SZ": "创业板50",
    "000906.SS": "中证800",
}

# 上证综指 → csindex 代码 (乐咕乐股不支持上证综指)
CSINDEX_INDICES = {
    "000001.SS": "000001",
}


def _safe_import_akshare():
    try:
        import akshare as ak
        return ak
    except ImportError:
        return None


class IndexPECollector:
    """指数 PE/PB 估值采集器"""

    def __init__(self):
        self.ak = _safe_import_akshare()

    def _ensure_table(self):
        """确保 index_pe 表存在"""
        conn = get_db()
        conn.execute("""
            CREATE TABLE IF NOT EXISTS index_pe (
                symbol TEXT NOT NULL,
                date TEXT NOT NULL,
                pe_ttm REAL,
                pe_static REAL,
                pe_median REAL,
                pb REAL,
                dividend_yield REAL,
                index_value REAL,
                source TEXT DEFAULT 'akshare',
                fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (symbol, date)
            )
        """)
        conn.commit()

    def _save_batch(self, symbol: str, data: list[dict], source: str = "akshare") -> int:
        """批量写入"""
        if not data:
            return 0
        self._ensure_table()
        conn = get_db()
        inserted = 0
        for row in data:
            try:
                conn.execute("""
                    INSERT INTO index_pe (symbol, date, pe_ttm, pe_static, pe_median, pb, dividend_yield, index_value, source)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(symbol, date) DO UPDATE SET
                        pe_ttm=COALESCE(excluded.pe_ttm, index_pe.pe_ttm),
                        pe_static=COALESCE(excluded.pe_static, index_pe.pe_static),
                        pe_median=COALESCE(excluded.pe_median, index_pe.pe_median),
                        pb=COALESCE(excluded.pb, index_pe.pb),
                        dividend_yield=COALESCE(excluded.dividend_yield, index_pe.dividend_yield),
                        index_value=COALESCE(excluded.index_value, index_pe.index_value),
                        source=excluded.source, fetched_at=datetime('now')
                """, (
                    symbol, row["date"],
                    row.get("pe_ttm"), row.get("pe_static"), row.get("pe_median"),
                    row.get("pb"), row.get("dividend_yield"), row.get("index_value"),
                    source,
                ))
                inserted += 1
            except Exception as e:
                logger.error(f"写入 {symbol} {row.get('date')} 失败: {e}")
        conn.commit()
        return inserted

    # ──────── A 股指数 PE (乐咕乐股) ────────
    def collect_ashare_pe(self) -> dict:
        """采集 A 股指数 PE (乐咕乐股, 日频, 5000+条)"""
        if not self.ak:
            return {}
        results = {}
        for symbol, name in A_SHARE_INDICES.items():
            try:
                df = self.ak.stock_index_pe_lg(symbol=name)
                if df is None or df.empty:
                    continue
                data = []
                for _, row in df.iterrows():
                    date_str = str(row["日期"])[:10]
                    data.append({
                        "date": date_str,
                        "pe_ttm": float(row["滚动市盈率"]) if pd.notna(row.get("滚动市盈率")) else None,
                        "pe_static": float(row["静态市盈率"]) if pd.notna(row.get("静态市盈率")) else None,
                        "pe_median": float(row["滚动市盈率中位数"]) if pd.notna(row.get("滚动市盈率中位数")) else None,
                        "index_value": float(row["指数"]) if pd.notna(row.get("指数")) else None,
                    })
                n = self._save_batch(symbol, data, "legulegu")
                results[symbol] = n
                logger.info(f"✅ {name} ({symbol}) PE: {n} 条")
            except Exception as e:
                logger.error(f"❌ {name} PE 采集失败: {e}")
                results[symbol] = 0
        return results

    # ──────── A 股指数 PB (乐咕乐股) ────────
    def collect_ashare_pb(self) -> dict:
        """采集 A 股指数 PB (乐咕乐股, 日频)"""
        if not self.ak:
            return {}
        results = {}
        for symbol, name in A_SHARE_INDICES.items():
            try:
                df = self.ak.stock_index_pb_lg(symbol=name)
                if df is None or df.empty:
                    continue
                data = []
                for _, row in df.iterrows():
                    date_str = str(row["日期"])[:10]
                    data.append({
                        "date": date_str,
                        "pb": float(row["市净率"]) if pd.notna(row.get("市净率")) else None,
                        "index_value": float(row["指数"]) if pd.notna(row.get("指数")) else None,
                    })
                n = self._save_batch(symbol, data, "legulegu")
                results[symbol] = n
                logger.info(f"✅ {name} ({symbol}) PB: {n} 条")
            except Exception as e:
                logger.error(f"❌ {name} PB 采集失败: {e}")
                results[symbol] = 0
        return results

    # ──────── 上证综指 (中证指数公司) ────────
    def collect_csindex(self) -> dict:
        """采集上证综指等 (csindex, 近20日)"""
        if not self.ak:
            return {}
        results = {}
        for symbol, code in CSINDEX_INDICES.items():
            try:
                df = self.ak.stock_zh_index_value_csindex(symbol=code)
                if df is None or df.empty:
                    continue
                data = []
                for _, row in df.iterrows():
                    date_str = str(row["日期"])[:10]
                    data.append({
                        "date": date_str,
                        "pe_ttm": float(row["市盈率1"]) if pd.notna(row.get("市盈率1")) else None,
                        "pe_static": float(row["市盈率2"]) if pd.notna(row.get("市盈率2")) else None,
                        "dividend_yield": float(row["股息率1"]) if pd.notna(row.get("股息率1")) else None,
                    })
                n = self._save_batch(symbol, data, "csindex")
                results[symbol] = n
                logger.info(f"✅ 上证综指 ({symbol}): {n} 条")
            except Exception as e:
                logger.error(f"❌ csindex {symbol}: {e}")
                results[symbol] = 0
        return results

    # ──────── S&P 500 PE (multpl.com) ────────
    def _scrape_multpl(self, url: str) -> list[tuple]:
        """通用 multpl.com 抓取: 返回 [(date_str, value), ...]"""
        try:
            r = httpx.get(url, timeout=15,
                headers={"User-Agent": "Mozilla/5.0 (compatible; GoldenHeat/2.1)"})
            if r.status_code != 200:
                logger.error(f"multpl.com HTTP {r.status_code}: {url}")
                return []
            tables = re.findall(r"<table.*?</table>", r.text, re.DOTALL)
            if not tables:
                return []
            results = []
            rows = re.findall(r"<tr[^>]*>(.*?)</tr>", tables[0], re.DOTALL)
            for row_html in rows:
                cells = re.findall(r"<td[^>]*>(.*?)</td>", row_html, re.DOTALL)
                if len(cells) < 2:
                    continue
                date_text = cells[0].strip()
                val_text = unescape(re.sub(r"<[^>]+>", "", cells[1])).strip()
                num_match = re.search(r"([\d.]+)", val_text)
                if not num_match:
                    continue
                try:
                    dt = pd.to_datetime(date_text)
                    val = float(num_match.group(1))
                    results.append((dt.strftime("%Y-%m-%d"), val))
                except (ValueError, TypeError):
                    continue
            return results
        except Exception as e:
            logger.error(f"❌ multpl.com 抓取失败 ({url}): {e}")
            return []

    def collect_sp500_pe(self) -> int:
        """采集 S&P 500 PE (multpl.com, 月度, 150年)"""
        pairs = self._scrape_multpl("https://www.multpl.com/s-p-500-pe-ratio/table/by-month")
        data = [{"date": d, "pe_ttm": v} for d, v in pairs]
        n = self._save_batch("^GSPC", data, "multpl.com")
        logger.info(f"✅ S&P 500 PE: {n} 条 (multpl.com)")
        return n

    def collect_sp500_pb(self) -> int:
        """采集 S&P 500 PB (multpl.com)"""
        pairs = self._scrape_multpl("https://www.multpl.com/s-p-500-price-to-book-value-ratio/table/by-month")
        data = [{"date": d, "pb": v} for d, v in pairs]
        n = self._save_batch("^GSPC", data, "multpl.com")
        logger.info(f"✅ S&P 500 PB: {n} 条 (multpl.com)")
        return n

    # ──────── collect_all ────────
    def collect_all(self) -> dict:
        """采集所有指数 PE + PB"""
        results = {}

        # A 股 PE (乐咕乐股)
        pe_results = self.collect_ashare_pe()
        results.update(pe_results)

        # A 股 PB (乐咕乐股)
        pb_results = self.collect_ashare_pb()
        for k, v in pb_results.items():
            results[f"{k}_pb"] = v

        # 上证综指 (csindex)
        cs_results = self.collect_csindex()
        results.update(cs_results)

        # S&P 500 PE + PB
        results["^GSPC_pe"] = self.collect_sp500_pe()
        results["^GSPC_pb"] = self.collect_sp500_pb()

        total = sum(results.values())
        logger.info(f"📊 指数 PE/PB 采集完成: {len(results)} 项, {total} 条数据")
        return results


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    collector = IndexPECollector()
    collector.collect_all()
