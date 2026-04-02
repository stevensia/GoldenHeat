# GoldenHeat — 执行方案 v1.0

> **执行人**: 小马 (main agent) — 技术开发
> **审核人**: Lisa (commander) — 进度跟踪
> **财务顾问**: Grace — 模型校验 + 投资逻辑审核
> **分配时间**: 2026-04-02
> **预计工期**: Phase 1-2 约 1 周, Phase 3 约 3-5 天

---

## 项目结构

```
/opt/GoldenHeat/
├── README.md
├── docs/
│   ├── DESIGN.md              # 产品设计文档
│   └── EXECUTION.md           # 本文件：执行方案
├── backend/                   # Python 后端
│   ├── pyproject.toml         # 依赖管理 (uv/pip)
│   ├── main.py                # FastAPI 入口
│   ├── config.py              # 配置
│   ├── db/
│   │   ├── __init__.py
│   │   ├── connection.py      # SQLite 连接
│   │   └── schema.sql         # 建表 SQL
│   ├── collectors/            # 数据采集
│   │   ├── __init__.py
│   │   ├── macro_cn.py        # 中国宏观 (akshare)
│   │   ├── macro_us.py        # 美国宏观 (FRED)
│   │   ├── kline.py           # K线数据 (yfinance)
│   │   ├── valuation.py       # 估值数据
│   │   └── scheduler.py       # 定时采集 (APScheduler)
│   ├── engines/               # 分析引擎
│   │   ├── __init__.py
│   │   ├── merill_clock.py    # 美林时钟
│   │   ├── monthly_signal.py  # 月线信号
│   │   ├── bull_bear.py       # 牛熊分割线
│   │   └── temperature.py     # 市场温度计
│   ├── ai/                    # LLM 辅助
│   │   ├── __init__.py
│   │   ├── advisor.py         # AI 分析师
│   │   └── prompts.py         # Prompt 模板
│   ├── api/                   # API 路由
│   │   ├── __init__.py
│   │   ├── dashboard.py       # 仪表盘数据 API
│   │   ├── signals.py         # 信号查询 API
│   │   └── admin.py           # 管理接口
│   └── notify/                # 通知
│       ├── __init__.py
│       ├── telegram.py        # Telegram 通知
│       └── email.py           # 邮件周报
├── web/                       # React 前端
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx
│       ├── pages/
│       │   └── Dashboard.tsx  # 主仪表盘
│       ├── components/
│       │   ├── MerillClock.tsx
│       │   ├── TemperatureGauge.tsx
│       │   ├── SignalTable.tsx
│       │   ├── BullBearChart.tsx
│       │   └── AIDigest.tsx
│       └── api/
│           └── client.ts
├── data/                      # SQLite 数据文件
│   └── .gitkeep
└── scripts/
    ├── init_db.py             # 初始化数据库
    ├── backfill.py            # 历史数据回填
    └── test_engines.py        # 引擎测试
```

---

## Phase 1: 数据层 + 美林时钟引擎（Day 1-2）

### 任务清单

#### 1.1 项目初始化
- [x] 创建目录结构
- [x] README.md + DESIGN.md + EXECUTION.md
- [x] git init + push to GitHub
- [ ] `pyproject.toml` 依赖配置
- [ ] SQLite schema 建表脚本
- [ ] 配置文件 (API keys, watchlist)

#### 1.2 数据采集器
- [ ] `kline.py` — yfinance 拉取月线 K 线（中港美 + BTC + 指数）
- [ ] `macro_cn.py` — akshare 拉取中国宏观（CPI/PPI/PMI/GDP/M2/LPR）
- [ ] `macro_us.py` — fredapi 拉取美国宏观（CPI/GDP/非农/FFR）
- [ ] `valuation.py` — 估值数据（PE/PB 分位）
- [ ] `scheduler.py` — APScheduler 定时任务（每日/每周/每月）
- [ ] `backfill.py` — 回填历史数据（至少 10 年月线）

#### 1.3 美林时钟引擎
- [ ] `merill_clock.py` — 四阶段判断逻辑
- [ ] GDP 趋势计算（4 季度滑动窗口）
- [ ] CPI 趋势计算（6 月滑动窗口）
- [ ] PMI 矫正因子
- [ ] 信贷领先指标
- [ ] 阶段转换预警
- [ ] 偏离度计算（当前持仓 vs 推荐配置）

#### 1.4 测试验证
- [ ] 用历史数据验证美林时钟 2020-2025 的判断准确性
- [ ] 输出每个季度的阶段判断 + 回测收益对比

**交付物**: 可运行的数据采集 + 美林时钟引擎，能输出当前阶段判断

---

## Phase 2: 月线信号 + 牛熊分割线（Day 3-4）

#### 2.1 月线信号引擎
- [ ] `monthly_signal.py` — 信号计算主类
- [ ] MA5/MA10/MA20 均线系统
- [ ] 趋势判断（多头/空头/震荡）
- [ ] 回调位置判断（回踩哪根均线）
- [ ] 成交量分析（缩量/放量）
- [ ] 估值锚定（PE 分位加减分）
- [ ] 综合评分（0-100）+ 信号级别

#### 2.2 牛熊分割线
- [ ] `bull_bear.py` — 牛熊判断
- [ ] 年线（月线 MA12）位置
- [ ] 两年线（月线 MA24）位置
- [ ] 四阶段判断（牛/牛初/熊初/熊）
- [ ] 仓位建议映射

#### 2.3 市场温度计
- [ ] `temperature.py` — 综合温度
- [ ] PE 分位权重
- [ ] 均线位置权重
- [ ] 成交量异常权重
- [ ] 输出 0-100 温度值

#### 2.4 API 层
- [ ] FastAPI 主入口
- [ ] `GET /api/dashboard` — 仪表盘聚合数据
- [ ] `GET /api/signals` — 标的信号列表
- [ ] `GET /api/merill` — 美林时钟状态
- [ ] `GET /api/bullbear` — 牛熊状态
- [ ] `POST /api/refresh` — 手动刷新数据

**交付物**: 完整的分析引擎 + API，能返回所有标的的月线信号和牛熊状态

---

## Phase 3: Web Dashboard + AI + 通知（Day 5-7）

#### 3.1 前端仪表盘
- [ ] React + Vite 项目初始化
- [ ] `MerillClock.tsx` — 美林时钟可视化（圆盘 + 指针）
- [ ] `TemperatureGauge.tsx` — 温度计组件
- [ ] `SignalTable.tsx` — 标的信号热力表
- [ ] `BullBearChart.tsx` — 牛熊分割线图（月线 + 年线叠加）
- [ ] `Dashboard.tsx` — 主页面组合
- [ ] 部署到 lishengms.com/goldenheat

#### 3.2 AI 辅助
- [ ] `advisor.py` — 接入 copilot-proxy LLM
- [ ] 周报生成 prompt
- [ ] 信号对抗式审视 prompt
- [ ] `AIDigest.tsx` — 前端展示 AI 分析

#### 3.3 通知系统
- [ ] Telegram Bot 通知（通过 Grace agent 推送）
- [ ] 每周日自动周报
- [ ] 信号变化即时通知

#### 3.4 部署
- [ ] Nginx 反向代理配置
- [ ] PM2 / systemd 后端进程
- [ ] 定时采集 cron

**交付物**: 完整可用的 Web Dashboard + Telegram 通知

---

## Phase 4: 优化 + 回测（后续）

- [ ] 2015-2025 历史回测
- [ ] 美林时钟准确率统计
- [ ] 月线信号胜率统计
- [ ] 参数调优（均线周期、阈值等）
- [ ] 加入更多标的
- [ ] 移动端适配

---

## 任务分配

### 🐴 小马（技术主力）
- Phase 1 全部：数据采集器 + 美林时钟引擎 + SQLite schema
- Phase 2 全部：月线信号 + 牛熊分割线 + API
- Phase 3 前端：React Dashboard
- Phase 3 部署：Nginx + PM2

### 👩‍🎓 Grace（财务审核）
- 审核美林时钟判断逻辑的合理性
- 审核月线信号评分模型
- 提供 Steven 当前持仓数据（计算偏离度）
- 审核 AI prompt 的投资逻辑

### 👩‍💼 Lisa（项目管理）
- 进度跟踪
- 代码审核
- Phase 3 AI 辅助层（prompt engineering）
- 集成测试

---

## 关键依赖

```toml
# Python 依赖
[project]
dependencies = [
    "fastapi>=0.115",
    "uvicorn>=0.34",
    "yfinance>=0.2",
    "akshare>=1.15",
    "fredapi>=0.5",
    "pandas>=2.2",
    "numpy>=2.0",
    "ta-lib>=0.5",       # 技术分析（如系统无 TA-Lib C 库，用 pandas-ta 替代）
    "apscheduler>=3.10",
    "httpx>=0.27",
    "python-dotenv>=1.0",
]
```

```json
// 前端依赖
{
  "dependencies": {
    "react": "^19",
    "react-dom": "^19",
    "recharts": "^2.12",
    "@tanstack/react-query": "^5"
  }
}
```

---

## 部署规范

### 前端部署
- **域名路径**: `lishengms.com/heat`
- **访问权限**: 公开访问，无需登录
- **前端构建**: Vite build → 静态文件部署到 `/var/www/lishengms/heat/`

### API 安全防护

#### Rate Limiting（防爬/防滥用）
- 公开只读 API（dashboard/signals/merill/bullbear）: 60 req/min per IP
- 写入 API（refresh/admin）: 10 req/min per IP
- 使用 FastAPI middleware 或 slowapi 实现

#### 认证与授权
- **只读 API**: 公开，无需认证
- **写入 API**（`POST /api/refresh`, `/api/admin/*`）: 需要 `Authorization: Bearer <TOKEN>` 保护
- Token 在 `.env` 中配置 `ADMIN_API_TOKEN`

#### CORS
- 限制为 `https://lishengms.com` 和 `http://localhost:*`（开发用）
- 禁止 `*` 通配

#### 数据隐私
- **禁止暴露**: 实际持仓金额、具体资产数量、个人账户信息
- **允许展示**: 配置比例（%）、市场温度（0-100）、信号评级、偏离度（%）、美林时钟阶段
- 所有 API 返回数据需经 sanitize 层过滤

### Nginx 配置

```nginx
server {
    listen 443 ssl;
    server_name lishengms.com;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    # 前端静态文件
    location /heat {
        alias /var/www/lishengms/heat;
        try_files $uri $uri/ /heat/index.html;
    }

    # API 反向代理
    location /heat/api {
        proxy_pass http://127.0.0.1:3009;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Rate limiting zone
        limit_req zone=goldenheat burst=20 nodelay;
    }
}
```

### 后端进程管理
- **PM2 进程名**: `goldenheat-api`
- **端口**: 3009
- **启动命令**: `cd /opt/GoldenHeat/backend && uvicorn main:app --host 127.0.0.1 --port 3009`
- **定时采集**: APScheduler 内置（每日 08:00 K线 + 每月宏观数据）

---

## 风险与注意事项

1. **数据源可靠性**：akshare/yfinance 免费 API 可能限流或变更，需要做错误重试 + 多源备份
2. **TA-Lib 安装**：C 语言库在 Linux 上需要编译安装，备选方案用 pandas-ta
3. **美林时钟滞后性**：GDP 数据季度更新，PMI 月度更新，判断会有 1-3 个月滞后
4. **不做短线**：整个系统的设计原则是月线级别，任何短线相关的需求都拒绝
5. **投资建议免责**：系统输出仅供参考，不构成投资建议

---

*GoldenHeat Execution Plan v1.0 — 2026-04-02*
