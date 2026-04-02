"""定投管理 API (v1)

CRUD 定投计划 + 记录 + 收益分析
写入操作需 JWT auth (verify_admin_token)
"""

import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from backend.api.auth import verify_admin_token, TokenPayload
from backend.api.response import ok, error, server_error, not_found
from backend.db.connection import fetchall, fetchone, execute, get_db

logger = logging.getLogger(__name__)
router = APIRouter()

# === 合法标的白名单 (从 watchlist 表动态读取) ===

def _get_valid_symbols() -> set[str]:
    """从 watchlist 表获取合法标的列表"""
    rows = fetchall("SELECT symbol FROM watchlist WHERE enabled = 1")
    symbols = {r["symbol"] for r in rows}
    # 也包含 index_pe 的指数
    idx_rows = fetchall("SELECT DISTINCT symbol FROM index_pe")
    symbols.update(r["symbol"] for r in idx_rows)
    return symbols


# === Pydantic 模型 ===

class CreatePlanBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    symbol: str = Field(..., min_length=1, max_length=20)
    strategy: str = Field(default="fixed", pattern=r"^(fixed|pe_weighted)$")
    amount: float = Field(..., gt=0, le=1_000_000)
    frequency: str = Field(default="monthly", pattern=r"^(weekly|biweekly|monthly)$")
    start_date: str = Field(default_factory=lambda: date.today().isoformat())
    pe_low: Optional[float] = None
    pe_high: Optional[float] = None


class UpdatePlanBody(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    amount: Optional[float] = Field(default=None, gt=0, le=1_000_000)
    frequency: Optional[str] = Field(default=None, pattern=r"^(weekly|biweekly|monthly)$")
    strategy: Optional[str] = Field(default=None, pattern=r"^(fixed|pe_weighted)$")
    enabled: Optional[int] = Field(default=None, ge=0, le=1)
    pe_low: Optional[float] = None
    pe_high: Optional[float] = None


class AddRecordBody(BaseModel):
    plan_id: int = Field(..., gt=0)
    date: str = Field(default_factory=lambda: date.today().isoformat())
    amount: float = Field(..., gt=0, le=1_000_000)
    price: float = Field(..., gt=0)
    shares: float = Field(..., gt=0)
    pe_at_buy: Optional[float] = None
    pe_percentile: Optional[float] = None


# === 路由 ===

@router.get("/dca/plans")
async def list_plans():
    """列出所有定投计划"""
    try:
        rows = fetchall(
            "SELECT id, name, symbol, strategy, amount, frequency, "
            "start_date, pe_low, pe_high, enabled "
            "FROM dca_plans ORDER BY id"
        )
        plans = []
        for r in rows:
            plan = dict(r)
            # 计算汇总统计
            stats = fetchone(
                "SELECT COUNT(*) as record_count, "
                "COALESCE(SUM(amount), 0) as total_invested, "
                "COALESCE(SUM(shares), 0) as total_shares "
                "FROM dca_records WHERE plan_id = ?",
                (r["id"],),
            )
            plan["record_count"] = stats["record_count"] if stats else 0
            plan["total_invested"] = round(stats["total_invested"], 2) if stats else 0
            plan["total_shares"] = round(stats["total_shares"], 6) if stats else 0

            # 获取最新价格估算当前市值
            latest_price = _get_latest_price(r["symbol"])
            if latest_price and stats and stats["total_shares"] > 0:
                plan["current_value"] = round(latest_price * stats["total_shares"], 2)
                plan["latest_price"] = round(latest_price, 2)
            else:
                plan["current_value"] = None
                plan["latest_price"] = None

            plan["status"] = "active" if r["enabled"] else "paused"
            plans.append(plan)

        return ok(plans)
    except Exception as e:
        logger.error(f"定投计划查询失败: {e}")
        return server_error(f"定投计划查询失败: {e}")


@router.post("/dca/plans")
async def create_plan(
    body: CreatePlanBody,
    _user: TokenPayload = Depends(verify_admin_token),
):
    """创建定投计划 (需要 JWT auth)"""
    # 验证标的白名单
    valid_symbols = _get_valid_symbols()
    if body.symbol not in valid_symbols:
        return error("INVALID_SYMBOL", f"标的 {body.symbol} 不在白名单中")

    try:
        cursor = execute(
            "INSERT INTO dca_plans (name, symbol, strategy, amount, frequency, "
            "start_date, pe_low, pe_high, enabled) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)",
            (
                body.name,
                body.symbol,
                body.strategy,
                body.amount,
                body.frequency,
                body.start_date,
                body.pe_low,
                body.pe_high,
            ),
        )
        plan_id = cursor.lastrowid
        return ok({"id": plan_id, "message": "计划创建成功"})
    except Exception as e:
        logger.error(f"创建定投计划失败: {e}")
        return server_error(f"创建定投计划失败: {e}")


@router.put("/dca/plans/{plan_id}")
async def update_plan(
    plan_id: int,
    body: UpdatePlanBody,
    _user: TokenPayload = Depends(verify_admin_token),
):
    """修改定投计划 (需要 JWT auth)"""
    existing = fetchone("SELECT id FROM dca_plans WHERE id = ?", (plan_id,))
    if not existing:
        return not_found(f"计划 {plan_id} 不存在")

    updates = []
    params = []
    for field in ["name", "amount", "frequency", "strategy", "enabled", "pe_low", "pe_high"]:
        val = getattr(body, field, None)
        if val is not None:
            updates.append(f"{field} = ?")
            params.append(val)

    if not updates:
        return error("NO_CHANGES", "没有要更新的字段")

    params.append(plan_id)
    try:
        execute(
            f"UPDATE dca_plans SET {', '.join(updates)} WHERE id = ?",
            tuple(params),
        )
        return ok({"message": "计划更新成功"})
    except Exception as e:
        logger.error(f"更新定投计划失败: {e}")
        return server_error(f"更新定投计划失败: {e}")


@router.delete("/dca/plans/{plan_id}")
async def delete_plan(
    plan_id: int,
    _user: TokenPayload = Depends(verify_admin_token),
):
    """删除定投计划 (需要 JWT auth)"""
    existing = fetchone("SELECT id FROM dca_plans WHERE id = ?", (plan_id,))
    if not existing:
        return not_found(f"计划 {plan_id} 不存在")

    try:
        execute("DELETE FROM dca_records WHERE plan_id = ?", (plan_id,))
        execute("DELETE FROM dca_plans WHERE id = ?", (plan_id,))
        return ok({"message": "计划已删除"})
    except Exception as e:
        logger.error(f"删除定投计划失败: {e}")
        return server_error(f"删除定投计划失败: {e}")


@router.post("/dca/records")
async def add_record(
    body: AddRecordBody,
    _user: TokenPayload = Depends(verify_admin_token),
):
    """添加定投记录 (需要 JWT auth)"""
    # 验证 plan 存在
    plan = fetchone("SELECT id, symbol FROM dca_plans WHERE id = ?", (body.plan_id,))
    if not plan:
        return not_found(f"计划 {body.plan_id} 不存在")

    # 计算累计
    prev = fetchone(
        "SELECT COALESCE(SUM(amount), 0) as total_cost, "
        "COALESCE(SUM(shares), 0) as total_shares "
        "FROM dca_records WHERE plan_id = ?",
        (body.plan_id,),
    )
    total_cost = (prev["total_cost"] if prev else 0) + body.amount
    total_shares = (prev["total_shares"] if prev else 0) + body.shares

    try:
        cursor = execute(
            "INSERT INTO dca_records (plan_id, date, amount, price, shares, "
            "pe_at_buy, pe_percentile, total_cost, total_shares) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                body.plan_id,
                body.date,
                body.amount,
                body.price,
                body.shares,
                body.pe_at_buy,
                body.pe_percentile,
                total_cost,
                total_shares,
            ),
        )
        return ok({"id": cursor.lastrowid, "message": "记录添加成功"})
    except Exception as e:
        logger.error(f"添加定投记录失败: {e}")
        return server_error(f"添加定投记录失败: {e}")


@router.get("/dca/history")
async def get_history(
    plan_id: Optional[int] = Query(None, description="计划 ID，为空则返回所有"),
    limit: int = Query(50, ge=1, le=500),
):
    """获取定投历史记录"""
    try:
        if plan_id:
            rows = fetchall(
                "SELECT r.id, r.plan_id, r.date, r.amount, r.price, r.shares, "
                "r.pe_at_buy, r.pe_percentile, r.total_cost, r.total_shares, "
                "p.symbol, p.name "
                "FROM dca_records r JOIN dca_plans p ON r.plan_id = p.id "
                "WHERE r.plan_id = ? "
                "ORDER BY r.date DESC LIMIT ?",
                (plan_id, limit),
            )
        else:
            rows = fetchall(
                "SELECT r.id, r.plan_id, r.date, r.amount, r.price, r.shares, "
                "r.pe_at_buy, r.pe_percentile, r.total_cost, r.total_shares, "
                "p.symbol, p.name "
                "FROM dca_records r JOIN dca_plans p ON r.plan_id = p.id "
                "ORDER BY r.date DESC LIMIT ?",
                (limit,),
            )

        data = [dict(r) for r in rows]
        return ok(data)
    except Exception as e:
        logger.error(f"定投历史查询失败: {e}")
        return server_error(f"定投历史查询失败: {e}")


@router.get("/dca/analysis")
async def get_analysis(
    plan_id: int = Query(..., description="计划 ID", gt=0),
):
    """收益分析: 总收益率、vs 一次性买入"""
    plan = fetchone(
        "SELECT id, name, symbol, amount, strategy, start_date FROM dca_plans WHERE id = ?",
        (plan_id,),
    )
    if not plan:
        return not_found(f"计划 {plan_id} 不存在")

    try:
        records = fetchall(
            "SELECT date, amount, price, shares, total_cost, total_shares "
            "FROM dca_records WHERE plan_id = ? ORDER BY date ASC",
            (plan_id,),
        )

        if not records:
            return ok({
                "plan_id": plan_id,
                "total_invested": 0,
                "current_value": 0,
                "total_return_pct": 0,
                "avg_cost": 0,
                "records_count": 0,
                "return_curve": [],
            })

        total_invested = sum(r["amount"] for r in records)
        total_shares = sum(r["shares"] for r in records)
        avg_cost = total_invested / total_shares if total_shares > 0 else 0

        latest_price = _get_latest_price(plan["symbol"])
        current_value = latest_price * total_shares if latest_price else total_invested

        total_return_pct = (
            ((current_value - total_invested) / total_invested) * 100
            if total_invested > 0
            else 0
        )

        # 收益曲线
        return_curve = []
        cum_invested = 0
        cum_shares = 0
        for r in records:
            cum_invested += r["amount"]
            cum_shares += r["shares"]
            cum_value = r["price"] * cum_shares
            return_curve.append({
                "date": r["date"],
                "invested": round(cum_invested, 2),
                "value": round(cum_value, 2),
            })

        # vs 一次性买入 (用第一笔记录的价格)
        first_price = records[0]["price"]
        if first_price > 0 and latest_price:
            lump_sum_return = ((latest_price - first_price) / first_price) * 100
        else:
            lump_sum_return = None

        return ok({
            "plan_id": plan_id,
            "symbol": plan["symbol"],
            "name": plan["name"],
            "total_invested": round(total_invested, 2),
            "current_value": round(current_value, 2),
            "total_return_pct": round(total_return_pct, 2),
            "avg_cost": round(avg_cost, 4),
            "latest_price": round(latest_price, 2) if latest_price else None,
            "records_count": len(records),
            "lump_sum_return_pct": round(lump_sum_return, 2) if lump_sum_return is not None else None,
            "return_curve": return_curve,
        })
    except Exception as e:
        logger.error(f"收益分析失败: {e}")
        return server_error(f"收益分析失败: {e}")


def _get_latest_price(symbol: str) -> Optional[float]:
    """获取标的最新价格 (从 monthly_kline 表)"""
    row = fetchone(
        "SELECT close FROM monthly_kline "
        "WHERE symbol = ? ORDER BY date DESC LIMIT 1",
        (symbol,),
    )
    return row["close"] if row else None
