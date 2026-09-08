// 生成项目视觉物料:logo(512/300)与横幅(1280×640,仓库社交预览/README 头图)
// 依赖本地 Playwright Chromium:npm install 后直接 node scripts/gen-logo.mjs
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "assets", "logo");
mkdirSync(outDir, { recursive: true });

const FONT_HAN = `"Microsoft YaHei", "PingFang SC", sans-serif`;
const FONT_UI = `"Segoe UI", "Microsoft YaHei", sans-serif`;

// 图标主体:深色圆角方块 + 大号「汉」+ 绿色 </>
function logoSvg(size, withRoundedCorners = true) {
  const rx = withRoundedCorners ? size * 0.22 : 0;
  const hanSize = size * 0.52;
  const hanY = size * 0.44;
  const codeSize = size * 0.17;
  const codeY = size * 0.76;
  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1a2433"/>
      <stop offset="1" stop-color="#10161f"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3fb950"/>
      <stop offset="1" stop-color="#2ea043"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#bg)" stroke="#3d4757" stroke-width="${size * 0.008}"/>
  <text x="${size / 2}" y="${hanY}" font-family="${FONT_HAN}" font-weight="700"
        font-size="${hanSize}" fill="#e6edf3" text-anchor="middle" dominant-baseline="central">汉</text>
  <text x="${size / 2}" y="${codeY}" font-family="ui-monospace, Consolas, monospace" font-weight="700"
        font-size="${codeSize}" fill="url(#accent)" text-anchor="middle" dominant-baseline="central">&lt;/&gt;</text>
</svg>`;
}

// 横幅:左侧 logo + 右侧标题与特性
const bannerSvg = `
<svg width="1280" height="640" viewBox="0 0 1280 640" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#10161f"/>
      <stop offset="1" stop-color="#0d1117"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3fb950"/>
      <stop offset="1" stop-color="#2ea043"/>
    </linearGradient>
    <pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse">
      <path d="M 64 0 L 0 0 0 64" fill="none" stroke="#1c2431" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="1280" height="640" fill="url(#bg)"/>
  <rect width="1280" height="640" fill="url(#grid)"/>
  <rect x="8" y="8" width="1264" height="624" rx="28" fill="none" stroke="#30363d" stroke-width="2"/>

  <g transform="translate(96, 108)">
    <rect width="424" height="424" rx="96" fill="#1a2433" stroke="#3d4757" stroke-width="3"/>
    <text x="212" y="186" font-family="${FONT_HAN}" font-weight="700" font-size="224" fill="#e6edf3"
          text-anchor="middle" dominant-baseline="central">汉</text>
    <text x="212" y="322" font-family="ui-monospace, Consolas, monospace" font-weight="700" font-size="72"
          fill="url(#accent)" text-anchor="middle" dominant-baseline="central">&lt;/&gt;</text>
  </g>

  <g transform="translate(620, 158)">
    <text font-family="${FONT_HAN}" font-weight="700" font-size="88" fill="#e6edf3">GitHub 中文增强</text>
    <text y="64" font-family="${FONT_UI}" font-size="34" fill="#9fb0c3">GitHub Chinese · Chrome / Edge 浏览器扩展</text>
    <g font-family="${FONT_UI}" font-size="32" fill="#c9d1d9">
      <text y="164" fill="#3fb950">✓</text><text x="44" y="164">时间戳自动本地化,零词库成本</text>
      <text y="222" fill="#3fb950">✓</text><text x="44" y="222">增量翻译,动态页面与浮层即时生效</text>
      <text y="280" fill="#3fb950">✓</text><text x="44" y="280">不碰代码、日志与文档正文</text>
    </g>
  </g>
</svg>`;

async function renderSvg(browser, svg, width, height, outPath) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`
  );
  await page.screenshot({ path: outPath });
  await page.close();
  console.log("generated:", path.relative(root, outPath));
}

const browser = await chromium.launch({ channel: "chromium", headless: true });
await renderSvg(browser, logoSvg(512), 512, 512, path.join(outDir, "logo-512.png"));
await renderSvg(browser, logoSvg(300), 300, 300, path.join(outDir, "icon-300.png"));
await renderSvg(browser, bannerSvg, 1280, 640, path.join(outDir, "banner-1280x640.png"));
await browser.close();
