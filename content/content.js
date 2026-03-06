// content/content.js

let currentTranslationNodes = [];
let translatedIndices = new Set();

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
      case 'PARTIAL_TRANSLATION_RESULT':
        handlePartialResult(message.data);
        sendResponse({ success: true });
        break;
      case 'TRANSLATION_COMPLETE':
        handleTranslationComplete();
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
    console.error('处理失败:', e);
    sendResponse({ success: false });
  }
}

function handleTranslatePage() {
  showLoadingState();
  removeAllTranslations();
  translatedIndices.clear();

  const textNodes = extractPageTexts();
  if (textNodes.length === 0) {
    hideLoadingState();
    showError('没有可翻译的内容');
    return;
  }

  currentTranslationNodes = textNodes;
  const texts = textNodes.map(item => item.text);

  console.log('请求翻译, 节点数:', texts.length);

  chrome.runtime.sendMessage({
    type: 'REQUEST_TRANSLATION',
    data: { texts, url: location.href }
  });
}

function handleTranslateSelection() {
  const sel = extractSelectedText();
  if (!sel) { showError('请先选择内容'); return; }
  showLoadingState();
  chrome.runtime.sendMessage({
    type: 'REQUEST_SELECTION_TRANSLATION',
    data: { text: sel.text, rect: sel.rect }
  });
}

// 流式处理部分结果
function handlePartialResult(data) {
  if (!data.success) {
    console.error('批次失败:', data.error);
    return;
  }

  const startIndex = data.startIndex;
  const translations = data.translations;
  const nodes = currentTranslationNodes;
  const progress = data.progress;

  console.log(`渲染批次: ${startIndex} - ${startIndex + translations.length - 1}`);

  // 更新进度
  if (progress) {
    updateProgress(progress);
  }

  // 立即渲染这批翻译
  for (let i = 0; i < translations.length; i++) {
    const nodeIndex = startIndex + i;
    if (translatedIndices.has(nodeIndex)) continue;

    const item = nodes[nodeIndex];
    const translated = translations[i];

    if (translated && item?.node?.parentElement) {
      try {
        renderBilingual(item.node, translated);
        translatedIndices.add(nodeIndex);
      } catch (e) {
        console.warn('渲染失败:', e);
      }
    }
  }
}

function handleTranslationComplete() {
  hideLoadingState();
  console.log('翻译完成, 已渲染:', translatedIndices.size);
  currentTranslationNodes = [];
  translatedIndices.clear();
}

function handleSelectionTranslationResult(data) {
  hideLoadingState();
  if (!data.success) { showError(data.error || '翻译失败'); return; }
  showSelectionPopup(data.translated, data.rect);
}

function updateProgress(progress) {
  const loader = document.getElementById('zhipu-loading');
  if (loader) {
    const span = loader.querySelector('span');
    if (span) {
      span.textContent = `翻译中... ${progress.done}/${progress.total}`;
    }
  }
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
