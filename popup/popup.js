const STORAGE_KEY = "github-cn-enabled";

const enabledInput = document.getElementById("enabled");
const translateNowButton = document.getElementById("translate-now");
const statusText = document.getElementById("status");

function setStatus(text) {
  statusText.textContent = text;
}

function withActiveTab(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const [tab] = tabs;
    callback(tab);
  });
}

function translateCurrentTab() {
  withActiveTab((tab) => {
    if (!tab?.id || !tab.url?.startsWith("https://github.com/")) {
      setStatus("当前标签页不是 GitHub 页面。");
      return;
    }

    chrome.tabs.sendMessage(
      tab.id,
      { type: "github-cn-translate-now" },
      () => {
        if (chrome.runtime.lastError) {
          setStatus("页面还没准备好，刷新一下 GitHub 页再试。");
          return;
        }

        setStatus("已尝试翻译当前页面。");
      }
    );
  });
}

chrome.storage.sync.get({ [STORAGE_KEY]: true }, (result) => {
  enabledInput.checked = result[STORAGE_KEY] !== false;
});

enabledInput.addEventListener("change", () => {
  const enabled = enabledInput.checked;
  chrome.storage.sync.set({ [STORAGE_KEY]: enabled }, () => {
    if (!enabled) {
      setStatus("已关闭汉化，刷新 GitHub 页面后恢复英文。");
      return;
    }

    setStatus("已启用汉化。");
    translateCurrentTab();
  });
});

translateNowButton.addEventListener("click", translateCurrentTab);
