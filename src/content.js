(() => {
  const STORAGE_KEY = "github-cn-enabled";
  const UI_LANG = "zh-CN";
  const dictionary = window.GitHubCnDictionary;
  const skipSelector = [
    "script",
    "style",
    "textarea",
    "input",
    "select",
    "option",
    "code",
    "pre",
    ".blob-code",
    ".blob-code-inner",
    ".js-file-line",
    ".markdown-body",
    ".comment-body",
    ".commit-title",
    ".commit-desc",
    ".cm-editor",
    ".cm-content",
    ".cm-line",
    ".react-code-text",
    ".react-code-lines",
    ".blob-wrapper",
    ".js-blob-wrapper",
    "[data-code-view-component='true']",
    "[data-testid*='log']",
    "[data-testid*='logs']",
    "[data-testid*='yaml']",
    "[data-testid*='code-view']",
    "[data-testid*='snippet']",
    "[contenteditable='true']"
  ].join(",");
  const attributeSkipSelector = [
    "script",
    "style",
    "code",
    "pre",
    ".blob-code",
    ".blob-code-inner",
    ".js-file-line",
    ".markdown-body",
    ".comment-body",
    ".commit-title",
    ".commit-desc",
    ".cm-editor",
    ".cm-content",
    ".cm-line",
    ".react-code-text",
    ".react-code-lines",
    ".blob-wrapper",
    ".js-blob-wrapper",
    "[data-code-view-component='true']",
    "[data-testid*='log']",
    "[data-testid*='logs']",
    "[data-testid*='yaml']",
    "[data-testid*='code-view']",
    "[data-testid*='snippet']"
  ].join(",");
  const actionsWhitelistSelector = [
    "header",
    "nav",
    "aside",
    "form",
    "details > summary",
    "button",
    "label",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "dt",
    "dd",
    "li",
    "a",
    "span",
    "strong",
    "p",
    "[role='button']",
    "[role='tab']",
    "[role='tablist']",
    "[aria-label]",
    "[data-testid*='header']",
    "[data-testid*='summary']",
    "[data-testid*='metadata']",
    "[data-testid*='annotation']",
    "[data-testid*='sidebar']",
    "[data-testid*='filter']",
    "[data-testid*='breadcrumb']",
    ".ActionList",
    ".UnderlineNav",
    ".TabNav",
    ".Box-header",
    ".Subhead",
    ".PageHeader",
    ".Counter",
    ".Button"
  ].join(",");
  const workflowRunWhitelistSelector = [
    actionsWhitelistSelector,
    "[data-testid*='job']",
    "[data-testid*='step']",
    "[data-testid*='attempt']",
    "[data-testid*='run']",
    "[data-testid*='deployment']",
    "[data-testid*='approval']",
    "[data-testid*='artifact']",
    "[data-testid*='checks']",
    "[data-testid*='details']",
    "[data-testid*='overview']",
    ".TimelineItem",
    ".Box",
    ".Details",
    ".merge-status-item"
  ].join(",");
  const globalUiSelector = [
    "header",
    "nav",
    "[role='dialog']",
    "[role='alert']",
    "[role='status']",
    ".flash",
    ".flash-full",
    ".Toast",
    ".Overlay",
    ".Popover",
    ".dropdown-menu"
  ].join(",");
  const timeElementSelector = "relative-time, time-ago";

  let enabled = true;
  let observer = null;
  let langGuardObserver = null;
  let titleObserver = null;
  let lastSeenUrl = window.location.href;
  let lastWrittenTitle = null;
  let pendingMutations = [];
  let incrementalFrameScheduled = false;
  let fullScanFrameQueued = false;

  // 记录"本脚本最后写入的值"：我们自己的 DOM 写入同样会触发 MutationObserver，
  // 若不区分来源，译文本身又命中词典时会链式重译（如 Issues→Issue→问题）。
  // 值与我们最后写入一致的节点视为自身写入，跳过；被外部改成新内容则正常重译。
  const selfWrites = new WeakMap();

  function isOwnTextWrite(node) {
    return selfWrites.get(node) === node.nodeValue;
  }

  function markTextWrite(node, value) {
    selfWrites.set(node, value);
  }

  function isOwnAttributeWrite(element, attribute) {
    const map = selfWrites.get(element);
    return map instanceof Map && map.get(attribute) === element.getAttribute(attribute);
  }

  function markAttributeWrite(element, attribute) {
    let map = selfWrites.get(element);
    if (!(map instanceof Map)) {
      map = new Map();
      selfWrites.set(element, map);
    }
    map.set(attribute, element.getAttribute(attribute));
  }

  function getTrimmedParts(text) {
    const leading = text.match(/^\s*/)?.[0] ?? "";
    const trailing = text.match(/\s*$/)?.[0] ?? "";
    const core = text.trim();
    return { leading, core, trailing };
  }

  function applyExactOrRegex(value, exactMap, regexRules) {
    if (!value) {
      return value;
    }

    if (exactMap[value]) {
      return exactMap[value];
    }

    for (const [pattern, replacement] of regexRules) {
      if (pattern.test(value)) {
        return value.replace(pattern, replacement);
      }
    }

    return value;
  }

  function translateTextValue(text) {
    const { leading, core, trailing } = getTrimmedParts(text);
    if (!core) {
      return text;
    }

    const translated = applyExactOrRegex(
      core,
      dictionary.exactTextMap,
      dictionary.regexTextRules
    );

    if (translated === core) {
      return text;
    }

    return `${leading}${translated}${trailing}`;
  }

  function translateShortcutHintTextNode(node) {
    if (!node.parentElement) {
      return null;
    }

    const { leading, core, trailing } = getTrimmedParts(node.nodeValue);
    if (!core) {
      return null;
    }

    const parentText = node.parentElement.textContent?.replace(/\s+/g, " ").trim();
    if (!/^Type\s+\/\s+to search$/i.test(parentText)) {
      return null;
    }

    if (/^Type$/i.test(core)) {
      return `${leading}输入${trailing}`;
    }

    if (/^to search$/i.test(core)) {
      return `${leading}开始搜索${trailing}`;
    }

    return null;
  }

  function translateAttributeValue(value) {
    if (!value) {
      return value;
    }

    if (dictionary.exactAttributeMap[value]) {
      return dictionary.exactAttributeMap[value];
    }

    if (dictionary.exactTextMap[value]) {
      return dictionary.exactTextMap[value];
    }

    for (const [pattern, replacement] of dictionary.regexAttributeRules) {
      if (pattern.test(value)) {
        return value.replace(pattern, replacement);
      }
    }

    return applyExactOrRegex(
      value,
      dictionary.exactTextMap,
      dictionary.regexTextRules
    );
  }

  function isActionsPage() {
    return window.location.pathname.includes("/actions");
  }

  function isWorkflowRunPage() {
    return /\/actions\/(?:runs|jobs)\/\d+/.test(window.location.pathname);
  }

  function dedupeRootElements(elements) {
    return elements.filter((element) => {
      return !elements.some((other) => other !== element && other.contains(element));
    });
  }

  // Actions 页的翻译范围选择器：界面白名单 + 全局 UI（浮层、对话框、闪现提示），
  // 全量扫描与增量翻译共用，保证两套路径语义一致
  function getActionsScopeSelector() {
    const whitelist = isWorkflowRunPage()
      ? workflowRunWhitelistSelector
      : actionsWhitelistSelector;
    return `${whitelist},${globalUiSelector}`;
  }

  function getTranslationRoots() {
    if (!document.body) {
      return [];
    }

    // 从 documentElement 扫描：覆盖挂在 body 之外的浮层 portal
    if (!isActionsPage()) {
      return [document.documentElement];
    }

    const candidates = Array.from(
      document.documentElement.querySelectorAll(getActionsScopeSelector())
    ).filter((element) => !element.closest(skipSelector));

    if (!candidates.length) {
      return [document.querySelector("main") ?? document.documentElement];
    }

    return dedupeRootElements(candidates);
  }

  function isLikelyStructuredText(text) {
    if (!text) {
      return false;
    }

    const normalized = text.trim();
    if (!normalized) {
      return false;
    }

    if (normalized.length > 160 && /[{}[\]$<>]/.test(normalized)) {
      return true;
    }

    if (
      /\r?\n/.test(normalized) &&
      /(^|\n)\s*(name|on|jobs|steps|uses|run|env|with|if|shell|working-directory|permissions|strategy|matrix|services|defaults|timeout-minutes|continue-on-error)\s*:/im.test(
        normalized
      )
    ) {
      return true;
    }

    if (/\$\{\{\s*.+?\s*\}\}/.test(normalized)) {
      return true;
    }

    if (/^\s*(npm|pnpm|yarn|bun|git|docker|kubectl|gh|node|python|pip|cargo|go|make)\b/.test(normalized)) {
      return true;
    }

    if (/^\s*(::\w+::|\[[a-z]+\]|##\[|##\[[a-z]+\])/.test(normalized)) {
      return true;
    }

    if (/^\s*(Run|Error|Warning|Notice)\s+.+/.test(normalized) && /[/\\]|:\d+/.test(normalized)) {
      return true;
    }

    if (/^[A-Z_][A-Z0-9_]{2,}\s*=/.test(normalized)) {
      return true;
    }

    if (/^\s*[\w./-]+\.(ya?ml|json|toml|lock|sh|ps1|bat|cmd)\b/i.test(normalized)) {
      return true;
    }

    if (/^\s*\/?home\/runner|^C:\\|^D:\\|^\/usr\/|^\/home\//i.test(normalized)) {
      return true;
    }

    return false;
  }

  function translatePageTitle() {
    if (!document.title || document.title === lastWrittenTitle) {
      return;
    }

    const translated = document.title
      .split(" · ")
      .map((segment) => translateTextValue(segment))
      .join(" · ");

    if (translated !== document.title) {
      document.title = translated;
    }
    lastWrittenTitle = translated;
  }

  function shouldSkipTextNode(node) {
    if (!node.parentElement) {
      return true;
    }

    if (node.parentElement.closest(skipSelector)) {
      return true;
    }

    const text = node.nodeValue?.trim();
    if (!text) {
      return true;
    }

    if (isLikelyStructuredText(text)) {
      return true;
    }

    if (!/[A-Za-z]/.test(text)) {
      return true;
    }

    return false;
  }

  function translateTextNode(node) {
    if (isOwnTextWrite(node)) {
      return;
    }

    const translated = translateShortcutHintTextNode(node) ?? translateTextValue(node.nodeValue);
    if (translated !== node.nodeValue) {
      node.nodeValue = translated;
    }
    markTextWrite(node, translated);
  }

  function translateTextNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];

    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }

    for (const node of nodes) {
      if (shouldSkipTextNode(node)) {
        continue;
      }

      translateTextNode(node);
    }
  }

  function translateAttributes(root) {
    const selector =
      "[placeholder], [aria-label], [aria-description], [title], [data-confirm], [data-disable-with], input[type='button'][value], input[type='submit'][value], input[type='reset'][value]";
    const elements = [];

    if (root instanceof Element && root.matches(selector)) {
      elements.push(root);
    }

    elements.push(...root.querySelectorAll(selector));

    for (const element of elements) {
      if (element.closest(attributeSkipSelector)) {
        continue;
      }

      for (const attribute of [
        "placeholder",
        "aria-label",
        "aria-description",
        "title",
        "data-confirm",
        "data-disable-with",
        "value"
      ]) {
        if (!element.hasAttribute(attribute)) {
          continue;
        }

        if (attribute === "value" && element.tagName !== "INPUT") {
          continue;
        }

        if (isOwnAttributeWrite(element, attribute)) {
          continue;
        }

        const original = element.getAttribute(attribute);
        if (isLikelyStructuredText(original)) {
          continue;
        }

        const translated = translateAttributeValue(original);
        if (translated !== original) {
          element.setAttribute(attribute, translated);
        }
        markAttributeWrite(element, attribute);
      }
    }
  }

  // 把页面语言标记为中文。GitHub 自带的 <relative-time>/<time-ago>
  // 组件会按 lang 渲染相对时间，因此所有时间戳自动变为中文，零词库成本。
  function applyUiLanguage() {
    if (document.documentElement.getAttribute("lang") !== UI_LANG) {
      document.documentElement.setAttribute("lang", UI_LANG);
    }

    if (langGuardObserver) {
      return;
    }

    langGuardObserver = new MutationObserver(() => {
      if (enabled && document.documentElement.getAttribute("lang") !== UI_LANG) {
        document.documentElement.setAttribute("lang", UI_LANG);
      }
    });
    langGuardObserver.observe(document.documentElement, { attributeFilter: ["lang"] });
  }

  // 逐个设置时间元素自身的 lang，触发组件按新语言重新渲染
  function localizeTimeElements(scope) {
    if (!scope || scope.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const elements =
      scope.matches?.(timeElementSelector) ? [scope, ...scope.querySelectorAll(timeElementSelector)]
      : scope.querySelectorAll(timeElementSelector);

    for (const element of elements) {
      if (element.getAttribute("lang") !== UI_LANG) {
        element.setAttribute("lang", UI_LANG);
      }
    }
  }

  function translateRoot(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      // Actions 页的文本节点需在白名单元素内才翻译（日志等区域直接跳过）
      if (isActionsPage()) {
        const parent = node.parentElement;
        if (!parent || !parent.closest(getActionsScopeSelector())) {
          return;
        }
      }
      if (!shouldSkipTextNode(node)) {
        translateTextNode(node);
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    localizeTimeElements(node);

    if (!isActionsPage()) {
      translateTextNodes(node);
      translateAttributes(node);
      return;
    }

    // Actions 页：与全量扫描一致，只翻译子树内命中白名单的元素。
    // 浮层（如头部菜单）整体作为一个节点插入，其容器本身不在白名单里，
    // 但内部的链接、按钮在——所以必须进入子树筛选，而不是按容器整体取舍
    const scope = getActionsScopeSelector();
    const targets = node.matches(scope)
      ? [node, ...node.querySelectorAll(scope)]
      : [...node.querySelectorAll(scope)];
    for (const target of targets) {
      if (target.closest(skipSelector)) {
        continue;
      }
      translateTextNodes(target);
      translateAttributes(target);
    }
  }

  // 全量翻译：首次加载、手动触发、开关重新启用、站内跳转后使用
  function translateDocument() {
    if (!enabled || !document.body) {
      return;
    }

    applyUiLanguage();
    localizeTimeElements(document.body);
    translatePageTitle();
    const roots = getTranslationRoots();
    for (const root of roots) {
      translateTextNodes(root);
      translateAttributes(root);
    }
  }

  // 后台标签页里 requestAnimationFrame 会被挂起，导致翻译任务积压；
  // 不可见时退化为定时器（浏览器会节流到约 1 秒，但保证最终执行）
  function scheduleFrame(callback) {
    if (document.hidden) {
      window.setTimeout(callback, 250);
    } else {
      window.requestAnimationFrame(callback);
    }
  }

  function queueFullTranslate(delayMs = 0) {
    if (delayMs > 0) {
      window.setTimeout(() => translateDocument(), delayMs);
      return;
    }

    if (fullScanFrameQueued) {
      return;
    }

    fullScanFrameQueued = true;
    scheduleFrame(() => {
      fullScanFrameQueued = false;
      translateDocument();
    });
  }

  // 增量翻译：只处理本批变更涉及的子树，避免每次 DOM 变化都全页重扫。
  // SPA 站内跳转必然伴随 DOM 突变，这里顺带检测 URL 变化触发全量重扫
  //（content script 运行在隔离世界，包装 history.pushState 无法作用于页面主世界）。
  function processPendingMutations() {
    if (!enabled) {
      pendingMutations.length = 0;
      return;
    }

    if (window.location.href !== lastSeenUrl) {
      lastSeenUrl = window.location.href;
      queueFullTranslate();
    }

    const roots = [];
    for (const mutation of pendingMutations.splice(0)) {
      if (mutation.type === "childList") {
        for (const node of mutation.addedNodes) {
          roots.push(node);
        }
      } else if (mutation.type === "characterData" || mutation.type === "attributes") {
        roots.push(mutation.target);
      }
    }

    for (const root of dedupeRootElements(roots)) {
      translateRoot(root);
    }
  }

  function scheduleIncrementalTranslate(mutations) {
    pendingMutations.push(...mutations);
    if (incrementalFrameScheduled) {
      return;
    }

    incrementalFrameScheduled = true;
    scheduleFrame(() => {
      incrementalFrameScheduled = false;
      processPendingMutations();
    });
  }

  function startObserver() {
    if (observer || !document.documentElement) {
      return;
    }

    observer = new MutationObserver(scheduleIncrementalTranslate);
    // 观察 documentElement 而不是 body：GitHub 新版头部把下拉菜单等浮层
    // 渲染进挂在 body 之外的 React portal（#__primerPortalRoot__），只看 body 会漏掉
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        "placeholder",
        "aria-label",
        "aria-description",
        "title",
        "data-confirm",
        "data-disable-with",
        "value"
      ]
    });
  }

  function stopObserver() {
    observer?.disconnect();
    observer = null;
    titleObserver?.disconnect();
    titleObserver = null;
    pendingMutations.length = 0;
  }

  // 站内跳转监听：popstate 事件可跨世界收到；pushState/replaceState 无法包装，
  // 其引发的 DOM 突变由 processPendingMutations 的 URL 检测兜住
  function hookNavigation() {
    window.addEventListener("popstate", () => window.setTimeout(() => queueFullTranslate(), 60));
    // 标签页从后台切回时补扫（rAF 挂起期间可能漏掉的翻译）
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        queueFullTranslate();
      }
    });
    // 浏览器前进/后退从 bfcache 恢复时不会重新注入脚本，恢复后补扫
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) {
        queueFullTranslate();
      }
    });
  }

  // <title> 在 head 里，不在 body 观察范围内，单独监听并同步翻译
  function startTitleObserver() {
    if (titleObserver || !document.head) {
      return;
    }

    const titleElement = document.head.querySelector("title");
    if (!titleElement) {
      return;
    }

    titleObserver = new MutationObserver(() => {
      if (enabled) {
        translatePageTitle();
      }
    });
    titleObserver.observe(titleElement, { childList: true, characterData: true, subtree: true });
  }

  function readEnabledState() {
    return new Promise((resolve) => {
      chrome.storage.sync.get({ [STORAGE_KEY]: true }, (result) => {
        resolve(result[STORAGE_KEY] !== false);
      });
    });
  }

  function boot() {
    readEnabledState().then((value) => {
      enabled = value;
      if (!enabled) {
        return;
      }

      lastSeenUrl = window.location.href;
      queueFullTranslate();
      startObserver();
      startTitleObserver();
      hookNavigation();
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync" || !changes[STORAGE_KEY]) {
        return;
      }

      enabled = changes[STORAGE_KEY].newValue !== false;
      if (enabled) {
        lastSeenUrl = window.location.href;
        startObserver();
        startTitleObserver();
        hookNavigation();
        queueFullTranslate();
      } else {
        stopObserver();
      }
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message?.type === "github-cn-translate-now") {
        startObserver();
        startTitleObserver();
        hookNavigation();
        queueFullTranslate();
        sendResponse({ ok: true });
      }
    });
  }

  boot();
})();
