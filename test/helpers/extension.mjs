import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const fixtures = path.join(root, "test", "fixtures");

// 真实 Chromium + --load-extension 加载本扩展。
// 注意必须 channel: 'chromium'：默认 headless shell 不支持加载扩展。
export async function launchExtensionContext() {
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    viewport: { width: 1280, height: 900 },
    args: [
      `--disable-extensions-except=${root}`,
      `--load-extension=${root}`,
      "--no-first-run",
      "--no-default-browser-check"
    ]
  });
  return context;
}

// 用 Playwright 路由拦截把 github.com / gist.github.com 指向本地 fixture，
// 浏览器不真正出网，content script 仍按 URL 规则注入。
export async function mockGitHub(context) {
  const routeFixture = (fixture) => (route) =>
    route.fulfill({ path: path.join(fixtures, fixture), contentType: "text/html" });

  await context.route("https://github.com/**", (route) => {
    const { pathname } = new URL(route.request().url());
    let file = "dashboard.html";
    if (pathname.startsWith("/XingAur/github_chinese/actions")) file = "actions.html";
    else if (pathname.startsWith("/XingAur/github_chinese/issues")) file = "issue.html";
    else if (pathname.startsWith("/XingAur/github_chinese")) file = "repo.html";
    else if (pathname.startsWith("/notifications")) file = "notifications.html";
    return route.fulfill({ path: path.join(fixtures, file), contentType: "text/html" });
  });
  await context.route("https://gist.github.com/**", routeFixture("gist.html"));
}

// 获取未打包扩展的 ID：优先从 chrome://extensions 页面 DOM 读取，
// 失败时回退到 Chromium 的路径哈希算法（SHA256(绝对路径) 前 32 位映射 a-p）。
export async function getExtensionId(context) {
  const page = await context.newPage();
  try {
    await page.goto("chrome://extensions");
    await page.waitForSelector("extensions-manager", { timeout: 5000 });
    const ids = await page.evaluate(() => {
      const manager = document.querySelector("extensions-manager");
      const list = manager?.shadowRoot?.querySelector("extensions-item-list");
      const items = list?.shadowRoot?.querySelectorAll("extensions-item");
      return [...(items ?? [])].map((item) => item.id);
    });
    if (ids?.length) return ids[0];
  } catch {
    // 回退到路径哈希
  } finally {
    await page.close();
  }

  const candidates = new Set([root, root.split(path.sep).join("\\"), root.split(path.sep).join("/")]);
  for (const candidate of candidates) {
    const hash = createHash("sha256").update(candidate).digest("hex").slice(0, 32);
    return [...hash].map((c) => "abcdefghijklmnop"[parseInt(c, 16)]).join("");
  }
  throw new Error("无法获取扩展 ID");
}
