# GoldenHeat CLAUDE.md

## 项目概述
GoldenHeat 是一个 AI 中长周期投资决策系统。核心功能：美林时钟判断经济周期、月线信号判断标的时机、牛熊分割线判断大级别仓位。

## 关键原则
- **只做月线级别操作**，周线日线不做，等于赌博
- 美林时钟矫正投资大方向
- 标的月线 MA5/MA10/MA20 均线系统判断回调买入区
- 市场温度计 0-100 量化牛熊程度

## 技术栈
- 后端: Python + FastAPI + SQLite
- 数据: yfinance + akshare + fredapi
- 分析: pandas + numpy
- 前端: React + Vite + Recharts
- AI: copilot-proxy (localhost:4399) 辅助研判

## 项目结构
- `/backend/` — Python 后端代码
- `/web/` — React 前端
- `/docs/` — 设计文档和执行方案
- `/data/` — SQLite 数据库
- `/scripts/` — 工具脚本

## 数据库
SQLite，表结构见 `docs/DESIGN.md` 第四章

## 部署
- 后端: uvicorn on port TBD, PM2 管理
- 前端: Vite build → Nginx serve at lishengms.com/goldenheat
- 数据: 定时采集 via APScheduler

## 风格
- 代码注释用中文
- 变量名用英文
- Commit message 用 conventional commits (feat/fix/docs)
