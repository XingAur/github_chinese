(() => {
  const STORAGE_KEY = "github-cn-enabled";
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

  let enabled = true;
  let observerStarted = false;
  let navigationHooked = false;
  let translateQueued = false;

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

  function getTranslationRoots() {
    if (!document.body) {
      return [];
    }

    if (!isActionsPage()) {
      return [document.body];
    }

    const main = document.querySelector("main");
    if (!main) {
      return [document.body];
    }

    const selector = isWorkflowRunPage()
      ? workflowRunWhitelistSelector
      : actionsWhitelistSelector;
    const candidates = Array.from(main.querySelectorAll(selector)).filter((element) => {
      return !element.closest(skipSelector);
    });
    const globalCandidates = Array.from(document.body.querySelectorAll(globalUiSelector)).filter(
      (element) => !element.closest(skipSelector)
    );
    const mergedCandidates = [...candidates, ...globalCandidates];

    if (!mergedCandidates.length) {
      return [main];
    }

    return dedupeRootElements(mergedCandidates);
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
    if (!document.title) {
      return;
    }

    const translated = document.title
      .split(" · ")
      .map((segment) => translateTextValue(segment))
      .join(" · ");

    if (translated !== document.title) {
      document.title = translated;
    }
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

      const translated = translateShortcutHintTextNode(node) ?? translateTextValue(node.nodeValue);
      if (translated !== node.nodeValue) {
        node.nodeValue = translated;
      }
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

        const original = element.getAttribute(attribute);
        if (isLikelyStructuredText(original)) {
          continue;
        }

        const translated = translateAttributeValue(original);
        if (translated !== original) {
          element.setAttribute(attribute, translated);
        }
      }
    }
  }

  function translateDocument() {
    if (!enabled || !document.body) {
      return;
    }

    translatePageTitle();
    const roots = getTranslationRoots();
    for (const root of roots) {
      translateTextNodes(root);
      translateAttributes(root);
    }
  }

  function queueTranslate() {
    if (translateQueued) {
      return;
    }

    translateQueued = true;
    window.requestAnimationFrame(() => {
      translateQueued = false;
      translateDocument();
    });
  }

  function startObserver() {
    if (observerStarted || !document.body) {
      return;
    }

    observerStarted = true;
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          queueTranslate();
          return;
        }

        if (mutation.type === "characterData") {
          queueTranslate();
          return;
        }

        if (mutation.type === "attributes") {
          queueTranslate();
          return;
        }
      }
    });

    observer.observe(document.body, {
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

  function hookNavigation() {
    if (navigationHooked) {
      return;
    }

    navigationHooked = true;
    const wrapHistoryMethod = (methodName) => {
      const original = history[methodName];
      history[methodName] = function wrapState(...args) {
        const result = original.apply(this, args);
        window.setTimeout(queueTranslate, 60);
        return result;
      };
    };

    wrapHistoryMethod("pushState");
    wrapHistoryMethod("replaceState");
    window.addEventListener("popstate", () => window.setTimeout(queueTranslate, 60));
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

      queueTranslate();
      startObserver();
      hookNavigation();
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync" || !changes[STORAGE_KEY]) {
        return;
      }

      enabled = changes[STORAGE_KEY].newValue !== false;
      if (enabled) {
        startObserver();
        hookNavigation();
        queueTranslate();
      }
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message?.type === "github-cn-translate-now") {
        startObserver();
        hookNavigation();
        queueTranslate();
        sendResponse({ ok: true });
      }
    });
  }

  boot();
})();
