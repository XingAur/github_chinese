import { test as base, expect } from "@playwright/test";
import { launchExtensionContext, mockGitHub, getExtensionId } from "./helpers/extension.mjs";

const REPO_URL = "https://github.com/XingAur/github_chinese";

const test = base.extend({
  context: async ({}, use) => {
    const context = await launchExtensionContext();
    await mockGitHub(context);
    await use(context);
    await context.close();
  }
});

test("仓库页：导航、按钮与正则文案翻译", async ({ page }) => {
  await page.goto(REPO_URL);
  await expect(page.locator("nav.UnderlineNav a", { hasText: "代码" })).toBeVisible();
  await expect(page.locator("nav.UnderlineNav a", { hasText: "PR" })).toBeVisible();
  await expect(page.locator("nav.UnderlineNav a", { hasText: "洞察" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Fork", exact: true })).toBeVisible();
  await expect(page.locator(".Counter")).toHaveText("42 次提交");
  await expect(page.getByText("Fork 自 maboloshi/github-chinese")).toBeVisible();
});

test("仓库页：placeholder/aria-label 属性与文档标题翻译", async ({ page }) => {
  await page.goto(REPO_URL);
  await expect(page.locator("header input")).toHaveAttribute("placeholder", "搜索或跳转...");
  await expect(page.locator("header input")).toHaveAttribute("aria-label", "搜索或跳转...");
  await expect.poll(() => page.title()).toBe("Issue · XingAur/github_chinese");
});

test("保护区：代码块、README 正文、评论正文不翻译", async ({ page }) => {
  await page.goto(REPO_URL);
  // 先等翻译生效，再确认保护区内容未被改动
  await expect(page.locator("nav.UnderlineNav a", { hasText: "洞察" })).toBeVisible();
  await expect(page.locator("pre code")).toContainText("npm install github-chinese-enhancer");
  await expect(page.locator(".markdown-body p")).toHaveText(
    "This README content should stay in English because it is user content."
  );
  await expect(page.locator(".comment-body p")).toHaveText("Comment body stays English too.");
});

test("时间本地化：语言标记写入 html 与时间元素", async ({ page }) => {
  await page.goto(REPO_URL);
  await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe("zh-CN");
  await expect(page.locator("relative-time")).toHaveAttribute("lang", "zh-CN");
  await expect(page.locator("time-ago")).toHaveAttribute("lang", "zh-CN");
});

test("动态节点：MutationObserver 增量翻译", async ({ page }) => {
  await page.goto(REPO_URL);
  // fixture 在 500ms 后插入 "Create pull request" 按钮
  await expect(page.locator("#dynamic-zone button")).toHaveText("发起 PR", { timeout: 8000 });
});

test("SPA 跳转：pushState 后新内容与标题翻译", async ({ page }) => {
  await page.goto(REPO_URL);
  await page.locator("#spa-btn").click();
  await expect(page.locator(".Box-header")).toHaveText("新建 Issue");
  await expect(page.getByText("未设里程碑")).toBeVisible();
  await expect.poll(() => page.title()).toBe("新建 Issue · XingAur/github_chinese");
});

test("Issue 页：时间线动词与侧栏空态", async ({ page }) => {
  await page.goto(`${REPO_URL}/issues/1`);
  await expect(page.locator(".TimelineItem span", { hasText: "提交了" })).toBeVisible();
  await expect(page.locator(".TimelineItem span", { hasText: "发布了这个" })).toBeVisible();
  await expect(page.locator(".TimelineItem span", { hasText: "合并了这个" })).toBeVisible();
  await expect(page.locator(".TimelineItem span", { hasText: "关闭了这个，状态为" })).toBeVisible();
  await expect(page.locator(".sidebar span").first()).toHaveText("未设里程碑");
  await expect(page.locator("textarea")).toHaveAttribute("placeholder", "写评论");
});

test("Actions 页：白名单内翻译，日志与 YAML 受保护", async ({ page }) => {
  await page.goto(`${REPO_URL}/actions/runs/123`);
  await expect(page.locator("nav.UnderlineNav a", { hasText: "摘要" })).toBeVisible();
  await expect(page.locator(".Box-header h2")).toHaveText("运行工作流");
  await expect(page.locator(".Box-header span")).toHaveText("排队中");
  await expect(page.locator(".Box-body button")).toHaveText("重新运行失败任务");
  await expect(page.locator(".Box-body span")).toHaveText(
    "这个任务失败了，因为其中一个或多个步骤失败了。"
  );
  await expect(page.locator('[data-testid="log-body"] div').first()).toContainText(
    "Run npm install && npm run build"
  );
  await expect(page.locator('[data-testid="log-body"] div').nth(1)).toContainText(
    "##[error]Process completed with exit code 1."
  );
  await expect(page.locator("pre code")).toContainText("runs-on: ubuntu-latest");
});

test("Actions 页：body 之外浮层 portal 的用户菜单也会被翻译", async ({ page }) => {
  await page.goto(`${REPO_URL}/actions/runs/123`);
  await page.locator("#menu-btn").click();
  const menu = page.locator("#__primerPortalRoot__ [role='menu']");
  await expect(menu.locator("a").first()).toHaveText("Star 数", { timeout: 8000 });
  await expect(menu.locator("a").nth(1)).toHaveText("Gist");
  await expect(menu.locator("a").nth(2)).toHaveText("Copilot 设置");
  await expect(menu.locator("a").nth(3)).toHaveText("设置");
  await expect(menu.locator("a").nth(4)).toHaveText("退出登录");
});

test("首页：搜索范围下拉与推荐区翻译", async ({ page }) => {
  await page.goto("https://github.com/");
  await expect(page.locator(".dropdown-item").first()).toHaveText("在此仓库中搜索");
  await expect(page.locator(".dropdown-item").nth(1)).toHaveText("在此用户下搜索");
  await expect(page.locator(".dropdown-item").nth(2)).toHaveText("全部 GitHub");
  await expect(page.locator("main h2")).toHaveText("入门指南");
});

test("通知页：收件箱、筛选与通知原因翻译", async ({ page }) => {
  await page.goto("https://github.com/notifications");
  await expect(page.locator("nav.UnderlineNav a", { hasText: "收件箱" })).toBeVisible();
  await expect(page.locator(".Box-header button")).toHaveText("标记为已完成");
  await expect(page.locator(".Box-header span").first()).toHaveText("排序方式：");
  await expect(page.locator(".Box-header span").nth(1)).toHaveText("从新到旧");
  await expect(page.locator(".Box-header span").nth(2)).toHaveText("筛选");
  await expect(page.locator(".notifications-list-item span", { hasText: "指派给你" })).toBeVisible();
  await expect(page.locator(".notifications-list-item span", { hasText: "请求审查" })).toBeVisible();
  await expect(page.locator(".notifications-list-item span", { hasText: "提及" })).toBeVisible();
  // 动态插入的筛选标签走增量翻译
  await expect(page.locator("#dynamic-filter span")).toHaveText("推荐筛选", { timeout: 8000 });
});

test("Gist 页面：内容脚本注入并翻译", async ({ page }) => {
  await page.goto("https://gist.github.com/");
  await expect(page.locator("header nav a", { hasText: "发现" })).toBeVisible();
});

test("浮层 portal：挂在 body 之外的用户菜单也会被翻译", async ({ page }) => {
  await page.goto(REPO_URL);
  await page.locator("#menu-btn").click();
  const menu = page.locator("#__primerPortalRoot__ [role='menu']");
  await expect(menu.locator("a").first()).toHaveText("Star 数");
  await expect(menu.locator("a").nth(1)).toHaveText("Gist");
  await expect(menu.locator("a").nth(2)).toHaveText("组织");
  await expect(menu.locator("a").nth(3)).toHaveText("Copilot 设置");
  await expect(menu.locator("a").nth(4)).toHaveText("设置");
  await expect(menu.locator("a").nth(5)).toHaveText("退出登录");
});

test("弹窗：版本显示与汉化开关全链路", async ({ context }) => {
  const extensionId = await getExtensionId(context);

  const page = await context.newPage();
  await page.goto(REPO_URL);
  await expect(page.locator("nav.UnderlineNav a", { hasText: "代码" })).toBeVisible();

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  await expect(popup.locator("#version")).toHaveText("v0.3.0");

  // 关闭汉化：观察器断开，之后插入的节点保持英文
  await popup.locator("#enabled").uncheck();
  await expect(popup.locator("#status")).toContainText("已关闭");
  await popup.waitForTimeout(300);
  await page.evaluate(() => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Create pull request";
    document.getElementById("dynamic-zone").appendChild(btn);
  });
  await page.waitForTimeout(800);
  await expect(page.locator("#dynamic-zone button").last()).toHaveText("Create pull request");

  // 重新开启：全量重扫把已存在的按钮翻回来
  await popup.locator("#enabled").check();
  await expect(page.locator("#dynamic-zone button").last()).toHaveText("发起 PR", { timeout: 8000 });
});
