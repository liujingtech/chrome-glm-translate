// content/content.js

let currentTranslationNodes = [];

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true;
});

async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.type) {
      case 'TRANSLATE_PAGE':
        handleTranslatePage();
        sendResponse({ success: true });
        break;
      case 'TRANSLATE_SELECTION':
        handleTranslateSelection();
        sendResponse({ success: true });
        break;
      case 'TRANSLATE_RESULT':
        handleTranslateResult(message.data);
        sendResponse({ success: true });
        break;
      case 'SHOW_API_GUIDE':
        showApiKeyGuide();
        setupGuideEvents();
        sendResponse({ success: true });
        break;
      case 'SELECTION_TRANSLATION_RESULT':
        handleSelectionTranslationResult(message.data);
        sendResponse({ success: true });
        break;
      default:
        sendResponse({ success: false });
    }
  } catch (e) {
    console.error(e);
    sendResponse({ success: false, error: e.message });
  }
}

function handleTranslatePage() {
  showLoadingState();
  removeAllTranslations();

  const textNodes = extractPageTexts();
  if (textNodes.length === 0) {
    hideLoadingState();
    showError('没有可翻译的内容');
    return;
  }

  currentTranslationNodes = textNodes;
  const texts = textNodes.map(item => item.text);

  chrome.runtime.sendMessage({
    type: 'REQUEST_TRANSLATION',
    data: { texts, url: location.href }
  });
}

function handleTranslateSelection() {
  const sel = extractSelectedText();
  if (!sel) {
    showError('请先选择内容');
    return;
  }
  showLoadingState();
  chrome.runtime.sendMessage({
    type: 'REQUEST_SELECTION_TRANSLATION',
    data: { text: sel.text, rect: sel.rect }
  });
}

function handleTranslateResult(data) {
  hideLoadingState();
  if (!data.success) {
    showError(data.error || '翻译失败');
    return;
  }

  const nodes = currentTranslationNodes;
  const translations = data.translations;
  if (!nodes || !translations) return;

  for (let i = 0; i < Math.min(nodes.length, translations.length); i++) {
    const item = nodes[i];
    const translated = translations[i];
    if (translated && item.node?.parentElement) {
      try { renderBilingual(item.node, translated); } catch (e) {}
    }
  }
  currentTranslationNodes = [];
}

function handleSelectionTranslationResult(data) {
  hideLoadingState();
  if (!data.success) {
    showError(data.error || '翻译失败');
    return;
  }
  showSelectionPopup(data.translated, data.rect);
}

function setupGuideEvents() {
  const btn = document.getElementById('zhipu-guide-submit');
  const input = document.getElementById('zhipu-api-input');
  const overlay = document.querySelector('.zhipu-guide-overlay');

  if (btn && input) {
    btn.onclick = () => {
      const apiKey = input.value.trim();
      if (!apiKey) { input.focus(); return; }
      btn.disabled = true;
      btn.textContent = '验证中...';
      chrome.runtime.sendMessage({ type: 'SAVE_API_KEY', data: { apiKey } }, res => {
        if (res?.success) {
          hideApiKeyGuide();
          showSuccess('配置成功');
        } else {
          btn.disabled = false;
          btn.textContent = '保存并开始使用';
          showError(res?.error || '验证失败');
        }
      });
    };
  }
  if (overlay) overlay.onclick = hideApiKeyGuide;
}

window.addEventListener('load', removeAllTranslations);
