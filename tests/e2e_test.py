#!/usr/bin/env python3
"""GoldenHeat 前端 E2E 测试 (Playwright headless)"""

import asyncio
import json
import sys
from playwright.async_api import async_playwright

BASE = "https://lishengms.com/heat/"
RESULTS = []

def log(test: str, ok: bool, detail: str = ""):
    status = "✅" if ok else "❌"
    RESULTS.append((test, ok, detail))
    print(f"  {status} {test}{f' — {detail}' if detail else ''}")


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # ──────── 1. 首页 Dashboard ────────
        print("\n=== 1. Dashboard 首页 ===")
        resp = await page.goto(BASE, wait_until="networkidle", timeout=15000)
        log("首页加载", resp and resp.ok, f"status={resp.status if resp else 'N/A'}")

        # 美林时钟
        clock = await page.query_selector("text=美林时钟")
        log("美林时钟可见", clock is not None)

        # 市场温度
        temp = await page.query_selector("text=市场温度")
        log("市场温度可见", temp is not None)

        # 信号表格
        signals = await page.query_selector("text=月线信号")
        log("月线信号可见", signals is not None)

        # 双时钟 (CN + US)
        cn_clock = await page.query_selector("text=🇨🇳")
        us_clock = await page.query_selector("text=🌍")
        log("双时钟(CN+US)", cn_clock is not None and us_clock is not None)

        # ──────── 2. 导航栏 ────────
        print("\n=== 2. 导航 ===")
        
        # 查找导航链接
        nav_links = await page.query_selector_all("nav a, aside a, a[href]")
        nav_texts = []
        for link in nav_links:
            text = (await link.inner_text()).strip()
            href = await link.get_attribute("href")
            if text and href:
                nav_texts.append((text, href))
        log("导航链接存在", len(nav_texts) > 0, f"{len(nav_texts)} links")

        # ──────── 3. 估值百分位页面 ────────
        print("\n=== 3. 估值百分位 ===")
        await page.goto(f"{BASE}#/valuation", wait_until="networkidle", timeout=10000)
        await page.wait_for_timeout(1000)
        
        title = await page.query_selector("text=估值")
        log("估值页面加载", title is not None)
        
        # 检查指数卡片
        cards = await page.query_selector_all("[class*='card'], [class*='rounded']")
        log("指数卡片存在", len(cards) > 0, f"{len(cards)} cards")

        # 沪深300
        hs300 = await page.query_selector("text=沪深300")
        log("沪深300可见", hs300 is not None)

        # ──────── 4. 定投管理页面 ────────
        print("\n=== 4. 定投管理 ===")
        await page.goto(f"{BASE}#/dca", wait_until="networkidle", timeout=10000)
        await page.wait_for_timeout(1000)
        
        dca_title = await page.query_selector("text=定投")
        log("定投页面加载", dca_title is not None)
        
        # 创建计划按钮
        create_btn = await page.query_selector("button")
        log("按钮存在", create_btn is not None)
        
        if create_btn:
            btn_text = await create_btn.inner_text()
            log("创建按钮可点击", "创建" in btn_text or "新建" in btn_text or "添加" in btn_text, btn_text)

        # ──────── 5. 战士页面 ────────
        print("\n=== 5. 战士/个股分析 ===")
        await page.goto(f"{BASE}#/warrior", wait_until="networkidle", timeout=10000)
        await page.wait_for_timeout(1000)
        
        warrior_title = await page.query_selector("text=战士")
        if not warrior_title:
            warrior_title = await page.query_selector("text=个股")
        log("战士页面加载", warrior_title is not None)

        # 搜索/选择
        search_input = await page.query_selector("input, select")
        log("股票搜索/选择存在", search_input is not None)

        # ──────── 6. Admin 时钟页面 ────────
        print("\n=== 6. Admin 时钟 ===")
        await page.goto(f"{BASE}#/admin/clock", wait_until="networkidle", timeout=10000)
        await page.wait_for_timeout(1000)
        
        # 可能需要登录
        login_form = await page.query_selector("input[type='password'], input[name='password']")
        admin_content = await page.query_selector("text=三方判断")
        if login_form:
            log("Admin登录页展示", True, "需要登录")
            # 尝试登录
            username_input = await page.query_selector("input[type='text'], input[name='username']")
            if username_input:
                await username_input.fill("steven")
                import os
                await login_form.fill(os.getenv("ADMIN_PASSWORD", "changeme"))
                submit = await page.query_selector("button[type='submit'], button:has-text('登录')")
                if submit:
                    await submit.click()
                    await page.wait_for_timeout(2000)
                    admin_content = await page.query_selector("text=三方判断")
                    log("Admin登录成功", admin_content is not None)
        else:
            log("Admin页面加载", admin_content is not None)

        # ──────── 7. API 健康检查 ────────
        print("\n=== 7. API 健康 ===")
        api_resp = await page.evaluate("""
            async () => {
                try {
                    const r = await fetch('/heat/api/health');
                    return { status: r.status, ok: r.ok };
                } catch(e) {
                    return { error: e.message };
                }
            }
        """)
        log("API /health", api_resp.get("ok", False), f"status={api_resp.get('status')}")

        api_clock = await page.evaluate("""
            async () => {
                try {
                    const r = await fetch('/heat/api/clock/summary');
                    const d = await r.json();
                    return { status: r.status, has_cn: !!d?.data?.cn || !!d?.cn };
                } catch(e) {
                    return { error: e.message };
                }
            }
        """)
        log("API /clock/summary", api_clock.get("has_cn", False), str(api_clock))

        api_dash = await page.evaluate("""
            async () => {
                try {
                    const r = await fetch('/heat/api/dashboard');
                    const d = await r.json();
                    const inner = d.data || d;
                    return {
                        status: r.status,
                        has_clock: !!inner.merill_clock,
                        has_temp: !!inner.market_temperature,
                        has_signals: !!inner.signals,
                    };
                } catch(e) {
                    return { error: e.message };
                }
            }
        """)
        log("API /dashboard", api_dash.get("has_clock") and api_dash.get("has_temp"), str(api_dash))

        await browser.close()

    # ──────── Summary ────────
    passed = sum(1 for _, ok, _ in RESULTS if ok)
    failed = sum(1 for _, ok, _ in RESULTS if not ok)
    print(f"\n{'='*50}")
    print(f"📊 测试结果: {passed} passed, {failed} failed, {len(RESULTS)} total")
    if failed:
        print("\n❌ 失败项:")
        for name, ok, detail in RESULTS:
            if not ok:
                print(f"   - {name}: {detail}")
    print(f"{'='*50}")
    
    sys.exit(1 if failed else 0)


asyncio.run(main())
