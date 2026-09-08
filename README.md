# GitHub 中文增强

一个面向程序员语境的 GitHub 汉化浏览器插件。它会把 GitHub 常见界面、按钮、输入框提示、设置页说明、仓库页面、Issue、Pull Request、Actions、Projects 等文案翻译成更顺手的中文，同时尽量保留 PR、Issue、Fork、Star、Runner、Token、Webhook 等开发者常用术语。

插件不会翻译代码块、Markdown 正文、评论正文、提交信息、Actions 日志、YAML 配置等用户内容，避免误伤真实代码和项目文档。

## 功能特性

- 汉化 GitHub 顶部导航、首页搜索框、仓库导航、个人主页、组织页等常见界面
- 汉化按钮、菜单、图标按钮提示、`placeholder`、`aria-label`、`title` 和确认弹窗
- 覆盖 Issue、Pull Request、Review、分支、标签、Release、讨论区等开发流程
- 覆盖 Settings 页面的大量菜单和说明文字，包括权限、安全、Actions、Pages、Webhook、Secrets、Variables、Danger Zone 等
- 覆盖 Actions 工作流页面的运行记录、Job、Step、Runner、缓存、产物、部署审批等界面
- 时间戳自动本地化：`3 days ago`、`about 1 hour ago` 等相对时间直接显示为中文（借助 GitHub 自带时间组件的多语言能力，不靠词库硬翻）
- 支持 Gist（`gist.github.com`）页面
- 支持 GitHub 动态加载页面和站内无刷新跳转
- 增量翻译：DOM 变化只处理变更子树，动态页面也保持流畅
- 提供弹窗开关，可随时启用、停用或手动重新翻译当前页
- 使用程序员习惯表达，例如“发起 PR”“提交改动”“审查”“同步 Fork”“部署密钥”

## 支持的浏览器

- Google Chrome
- Microsoft Edge
- 其他兼容 Manifest V3 的 Chromium 浏览器

Firefox 暂未作为主要目标测试。

## 安装教程

### 方式一：加载源码目录

适合本地开发、自己使用或继续修改词库。

1. 下载或克隆本项目到本地。
2. 打开 Chrome 或 Edge 的扩展管理页面：
   - Chrome：`chrome://extensions`
   - Edge：`edge://extensions`
3. 打开右上角的“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择本项目根目录（即包含 `manifest.json` 的目录），例如：

```text
D:\Code\github_chinese
```

6. 打开或刷新 `https://github.com/` 页面，插件会自动开始汉化。

### 方式二：使用打包 ZIP

适合把插件发给别人安装。

1. 执行打包命令：

```powershell
cd D:\Code\github_chinese
.\scripts\package.ps1
```

2. 打包完成后会生成：

```text
dist\github-cn-enhancer-0.3.0.zip
```

3. 将 ZIP 解压到一个固定目录。
4. 在浏览器扩展管理页打开“开发者模式”。
5. 点击“加载已解压的扩展程序”，选择解压后的目录。

注意：Chrome/Edge 的“加载已解压扩展”需要选择解压后的文件夹，不能直接选择 ZIP 文件。

## 使用教程

### 自动汉化 GitHub 页面

安装后访问 `https://github.com/`，插件会自动翻译页面上的 GitHub UI 文案。页面内容动态加载或站内跳转后，也会自动重新处理。

### 使用插件弹窗

点击浏览器工具栏里的“GitHub 中文增强”图标，可以看到两个主要操作：

- “启用汉化”：开启或关闭当前插件的汉化功能
- “立即作用到当前页”：手动重新翻译当前打开的 GitHub 页面

如果关闭汉化，已经翻译过的页面不会立刻恢复英文，刷新 GitHub 页面后会恢复原文。

### 首页搜索框

插件会翻译 GitHub 首页和顶部导航里的搜索提示，例如：

- `Search or jump to...` → `搜索或跳转...`
- `Type / to search` → `输入 / 开始搜索`
- `Search or ask Copilot` → `搜索或询问 Copilot`

### 仓库页面

常见仓库操作会被翻译，例如：

- `Code` → `代码`
- `Issues` → `Issue`
- `Pull requests` → `PR`
- `Create pull request` → `发起 PR`
- `Commit changes` → `提交改动`
- `Use this template` → `使用此模板`
- `Fetch upstream` → `拉取上游更新`

### Settings 页面

设置页的菜单和说明文字会尽量翻译，例如：

- 仓库常规设置
- 分支保护规则
- Actions 权限
- Secrets 和 Variables
- Webhooks
- GitHub Pages
- Deploy keys
- Danger Zone
- 访问权限管理

### Actions 页面

Actions 页面会优先翻译界面层文本，不翻译日志和 YAML 内容。这样可以看懂 Job、Step、Runner、Artifact、Cache、Deployment 等状态，又不会破坏命令输出。

## 项目结构

```text
.
├─ manifest.json             扩展配置，Manifest V3
├─ src/
│  ├─ translations.js         汉化词典和正则规则
│  └─ content.js              页面翻译、增量监听、时间本地化、跳转处理
├─ popup/
│  ├─ popup.html              插件弹窗页面
│  ├─ popup.css               弹窗样式
│  └─ popup.js                弹窗开关和手动翻译逻辑
├─ assets/icons/              扩展图标
├─ scripts/
│  ├─ package.ps1             打包脚本
│  ├─ check-dictionary.mjs    词典完整性检查（无重复键）
│  └─ dedupe-dictionary.mjs   词典去重工具（带求值对比保护）
├─ test/                      Playwright E2E 测试
├─ dist/                      打包输出目录
└─ CHANGELOG.md               更新记录
```

## 开发与测试

```bash
# 词典完整性检查（无重复键、结构可求值）
node scripts/check-dictionary.mjs

# 安装测试依赖并运行 E2E（Playwright + 真实 Chromium，本地 mock GitHub 页面）
npm install
npm test
```

## 修改汉化词库

主要修改文件是：

```text
src\translations.js
```

常用位置：

- `exactTextMap`：页面可见文本的精确翻译
- `exactAttributeMap`：输入框提示、按钮提示、标题、确认文案等属性翻译
- `regexTextRules`：带数字、状态、动态内容的文本规则
- `regexAttributeRules`：动态属性文本规则

示例：

```js
"Create pull request": "发起 PR",
"Commit changes": "提交改动",
"Search by repository name": "按仓库名搜索",
[/^(\d+)\s+commits?$/i, "$1 次提交"],
```

修改后刷新扩展：

1. 打开 `chrome://extensions` 或 `edge://extensions`
2. 找到“GitHub 中文增强”
3. 点击刷新按钮
4. 刷新 GitHub 页面

## 打包发布

默认打包版本与 `manifest.json` 一致（当前 `0.3.0`）：

```powershell
.\scripts\package.ps1
```

指定版本：

```powershell
.\scripts\package.ps1 -Version 0.3.1
```

输出文件位于：

```text
dist\
```

## 设计原则

- 优先翻译 GitHub 界面，不翻译用户写的代码、文档和评论正文
- 术语贴近程序员日常表达，不追求逐字直译
- 保留常用英文技术词，例如 PR、Issue、Fork、Star、Token、Runner、Webhook
- 对 Actions 页面更保守，避免污染日志、命令、YAML 和工作流输出
- 对按钮、输入框提示、辅助属性尽量补齐，提高完整度

## 常见问题

### 为什么某些英文还没翻译？

GitHub 页面经常更新，部分文案可能是新加的。可以把原文或对应 HTML 片段补充到 `src/translations.js`。

### 为什么评论、README 或代码没有被翻译？

这是刻意设计。插件会跳过 Markdown 正文、评论正文、代码块、提交信息、日志等区域，避免破坏真实项目内容。

### 关闭插件后为什么页面还是中文？

关闭后需要刷新当前 GitHub 页面，页面会恢复 GitHub 原始英文。

### 安装后没有效果怎么办？

可以按顺序检查：

1. 当前页面是否是 `https://github.com/`
2. 扩展是否已启用
3. 插件弹窗里的“启用汉化”是否打开
4. 是否刷新过 GitHub 页面
5. 是否在扩展管理页重新加载了最新代码

## 更新记录

详见 [CHANGELOG.md](CHANGELOG.md)。
