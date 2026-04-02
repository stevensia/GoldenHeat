"""技术分析引擎

从 monthly_kline 表读取 K 线数据，计算:
- SMA (5/10/20)
- RSI (14)
- MACD (12, 26, 9)
- 布林带 (20, 2σ)
- KDJ (9, 3, 3)
- ATR (14)
- 成交量分析
- 综合评分 (-8 to +8)
- 关键价位 (支撑/阻力)
"""

import logging
from typing import Optional

import numpy as np
import pandas as pd

from backend.db.connection import fetchall

logger = logging.getLogger(__name__)

# 标的名称
SYMBOL_NAMES: dict[str, str] = {
    "NVDA": "英伟达",
    "TSLA": "特斯拉",
    "MSFT": "微软",
    "0700.HK": "腾讯",
    "9988.HK": "阿里巴巴",
    "BTC-USD": "比特币",
    "^GSPC": "标普500",
    "000001.SS": "上证指数",
    "^HSI": "恒生指数",
}


class TechnicalAnalyzer:
    """月线技术分析"""

    def analyze(self, symbol: str) -> Optional[dict]:
        """完整技术分析

        Returns:
            {symbol, name, price, trend, composite_score, composite_signal,
             indicators, key_levels, alerts}
        """
        df = self._load_kline(symbol)
        if df is None or len(df) < 20:
            logger.warning(f"数据不足 [{symbol}]: {len(df) if df is not None else 0} 条")
            return None

        # 计算所有指标
        df = self._calc_sma(df)
        df = self._calc_rsi(df)
        df = self._calc_macd(df)
        df = self._calc_bollinger(df)
        df = self._calc_kdj(df)
        df = self._calc_atr(df)

        latest = df.iloc[-1]
        prev = df.iloc[-2] if len(df) >= 2 else latest

        # 逐项评分
        indicators = []
        indicators.append(self._score_trend(df, latest))
        indicators.append(self._score_momentum(latest))
        indicators.append(self._score_volume(df, latest))
        indicators.append(self._score_macd(latest, prev))
        indicators.append(self._score_bollinger(latest))
        indicators.append(self._score_kdj(latest))
        indicators.append(self._score_ma_support(latest))
        indicators.append(self._score_volatility(df, latest))
        indicators.append(self._score_volume_trend(df))

        composite = sum(ind["score"] for ind in indicators)
        composite_signal = (
            "强烈看多" if composite >= 5 else
            "看多" if composite >= 2 else
            "中性" if composite >= -1 else
            "看空" if composite >= -4 else
            "强烈看空"
        )

        # 关键价位
        key_levels = self._calc_key_levels(df, latest)

        # 警报
        alerts = self._generate_alerts(df, latest, prev, indicators)

        price = float(latest["close"])
        change = price - float(prev["close"])
        change_pct = (change / float(prev["close"])) * 100 if prev["close"] else 0

        # 趋势判定
        trend = "bullish" if latest.get("MA5", 0) > latest.get("MA20", 0) else (
            "bearish" if latest.get("MA5", 0) < latest.get("MA20", 0) else "sideways"
        )

        return {
            "symbol": symbol,
            "name": SYMBOL_NAMES.get(symbol, symbol),
            "price": round(price, 2),
            "change": round(change, 2),
            "change_pct": round(change_pct, 2),
            "trend": trend,
            "composite_score": composite,
            "composite_signal": composite_signal,
            "indicators": indicators,
            "key_levels": key_levels,
            "alerts": alerts,
        }

    # === 数据加载 ===

    def _load_kline(self, symbol: str) -> Optional[pd.DataFrame]:
        """从 monthly_kline 表加载 K 线数据"""
        rows = fetchall(
            "SELECT date, open, high, low, close, volume, adj_close "
            "FROM monthly_kline "
            "WHERE symbol = ? "
            "ORDER BY date ASC",
            (symbol,),
        )
        if not rows:
            return None

        df = pd.DataFrame([dict(r) for r in rows])
        for col in ["open", "high", "low", "close", "volume"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")
        df = df.dropna(subset=["close"])
        return df

    # === 指标计算 ===

    def _calc_sma(self, df: pd.DataFrame) -> pd.DataFrame:
        df["MA5"] = df["close"].rolling(window=5).mean()
        df["MA10"] = df["close"].rolling(window=10).mean()
        df["MA20"] = df["close"].rolling(window=20).mean()
        return df

    def _calc_rsi(self, df: pd.DataFrame, period: int = 14) -> pd.DataFrame:
        delta = df["close"].diff()
        gain = delta.clip(lower=0)
        loss = (-delta).clip(lower=0)
        avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
        avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
        rs = avg_gain / avg_loss
        df["RSI"] = 100 - (100 / (1 + rs))
        return df

    def _calc_macd(self, df: pd.DataFrame) -> pd.DataFrame:
        ema12 = df["close"].ewm(span=12, adjust=False).mean()
        ema26 = df["close"].ewm(span=26, adjust=False).mean()
        df["MACD"] = ema12 - ema26
        df["MACD_Signal"] = df["MACD"].ewm(span=9, adjust=False).mean()
        df["MACD_Hist"] = df["MACD"] - df["MACD_Signal"]
        return df

    def _calc_bollinger(self, df: pd.DataFrame, period: int = 20, std_mult: float = 2.0) -> pd.DataFrame:
        df["BB_Middle"] = df["close"].rolling(window=period).mean()
        rolling_std = df["close"].rolling(window=period).std()
        df["BB_Upper"] = df["BB_Middle"] + rolling_std * std_mult
        df["BB_Lower"] = df["BB_Middle"] - rolling_std * std_mult
        return df

    def _calc_kdj(self, df: pd.DataFrame, period: int = 9) -> pd.DataFrame:
        low_min = df["low"].rolling(window=period).min()
        high_max = df["high"].rolling(window=period).max()
        rsv = ((df["close"] - low_min) / (high_max - low_min)) * 100
        rsv = rsv.fillna(50)
        df["K"] = rsv.ewm(com=2, adjust=False).mean()
        df["D"] = df["K"].ewm(com=2, adjust=False).mean()
        df["J"] = 3 * df["K"] - 2 * df["D"]
        return df

    def _calc_atr(self, df: pd.DataFrame, period: int = 14) -> pd.DataFrame:
        high_low = df["high"] - df["low"]
        high_prev = (df["high"] - df["close"].shift(1)).abs()
        low_prev = (df["low"] - df["close"].shift(1)).abs()
        tr = pd.concat([high_low, high_prev, low_prev], axis=1).max(axis=1)
        df["ATR"] = tr.rolling(window=period).mean()
        return df

    # === 评分函数 ===

    def _score_trend(self, df: pd.DataFrame, latest: pd.Series) -> dict:
        ma5 = latest.get("MA5")
        ma10 = latest.get("MA10")
        ma20 = latest.get("MA20")
        if pd.isna(ma5) or pd.isna(ma10) or pd.isna(ma20):
            return {"name": "趋势方向", "score": 0, "label": "数据不足", "detail": "均线数据不足"}

        if ma5 > ma10 > ma20:
            return {"name": "趋势方向", "score": 1, "label": "多头", "detail": "MA5 > MA10 > MA20，均线多头排列"}
        elif ma5 < ma10 < ma20:
            return {"name": "趋势方向", "score": -1, "label": "空头", "detail": "MA5 < MA10 < MA20，均线空头排列"}
        else:
            return {"name": "趋势方向", "score": 0, "label": "震荡", "detail": "均线交错，趋势不明"}

    def _score_momentum(self, latest: pd.Series) -> dict:
        rsi = latest.get("RSI")
        if pd.isna(rsi):
            return {"name": "动量强度", "score": 0, "label": "数据不足", "detail": "RSI 数据不足"}
        rsi = float(rsi)
        if rsi > 70:
            return {"name": "动量强度", "score": -1, "label": "超买", "detail": f"RSI(14) = {rsi:.1f}，超买区间"}
        elif rsi < 30:
            return {"name": "动量强度", "score": 1, "label": "超卖", "detail": f"RSI(14) = {rsi:.1f}，超卖反弹机会"}
        elif rsi > 50:
            return {"name": "动量强度", "score": 1, "label": "强势", "detail": f"RSI(14) = {rsi:.1f}，上升趋势中"}
        else:
            return {"name": "动量强度", "score": -1, "label": "弱势", "detail": f"RSI(14) = {rsi:.1f}，下降趋势中"}

    def _score_volume(self, df: pd.DataFrame, latest: pd.Series) -> dict:
        vol = latest.get("volume")
        if pd.isna(vol) or vol == 0:
            return {"name": "成交量", "score": 0, "label": "无数据", "detail": "成交量数据缺失"}
        avg_vol = df["volume"].tail(20).mean()
        if avg_vol == 0:
            return {"name": "成交量", "score": 0, "label": "无数据", "detail": "无历史成交量"}
        ratio = float(vol) / avg_vol
        if ratio > 1.5:
            return {"name": "成交量", "score": 1, "label": "放量", "detail": f"量比 {ratio:.2f}，明显放量"}
        elif ratio < 0.5:
            return {"name": "成交量", "score": -1, "label": "缩量", "detail": f"量比 {ratio:.2f}，成交萎缩"}
        else:
            return {"name": "成交量", "score": 0, "label": "中性", "detail": f"量比 {ratio:.2f}，量能温和"}

    def _score_macd(self, latest: pd.Series, prev: pd.Series) -> dict:
        macd = latest.get("MACD_Hist")
        prev_macd = prev.get("MACD_Hist")
        if pd.isna(macd):
            return {"name": "MACD", "score": 0, "label": "数据不足", "detail": "MACD 数据不足"}

        macd_val = float(macd)
        prev_val = float(prev_macd) if not pd.isna(prev_macd) else 0

        if prev_val <= 0 < macd_val:
            return {"name": "MACD", "score": 1, "label": "金叉", "detail": "MACD 柱状图翻红，金叉确认"}
        elif prev_val >= 0 > macd_val:
            return {"name": "MACD", "score": -1, "label": "死叉", "detail": "MACD 柱状图翻绿，死叉确认"}
        elif macd_val > 0:
            return {"name": "MACD", "score": 1, "label": "多头", "detail": f"MACD 柱状图为正 ({macd_val:.3f})"}
        else:
            return {"name": "MACD", "score": -1, "label": "空头", "detail": f"MACD 柱状图为负 ({macd_val:.3f})"}

    def _score_bollinger(self, latest: pd.Series) -> dict:
        close = latest.get("close")
        upper = latest.get("BB_Upper")
        lower = latest.get("BB_Lower")
        middle = latest.get("BB_Middle")
        if pd.isna(upper) or pd.isna(lower):
            return {"name": "布林带", "score": 0, "label": "数据不足", "detail": "布林带数据不足"}

        close_f = float(close)
        if close_f > float(upper):
            return {"name": "布林带", "score": -1, "label": "突破上轨", "detail": "价格突破布林上轨，注意回调风险"}
        elif close_f < float(lower):
            return {"name": "布林带", "score": 1, "label": "跌破下轨", "detail": "价格跌破布林下轨，超卖反弹"}
        elif close_f > float(middle):
            return {"name": "布林带", "score": 0, "label": "中上运行", "detail": "价格在中轨和上轨之间运行"}
        else:
            return {"name": "布林带", "score": 0, "label": "中下运行", "detail": "价格在中轨和下轨之间运行"}

    def _score_kdj(self, latest: pd.Series) -> dict:
        k = latest.get("K")
        d = latest.get("D")
        j = latest.get("J")
        if pd.isna(k) or pd.isna(d):
            return {"name": "KDJ", "score": 0, "label": "数据不足", "detail": "KDJ 数据不足"}

        k_f, d_f, j_f = float(k), float(d), float(j)
        if j_f > 100:
            return {"name": "KDJ", "score": -1, "label": "超买", "detail": f"K={k_f:.0f}, D={d_f:.0f}, J={j_f:.0f}，高位钝化"}
        elif j_f < 0:
            return {"name": "KDJ", "score": 1, "label": "超卖", "detail": f"K={k_f:.0f}, D={d_f:.0f}, J={j_f:.0f}，低位反弹"}
        elif k_f > d_f:
            return {"name": "KDJ", "score": 1, "label": "金叉", "detail": f"K={k_f:.0f} > D={d_f:.0f}，看多"}
        else:
            return {"name": "KDJ", "score": -1, "label": "死叉", "detail": f"K={k_f:.0f} < D={d_f:.0f}，看空"}

    def _score_ma_support(self, latest: pd.Series) -> dict:
        close = float(latest.get("close", 0))
        ma10 = latest.get("MA10")
        ma20 = latest.get("MA20")
        if pd.isna(ma10) or pd.isna(ma20):
            return {"name": "均线支撑", "score": 0, "label": "数据不足", "detail": "均线数据不足"}

        ma10_f, ma20_f = float(ma10), float(ma20)
        pct_from_ma10 = ((close - ma10_f) / ma10_f) * 100

        if close > ma10_f > ma20_f:
            return {"name": "均线支撑", "score": 1, "label": "有效", "detail": f"站稳 MA10 上方 ({pct_from_ma10:+.1f}%)"}
        elif close < ma10_f < ma20_f:
            return {"name": "均线支撑", "score": -1, "label": "失守", "detail": f"跌破 MA10 + MA20，支撑无效"}
        else:
            return {"name": "均线支撑", "score": 0, "label": "测试中", "detail": f"距 MA10 {pct_from_ma10:+.1f}%，均线测试中"}

    def _score_volatility(self, df: pd.DataFrame, latest: pd.Series) -> dict:
        atr = latest.get("ATR")
        if pd.isna(atr):
            return {"name": "波动率", "score": 0, "label": "数据不足", "detail": "ATR 数据不足"}

        avg_atr = df["ATR"].tail(60).mean()
        if pd.isna(avg_atr) or avg_atr == 0:
            return {"name": "波动率", "score": 0, "label": "正常", "detail": "ATR 历史数据不足"}

        ratio = float(atr) / avg_atr
        if ratio > 1.5:
            return {"name": "波动率", "score": -1, "label": "异常放大", "detail": f"ATR 比率 {ratio:.2f}，波动率异常"}
        elif ratio < 0.5:
            return {"name": "波动率", "score": 1, "label": "极低", "detail": f"ATR 比率 {ratio:.2f}，蓄势待发"}
        else:
            return {"name": "波动率", "score": 0, "label": "正常", "detail": f"ATR 比率 {ratio:.2f}，波动正常"}

    def _score_volume_trend(self, df: pd.DataFrame) -> dict:
        """最近 5 期 vs 前 5 期的量能趋势"""
        if len(df) < 10:
            return {"name": "量能趋势", "score": 0, "label": "数据不足", "detail": "历史数据不足"}

        recent = df["volume"].tail(5).mean()
        earlier = df["volume"].iloc[-10:-5].mean()
        if recent == 0 or earlier == 0:
            return {"name": "量能趋势", "score": 0, "label": "无数据", "detail": "成交量为零"}

        change_pct = ((recent - earlier) / earlier) * 100
        if change_pct > 30:
            return {"name": "量能趋势", "score": 1, "label": "放量", "detail": f"近期量能增加 {change_pct:.0f}%"}
        elif change_pct < -30:
            return {"name": "量能趋势", "score": -1, "label": "缩量", "detail": f"近期量能萎缩 {change_pct:.0f}%"}
        else:
            return {"name": "量能趋势", "score": 0, "label": "平稳", "detail": f"量能变化 {change_pct:.0f}%，平稳"}

    # === 关键价位 ===

    def _calc_key_levels(self, df: pd.DataFrame, latest: pd.Series) -> list[dict]:
        levels = []
        close = float(latest["close"])

        # 阻力位: 近期高点
        recent_high = float(df["high"].tail(20).max())
        if recent_high > close * 1.01:
            levels.append({"type": "resistance", "price": round(recent_high, 2), "label": "近20期高点"})

        # MA20 支撑/阻力
        ma20 = latest.get("MA20")
        if not pd.isna(ma20):
            ma20_f = float(ma20)
            if ma20_f < close:
                levels.append({"type": "support", "price": round(ma20_f, 2), "label": "MA20 支撑"})
            else:
                levels.append({"type": "resistance", "price": round(ma20_f, 2), "label": "MA20 压力"})

        # 布林带
        bb_upper = latest.get("BB_Upper")
        bb_lower = latest.get("BB_Lower")
        if not pd.isna(bb_upper):
            levels.append({"type": "resistance", "price": round(float(bb_upper), 2), "label": "布林上轨"})
        if not pd.isna(bb_lower):
            levels.append({"type": "support", "price": round(float(bb_lower), 2), "label": "布林下轨"})

        # 近期低点支撑
        recent_low = float(df["low"].tail(20).min())
        if recent_low < close * 0.99:
            levels.append({"type": "support", "price": round(recent_low, 2), "label": "近20期低点"})

        # 按价格排序 (从高到低)
        levels.sort(key=lambda x: x["price"], reverse=True)
        return levels

    # === 警报 ===

    def _generate_alerts(
        self, df: pd.DataFrame, latest: pd.Series, prev: pd.Series, indicators: list[dict]
    ) -> list[dict]:
        alerts = []

        # MACD 金叉/死叉
        macd_hist = latest.get("MACD_Hist")
        prev_macd = prev.get("MACD_Hist")
        if not pd.isna(macd_hist) and not pd.isna(prev_macd):
            if float(prev_macd) <= 0 < float(macd_hist):
                alerts.append({"signal": "MACD 金叉确认", "direction": "bullish", "date": latest.get("date", "")})
            elif float(prev_macd) >= 0 > float(macd_hist):
                alerts.append({"signal": "MACD 死叉确认", "direction": "bearish", "date": latest.get("date", "")})

        # KDJ 超买/超卖
        j = latest.get("J")
        if not pd.isna(j):
            j_f = float(j)
            if j_f > 100:
                alerts.append({"signal": "KDJ 高位钝化 (J > 100)", "direction": "bearish", "date": latest.get("date", "")})
            elif j_f < 0:
                alerts.append({"signal": "KDJ 低位反弹 (J < 0)", "direction": "bullish", "date": latest.get("date", "")})

        # 布林突破
        close = float(latest["close"])
        bb_upper = latest.get("BB_Upper")
        bb_lower = latest.get("BB_Lower")
        if not pd.isna(bb_upper) and close > float(bb_upper):
            alerts.append({"signal": "突破布林上轨", "direction": "bearish", "date": latest.get("date", "")})
        if not pd.isna(bb_lower) and close < float(bb_lower):
            alerts.append({"signal": "跌破布林下轨", "direction": "bullish", "date": latest.get("date", "")})

        # 综合评分极端
        composite = sum(ind["score"] for ind in indicators)
        if composite >= 6:
            alerts.append({"signal": f"综合评分极度看多 ({composite:+d})", "direction": "bullish", "date": latest.get("date", "")})
        elif composite <= -6:
            alerts.append({"signal": f"综合评分极度看空 ({composite:+d})", "direction": "bearish", "date": latest.get("date", "")})

        return alerts
