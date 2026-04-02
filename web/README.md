# GoldenHeat Web

## 说明
这个目录是 GoldenHeat 的 React + Vite 前端工程。

## 当前重点页面
- `src/pages/Dashboard.tsx` — 首页主面板，当前所有重点讨论都集中在这里

## 2026-04-02 当前状态
首页已经做过一轮大改版，当前可视为“可继续打磨的基础版”。

### 目前首页结构
1. 顶部核心图表
   - 美林时钟
   - 市场热度
   - 资产分配
2. 总览说明区
   - 美林时钟
   - 资产配置
   - 市场热度（A股 / 美股 / 港股 / 加密）
3. 牛熊分界指标图
4. 趋势结构图 / 趋势评分图
5. 月线信号清单
6. 牛熊仓位建议

### 当前已确认的要求
- 中文标题优先
- 图表优先，说明收缩
- 顶部图表的关键数字要尽量嵌入图中
- Tooltip 要简短，不能遮挡图表
- Recharts hover 灰色方块已修复，继续新增图表时记得：
  ```tsx
  <Tooltip cursor={false} ... />
  ```

### 当前不要做的事
- 不要默认继续使用最近那个 SVG 美林时钟实验版
- 不要再次整体推翻首页风格
- 不要把说明文字重新堆回图表下面

## 本地开发
```bash
cd /opt/GoldenHeat/web
npm install
npm run dev
```

## 构建
```bash
cd /opt/GoldenHeat/web
npm run build
```

## 发布
```bash
rsync -a --delete dist/ /var/www/lishengms/heat/
```

## 后续接手建议
先读：
1. `/opt/GoldenHeat/CLAUDE.md`
2. `/opt/GoldenHeat/README.md`
3. `src/pages/Dashboard.tsx`

再决定要不要继续调首页。
