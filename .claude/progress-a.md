# V2.5 Progress — Track A (后端)
*Started: 2026-04-02*

## Status: ✅ 全部完成

### Phase 1: 数据模型 + Repository ✅
- `backend/models/` — 10 个 dataclass 模型
  - macro.py, clock.py, valuation.py, kline.py, signal.py, watchlist.py, config.py, dca.py
  - 每个模型包含 `to_dict()` 和 `from_row()` 方法
- `backend/repos/base.py` — BaseRepository 通用 CRUD
  - get_by_id, find, find_one, insert, upsert, insert_many, upsert_many, update, delete, count
  - raw_query, raw_query_one, raw_execute
- `backend/repos/` — 8 个特化 repo
  - macro_repo.py: get_latest, get_history, get_series, get_freshness, save_indicator_batch
  - clock_repo.py + IndicatorHistoryRepo: save_assessment, get_latest, get_history
  - valuation_repo.py: get_pe_history, get_latest_pe_percentile, calc_percentile
  - kline_repo.py: get_monthly, get_latest, save_batch
  - index_pe_repo.py: get_history, get_latest, save_batch
  - watchlist_repo.py: get_all, add, remove, toggle, get_symbols
  - config_repo.py: get, get_value, set, get_all
  - dca_repo.py: get_plans, create_plan, add_record, get_history

### Phase 2: 数据库 Migration ✅
- `backend/db/migrations.py` — 7 个迁移版本 (v2.5.0 ~ v2.5.6)
- 新增表: watchlist, dca_plans, dca_records, app_config, technical_analysis, _migrations
- index_pe 表新增 pe_pct_5y 列
- `seed_watchlist()` — 从 config.py WATCHLIST 迁移 9 个标的
- `seed_default_config()` — 7 个默认配置项
- `init_db()` 集成迁移自动运行

### Phase 3: 统一响应格式 ✅
- `backend/api/response.py` — 统一响应封装
  - `ok(data, meta)` → `{"ok": true, "data": ..., "meta": {...}}`
  - `error(code, message, status)` → `{"ok": false, "error": {"code": ..., "message": ...}}`
  - `server_error(message)` → 500 响应
  - `not_found(message)` → 404 响应
  - `with_freshness(data)` → 自动附加数据新鲜度 meta
- 已更新的 API: dashboard, signals, bullbear, valuation, kline_history, macro, clock_public, merill, admin, admin_clock

### Phase 4: 重构现有代码使用 Repo ✅
- engines/ 全部改为构造器注入 repo:
  - merill_clock.py → MacroRepo (get_series)
  - bull_bear.py → KlineRepo
  - monthly_signal.py → KlineRepo + ValuationRepo
  - temperature.py → KlineRepo + ValuationRepo
  - clock_assessor.py → ClockRepo + MacroRepo
- collectors/ 全部改为通过 repo 写入:
  - macro_cn.py → MacroRepo.save_indicator_batch
  - macro_us.py → MacroRepo.save_indicator_batch
  - kline.py → KlineRepo.upsert_many
  - valuation.py → ValuationRepo.upsert_many + KlineRepo

### Phase 5: API 路由重组 ✅
- `/api/v1/` 前缀: 所有现有 API 镜像到 v1 (29 routes)
- `/api/` 前缀: 保留旧路由兼容 (22 routes)
- 新增 API (仅 /api/v1/):
  - GET/POST/DELETE /api/v1/admin/watchlist — 关注列表管理
  - PUT /api/v1/admin/watchlist/{symbol}/toggle — 切换启用
  - GET/PUT /api/v1/admin/config — 运行时配置管理
  - GET /api/v1/health/data — 数据新鲜度报告
- CORS 增加 PUT/DELETE 方法
- Rate limiting 覆盖 PUT/DELETE

## 约束遵守
- ✅ 所有新代码使用 Python type hints
- ✅ 向后兼容: 旧 API 路径 /api/* 继续工作
- ✅ daily_collect.py cron 不受影响
- ✅ 前端 API 调用不变（数据结构兼容，外层多了 ok/data/meta 包装）
- ✅ SQLite migration 用 try/except 处理已存在列
- ✅ 用 dataclass 不用 pydantic (models 层)
- ✅ 未修改禁止文件 (web/, auth.py, auth_routes.py, llm.py, .env)
