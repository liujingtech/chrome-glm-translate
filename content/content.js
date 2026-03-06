// content/content.js

let currentTranslationNodes = [];
let translatedIndices = new Set();

chrome.runtime.onMessage.addListener((msg, sender, sendRes) => {
  handleMessage(msg, sender, sendRes);
  return true;
});

async function handleMessage(msg, sender, sendRes) {
  try {
    switch (msg.type) {
      case 'TRANSLATE_PAGE':
        handleTranslatePage();
        sendRes({ success: true });
        break;
      case 'TRANSLATE_SELECTION':
        handleTranslateSelection();
        sendRes({ success: true });
        break;
      case 'PARTIAL_TRANSLATION_RESULT':
        handlePartialResult(msg.data);
        sendRes({ success: true });
        break;
      case 'TRANSLATION_COMPLETE':
        handleTranslationComplete();
        sendRes({ success: true });
        break;
      case 'SHOW_API_GUIDE':
        showApiKeyGuide();
        setupGuideEvents();
        sendRes({ success: true });
        break;
      case 'SELECTION_TRANSLATION_RESULT':
        handleSelectionResult(msg.data);
        sendRes({ success: true });
        break;
      default:
        sendRes({ success: false });
    }
  } catch (e) { console.error('处理失败:', e); sendRes({ success: false }); }
}

function handleTranslatePage() {
  showLoadingState();
  removeAllTranslations();
  translatedIndices.clear();

  const textNodes = extractPageTexts();
  if (textNodes.length === 0) {
    hideLoadingState();
    showError('没有可见内容可翻译');
    return;
  }

  currentTranslationNodes = textNodes;
  const texts = textNodes.map(item => item.text);

  console.log('请求翻译, 可见节点:', texts.length);

  chrome.runtime.sendMessage({ type: 'REQUEST_TRANSLATION', data: { texts } });
}

function handleTranslateSelection() {
  const sel = extractSelectedText();
  if (!sel) { showError('请先选择内容'); return; }
  showLoadingState();
  chrome.runtime.sendMessage({ type: 'REQUEST_SELECTION_TRANSLATION', data: sel });
}

function handlePartialResult(data) {
  if (!data.success) { console.error('批次失败'); return; }

  const { startIndex, translations, progress } = data;
  const nodes = currentTranslationNodes;

  // 更新进度
  if (progress) updateProgress(progress);

  // 渲染
  for (let i = 0; i < translations.length; i++) {
    const idx = startIndex + i;
    if (translatedIndices.has(idx)) continue;

    const item = nodes[idx];
    const trans = translations[i];
    if (trans && item?.node?.parentElement) {
      try {
        renderBilingual(item.node, trans);
        translatedIndices.add(idx);
      } catch (e) {}
    }
  }
}

function handleTranslationComplete() {
  hideLoadingState();
  console.log('完成, 已渲染:', translatedIndices.size);
  currentTranslationNodes = [];
  translatedIndices.clear();
}

function handleSelectionResult(data) {
  hideLoadingState();
  if (!data.success) { showError(data.error || '翻译失败'); return; }
  showSelectionPopup(data.translated, data.rect);
}

function updateProgress(p) {
  const loader = document.getElementById('zhipu-loading');
  if (loader) {
    const span = loader.querySelector('span');
    if (span) span.textContent = `翻译中... ${p.done}/${p.total}`;
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
        if (res?.success) { hideApiKeyGuide(); showSuccess('配置成功'); }
        else { btn.disabled = false; btn.textContent = '保存并开始使用'; showError(res?.error || '验证失败'); }
      });
    };
  }
  if (overlay) overlay.onclick = hideApiKeyGuide;
}

window.addEventListener('load', removeAllTranslations);
