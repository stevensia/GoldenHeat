# CLAUDE.md — GoldenHeat 项目指南

> AI 中长周期投资决策系统 — 美林时钟 + 月线信号 + 估值百分位

## 项目概述

GoldenHeat 是一个面向月度/季度周期的宏观投资决策面板，核心功能：

1. **美林投资时钟** — 三方加权（算法 + AI + 人工），0-12 点位系统，支持中国/美国双市场
2. **月线信号** — 多标的月线技术信号（MA 趋势 + 回调 + 量能 + 估值）
3. **牛熊分割线** — MA12/MA24 双均线判断市场阶段
4. **市场温度** — 综合 PE 百分位 + MA 偏离 + 量能变化

**设计哲学**: "历史位置感" — 不看绝对数字，看你在 10 年周期中的位置。

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Python 3 + FastAPI + SQLite |
| 前端 | React + TypeScript + Vite + Tailwind CSS + Recharts |
| 数据源 | akshare(中国宏观) + FRED API(美国宏观) + yfinance(行情/估值) |
| 部署 | PM2 + Nginx, 静态文件 rsync |
| 认证 | JWT + 本地密码 + OAuth/Entra ID(预留) |

## 目录结构

```
/opt/GoldenHeat/
├── backend/
│   ├── main.py              # FastAPI 入口, CORS, Rate Limiting, 路由挂载
│   ├── config.py            # 配置: DB路径, 关注标的, 引擎参数, API token
│   ├── api/                 # REST API 路由
│   │   ├── auth.py          # 认证核心: JWT签发/验证, 本地登录, OAuth/Entra ID
│   │   ├── auth_routes.py   # 认证路由: /auth/login, /auth/me, /auth/oauth/*
│   │   ├── dashboard.py     # GET /dashboard — 仪表盘聚合数据
│   │   ├── admin_clock.py   # 时钟管理 API (需认证): assess, confirm, history
│   │   ├── clock_public.py  # GET /clock/summary — 双市场时钟(无需认证)
│   │   ├── valuation.py     # GET /valuation/history — PE 百分位历史
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
│   │   ├── monthly_signal.py# 月线技术信号: MA趋势+回调+量能+估值
│   │   ├── bull_bear.py     # 牛熊分割线: MA12 vs MA24
│   │   └── temperature.py   # 市场温度: PE百分位+MA偏离+量能
│   ├── collectors/          # 数据采集器
│   │   ├── macro_cn.py      # 中国宏观(akshare): GDP/CPI/PPI/PMI/M2
│   │   ├── macro_us.py      # 美国宏观(FRED): GDP/CPI/Fed Rate/Payroll
│   │   ├── kline.py         # K 线数据(yfinance)
│   │   └── valuation.py     # 估值数据(yfinance): PE/PB/百分位
│   ├── db/
│   │   ├── connection.py    # SQLite 连接管理
│   │   └── schema.sql       # 表结构定义
│   ├── notify/
│   │   └── telegram_notify.py  # Telegram 通知(stub)
│   └── scripts/
│       ├── migrate_clock.py    # 时钟评估表迁移
│       └── backfill_valuation.py # 10 年估值回填
├── web/                     # React 前端
│   ├── src/
│   │   ├── App.tsx          # Hash router: #/ 首页, #/admin/clock 管理
│   │   ├── api/
│   │   │   ├── client.ts    # API 客户端: fetch 封装 + 认证
│   │   │   └── types.ts     # TypeScript 类型定义
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx    # 首页三屏: 宏观定位 → 标的信号 → 数据溯源
│   │   │   └── AdminClock.tsx   # 管理页: 评估详情+指标+人工确认+科普
│   │   └── components/      # UI 组件
│   │       ├── MerillClock.tsx      # 美林时钟圆盘 + 指针
│   │       ├── PercentileBar.tsx    # PE 百分位条
│   │       ├── BullBearSparkline.tsx# 牛熊趋势迷你图
│   │       ├── DataSourcePanel.tsx  # 数据溯源折叠面板
│   │       ├── PhilosophyBanner.tsx # 顶部哲学标语
│   │       └── ...
│   └── vite.config.ts
├── data/
│   └── goldenheat.db       # SQLite 数据库
├── docs/
│   ├── HEAT2-PLAN.md       # V2 执行计划
│   └── ref/
│       └── merrill-clock-research.md # 美林时钟理论研究
├── .env                     # 敏感配置(gitignored): FRED_API_KEY, 密码, Token
└── .claude/                 # Claude Code 任务书
    ├── task-a.md ~ task-d.md
    └── progress-a.md ~ progress-d.md
```

## 数据库表

| 表 | 用途 |
|---|---|
| `macro_data` | 宏观指标时间序列 (indicator, date, value, source) |
| `kline_data` | K 线月线数据 (symbol, date, open, high, low, close, volume) |
| `valuation` | 估值数据 (symbol, date, pe, pb, pe_percentile, pb_percentile) |
| `signals` | 信号快照 (symbol, date, signal_type, signal_value JSON) |
| `clock_assessments` | 时钟评估历史 (市场, 算法/AI/人工三方, 最终加权, 触发类型) |
| `indicator_history` | 指标变更追踪 (关联 assessment, 含前值对比) |

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

## 认证系统 (`auth.py`)

三种方式，统一出口:
1. **本地密码** → `POST /api/auth/login` → JWT
2. **Admin Token** → Bearer `ADMIN_API_TOKEN` → 兼容旧接口
3. **OAuth/Entra ID** → `GET /api/auth/oauth/authorize` → callback → JWT

凭据全部从环境变量读取，代码中不含真实密码。

## 关注标的 (config.py WATCHLIST)

港股: 腾讯(0700.HK), 阿里巴巴(9988.HK)
美股: 英伟达(NVDA), 特斯拉(TSLA), 微软(MSFT)
加密: 比特币(BTC-USD)
指数: 上证(000001.SS), 标普500(^GSPC), 恒生(^HSI)

## 运维

```bash
# 后端
pm2 delete goldenheat-api && pm2 start "cd /opt/GoldenHeat && python3 -m uvicorn backend.main:app --host 127.0.0.1 --port 3009" --name goldenheat-api

# 前端构建 & 部署
cd /opt/GoldenHeat/web && npm run build
rsync -a --delete dist/ /var/www/lishengms/heat/

# 数据采集
cd /opt/GoldenHeat && python3 -m backend.collectors.macro_cn
cd /opt/GoldenHeat && python3 -m backend.collectors.macro_us
cd /opt/GoldenHeat && python3 -m backend.collectors.valuation

# 数据库迁移
cd /opt/GoldenHeat && python3 -m backend.scripts.migrate_clock
```

## 已知问题

1. **akshare 中国数据滞后** — 接口只到 2025-08，需手动补录或换数据源
2. **指数 PE 数据缺失** — 000001.SS, ^GSPC, ^HSI 无 PE（yfinance 不返回指数 PE）
3. **AI 评估** — 需要 LLM 可用（localhost:4399），不可用时 graceful 降级
4. **Telegram 通知** — 目前是 stub，待对接 Bot API

## 产品路线图

- **V2.1** ✅ 首页三屏重构 + 三方加权时钟 + Admin 管理页 + 认证
- **V2.2** 情绪维度: VIX + 美债利差 + 信用利差
- **V2.3** 个股详情页 + 持仓记录 + 北向资金
- **V2.4** Polymarket + 链上数据 + AI 周报
