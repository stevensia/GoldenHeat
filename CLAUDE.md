# CLAUDE.md — GoldenHeat 项目指南

> AI 中长周期投资决策系统 — 美林时钟 + 月线信号 + 估值百分位

## 项目概述

GoldenHeat 是一个面向月度/季度周期的宏观投资决策面板，核心功能：

1. **美林投资时钟** — 三方加权（算法 + AI + 人工），0-12 点位系统，支持中国/美国双市场
2. **月线信号** — 多标的月线技术信号（MA 趋势 + 回调 + 量能 + 估值）
3. **牛熊分割线** — MA12/MA24 双均线判断市场阶段
4. **市场温度** — 综合 PE 百分位 + MA 偏离 + 量能变化
5. **估值百分位** — 8 大指数 PE 历史百分位（5年/10年），判断低估/高估区间
6. **定投管理** — 定投计划 CRUD + 记录 + IRR 收益分析
7. **战士模块** — 个股技术分析（SMA/RSI/MACD/布林带/KDJ），综合评分 -8~+8

**设计哲学**: "历史位置感" — 不看绝对数字，看你在 10 年周期中的位置。

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Python 3 + FastAPI + SQLite + Repository 模式 |
| 前端 | React + TypeScript + Vite + Tailwind CSS + Recharts + react-router-dom |
| 数据源 | akshare NBS直采(中国宏观) + FRED API(美国宏观) + yfinance(行情) + 乐咕乐股(指数PE) + multpl.com(S&P500 PE) |
| LLM | gpt-5.4 via localhost:4399 (local first) + Azure AI Foundry (fallback) |
| 部署 | PM2 + Nginx, 静态文件 rsync |
| 认证 | JWT (HS256, 72h) + 本地密码 + OAuth/Entra ID(预留) |

## 目录结构

```
/opt/GoldenHeat/
├── backend/
│   ├── main.py              # FastAPI 入口, CORS, Rate Limiting, 路由挂载 (/api/ + /api/v1/)
│   ├── config.py            # 配置: DB路径, 关注标的, 引擎参数
│   ├── llm.py               # LLM 统一客户端: local+Azure 双后端, extract_json()
│   ├── api/                 # REST API 路由
│   │   ├── response.py      # 统一响应: ok(data, meta), error(), server_error(), with_freshness()
│   │   ├── auth.py          # 认证核心: JWT签发/验证, 本地登录, OAuth/Entra ID
│   │   ├── auth_routes.py   # 认证路由: /auth/login, /auth/me, /auth/oauth/*
│   │   ├── dashboard.py     # GET /dashboard — 仪表盘聚合数据
│   │   ├── admin_clock.py   # 时钟管理 API (需认证): assess, confirm, history
│   │   ├── admin_watchlist.py # 关注列表 CRUD (需认证)
│   │   ├── admin_config.py  # 运行时配置管理 (需认证)
│   │   ├── clock_public.py  # GET /clock/summary — 双市场时钟(无需认证)
│   │   ├── valuation.py     # GET /valuation/history — 旧估值历史 (valuation表)
│   │   ├── valuation_v1.py  # GET /v1/valuation/overview + pe-history — 新估值百分位 (index_pe表)
│   │   ├── dca_routes.py    # 定投 CRUD + 收益分析 (需认证写入)
│   │   ├── technical.py     # GET /v1/signal/technical — 技术分析
│   │   ├── data_health.py   # GET /v1/data/health — 数据新鲜度
│   │   ├── kline_history.py # GET /kline/history — K 线历史
│   │   ├── macro.py         # GET /macro/details — 宏观指标明细
│   │   ├── signals.py       # GET /signals — 月线信号
│   │   ├── merill.py        # GET /merill — 美林时钟原始数据
│   │   ├── bullbear.py      # GET /bullbear — 牛熊状态
│   │   └── admin.py         # 数据刷新等管理接口
│   ├── engines/             # 核心算法引擎
│   │   ├── merill_clock.py  # 美林时钟: LinearRegression GDP/CPI 趋势判断 + 点位计算
│   │   ├── clock_assessor.py# 三方加权评估器: algo+AI+human → final position
│   │   ├── ai_assessor.py   # AI 判断: 调用 LLM 分析宏观数据
│   │   ├── percentile_analyzer.py # PE 百分位引擎: 5y/10y百分位 + 滚动百分位
│   │   ├── technical_analyzer.py  # 技术分析: SMA/RSI/MACD/布林带/KDJ, 综合评分
│   │   ├── monthly_signal.py# 月线技术信号: MA趋势+回调+量能+估值
│   │   ├── bull_bear.py     # 牛熊分割线: MA12 vs MA24
│   │   └── temperature.py   # 市场温度: PE百分位+MA偏离+量能
│   ├── collectors/          # 数据采集器
│   │   ├── macro_cn.py      # 中国宏观(akshare NBS): GDP/CPI/PPI/PMI/M2
│   │   ├── macro_us.py      # 美国宏观(FRED): GDP/CPI/Fed Rate/Payroll
│   │   ├── kline.py         # K 线数据(yfinance)
│   │   ├── valuation.py     # 估值数据(yfinance): PE/PB/百分位
│   │   └── index_pe.py      # 指数PE采集: A股(乐咕乐股) + S&P500(multpl.com)
│   ├── models/              # Dataclass 实体 (V2.5)
│   │   ├── clock.py, config.py, dca.py, kline.py
│   │   ├── macro.py, signal.py, valuation.py, watchlist.py
│   │   └── __init__.py
│   ├── repos/               # Repository 层 (V2.5)
│   │   ├── base.py          # BaseRepository: fetchall/fetchone/execute
│   │   ├── clock_repo.py, config_repo.py, dca_repo.py
│   │   ├── kline_repo.py, macro_repo.py, valuation_repo.py
│   │   └── watchlist_repo.py
│   ├── db/
│   │   ├── connection.py    # SQLite 连接管理
│   │   ├── schema.sql       # 表结构定义
│   │   └── migrations.py    # 自动迁移: watchlist/dca/app_config/technical_analysis/db_migrations
│   ├── notify/
│   │   └── telegram_notify.py  # Telegram 通知(stub)
│   └── scripts/
│       ├── migrate_clock.py    # 时钟评估表迁移
│       └── backfill_valuation.py # 10 年估值回填
├── web/                     # React 前端
│   ├── src/
│   │   ├── App.tsx          # react-router-dom: /, /valuation, /dca, /warrior, /admin/*
│   │   ├── api/
│   │   │   ├── client.ts    # API 客户端: fetchJSON(自动解包{ok,data}) + fetchV1 + JWT管理
│   │   │   └── types.ts     # TypeScript 类型定义
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx      # 首页: 宏观定位 → 标的信号 → 数据溯源
│   │   │   ├── ValuationPage.tsx  # 估值百分位: 8指数卡片 + PE趋势图 + 百分位条
│   │   │   ├── DCAPage.tsx        # 定投管理: 计划CRUD + 记录 + 收益分析
│   │   │   ├── WarriorPage.tsx    # 战士: 个股技术分析 + 9维雷达 + 信号时间线
│   │   │   ├── AdminClock.tsx     # 管理: 评估详情+指标+人工确认+科普
│   │   │   └── AdminSettings.tsx  # 设置: LLM + 数据健康
│   │   └── components/
│   │       ├── MerillClock.tsx      # 美林时钟v5: 金色指针+渐变象限+深空背景
│   │       ├── PercentileBar.tsx    # PE 百分位条 + 展开趋势图
│   │       ├── Layout.tsx           # 全局布局: 侧边栏+移动端底部tab
│   │       ├── SideNav.tsx          # 侧边导航
│   │       ├── ErrorBoundary.tsx    # 错误边界
│   │       ├── PageSkeleton.tsx     # 骨架屏
│   │       └── ...
│   └── vite.config.ts
├── data/
│   └── goldenheat.db       # SQLite 数据库
├── tests/
│   └── e2e_test.py          # Playwright headless E2E 测试
├── docs/
│   ├── HEAT2-PLAN.md        # V2 执行计划
│   ├── ARCHITECTURE-REVIEW.md # V2.5 架构评估
│   └── ref/
│       └── merrill-clock-research.md # 美林时钟理论研究
├── .env                     # 敏感配置(gitignored): FRED_API_KEY, 密码, Token, LLM配置
└── .claude/                 # Claude Code 任务书
    ├── task-a.md ~ task-e.md
    └── progress-a.md ~ progress-e.md
```

## 数据库表

| 表 | 用途 |
|---|---|
| `macro_data` | 宏观指标时间序列 (indicator, date, value, source) — UPSERT |
| `monthly_kline` | K 线月线数据 (symbol, date, open, high, low, close, volume) |
| `valuation` | 旧估值数据 (symbol, date, pe, pb, pe_percentile) |
| `index_pe` | 指数PE历史 (symbol, date, pe_ttm, pe_static, pe_median, index_value) — 28000+行 |
| `signals` | 信号快照 (symbol, date, signal_type, signal_value JSON) |
| `clock_assessments` | 时钟评估历史 (市场, 算法/AI/人工三方, 最终加权, 触发类型) |
| `indicator_history` | 指标变更追踪 (关联 assessment, 含前值对比) |
| `ai_analyses` | AI 分析结果缓存 |
| `watchlist` | 关注列表 (V2.5, 从config.py迁移) |
| `dca_plans` | 定投计划 (symbol, amount, frequency, strategy) |
| `dca_records` | 定投记录 (plan_id, date, amount, price, shares) |
| `app_config` | 运行时配置 KV 存储 |
| `technical_analysis` | 技术分析快照 |
| `db_migrations` | 迁移版本追踪 |

## 美林时钟核心逻辑

### 算法判断 (`merill_clock.py`)
1. 取最近 N 个月 GDP/CPI 数据
2. LinearRegression 拟合斜率 → gdp_slope, cpi_slope
3. slope > 0 → up, slope ≤ 0 → down
4. (GDP↑, CPI↓) = recovery, (GDP↑, CPI↑) = overheat, (GDP↓, CPI↑) = stagflation, (GDP↓, CPI↓) = recession
5. PMI 修正: PMI 与 GDP 方向矛盾时 confidence *= 0.7
6. M2 vs GDP 判断信用环境

### 点位系统 (0-12)
- 0/12 = 复苏中心, 3 = 过热中心, 6 = 滞胀中心, 9 = 衰退中心
- confidence 和斜率大小决定在范围内的精确偏移
- 前端 SVG 角度: `(315 + position * 30) % 360`（复苏在左上 315°）

### 三方加权 (`clock_assessor.py`)
- 有人工: algo=0.4, ai=0.3, human=0.3
- 无人工: algo=0.5, ai=0.5
- AI 不可用时: algo=1.0
- 环形加权平均（处理 0/12 边界）

## API 路由

### 公开 API (无需认证)
| 路由 | 说明 |
|---|---|
| `GET /api/health` | 健康检查 |
| `GET /api/dashboard` | 仪表盘聚合数据 |
| `GET /api/clock/summary` | 双市场时钟摘要 |
| `GET /api/v1/valuation/overview` | 8指数估值百分位 |
| `GET /api/v1/valuation/pe-history?symbol=&months=` | PE历史+滚动百分位 |
| `GET /api/v1/signal/technical?symbol=` | 技术分析 |
| `GET /api/v1/dca/plans` | 定投计划列表 |
| `GET /api/v1/dca/history` | 定投记录 |

### 需认证 API (JWT Bearer)
| 路由 | 说明 |
|---|---|
| `POST /api/auth/login` | 登录获取JWT |
| `POST /api/refresh` | 刷新数据 |
| `POST /api/admin/clock/assess` | 触发时钟评估 |
| `POST /api/admin/clock/confirm` | 人工确认时钟 |
| `POST/PUT/DELETE /api/v1/dca/*` | 定投写入操作 |
| `POST/DELETE /api/v1/admin/watchlist/*` | 关注列表管理 |
| `PUT /api/v1/admin/config/*` | 配置管理 |

### 响应格式
所有 API 返回统一格式: `{ ok: true, data: {...}, meta?: {...} }`

前端 `fetchJSON` 自动解包 `{ok, data}` → 直接返回 `data`。

## 认证系统 (`auth.py`)

三种方式，统一出口:
1. **本地密码** → `POST /api/auth/login` → JWT (HS256, 72h)
2. **Admin Token** → Bearer `ADMIN_API_TOKEN` → 兼容旧接口
3. **OAuth/Entra ID** → 预留 (`OAUTH_ENABLED=true` 启用)

凭据全部从环境变量读取，代码中不含真实密码。

## 安全措施
- 所有写入 API 需 JWT 认证 (`verify_admin_token`)
- 所有 SQL 使用参数化查询 (`?` placeholder)
- Pydantic 输入验证 (金额上限、正则、symbol白名单)
- Rate Limiting: 读取 60/min, 写入 10/min per IP
- JWT secret 从 `ADMIN_API_TOKEN` 派生，不硬编码

## 关注标的

港股: 腾讯(0700.HK), 阿里巴巴(9988.HK)
美股: 英伟达(NVDA), 特斯拉(TSLA), 微软(MSFT)
加密: 比特币(BTC-USD)
指数: 上证(000001.SS), 标普500(^GSPC), 恒生(^HSI)

**指数PE覆盖**: 沪深300, 上证50, 中证500, 中证1000, 创业板50, 中证800, 上证综指, S&P500 (28000+行)

## 运维

```bash
# 后端重启 (PM2 delete+start, 不用 restart)
pm2 delete goldenheat-api && pm2 start "python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 3009" --name goldenheat-api --cwd /opt/GoldenHeat

# 前端构建 & 部署
cd /opt/GoldenHeat/web && npm run build
rsync -a --delete dist/ /var/www/lishengms/heat/

# E2E 测试
cd /opt/GoldenHeat && python3 tests/e2e_test.py

# 数据采集
cd /opt/GoldenHeat && python3 -m backend.collectors.macro_cn
cd /opt/GoldenHeat && python3 -m backend.collectors.macro_us
cd /opt/GoldenHeat && python3 -m backend.collectors.index_pe

# 每日定时采集: cron 0 8 * * *
```

## 已知问题

1. **M2 NBS直采broken** — `macro_china_supply_of_money` demjson 解析错误，回退到 investing.com
2. **HSI PE缺失** — 恒生指数无免费公开PE API
3. **AI 评估依赖 LLM** — localhost:4399 不可用时 graceful 降级到纯算法
4. **Telegram 通知** — 目前是 stub
5. **Admin 密码** — 生产环境通过 `ADMIN_PASSWORD` 环境变量设置

## 产品路线图

- **V2.1** ✅ 首页三屏重构 + 三方加权时钟 + Admin 管理页 + 认证
- **V2.5** ✅ 架构升级: Repository 层 + 统一响应 + react-router + 新页面骨架
- **V2.6** ✅ 估值百分位 API + 前端对接
- **V2.7** ✅ 定投管理 API + 前端对接
- **V2.8** ✅ 战士模块 (技术分析 API + 前端对接)
- **V3.0** 🔲 VIX/情绪 + 通知 + AI 周报 + 回测 + 多用户
- **未来** 🔲 明暗主题切换 (CSS variables, 实现难度低)
