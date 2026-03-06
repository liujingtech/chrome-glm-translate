// content/content.js

let currentTranslationNodes = [];
let translatedIndices = new Set();
let totalBatches = 0;
let completedBatches = 0;

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
  showProgressBar();
  removeAllTranslations();
  translatedIndices.clear();
  completedBatches = 0;

  const textNodes = extractPageTexts();
  if (textNodes.length === 0) {
    hideProgressBar();
    showError('没有可见内容');
    return;
  }

  currentTranslationNodes = textNodes;
  totalBatches = Math.ceil(textNodes.length / 20);
  updateProgressBar(0, totalBatches);

  console.log('翻译请求:', textNodes.length, '节点,', totalBatches, '批次');

  chrome.runtime.sendMessage({ type: 'REQUEST_TRANSLATION', data: { texts: textNodes.map(n => n.text) } });
}

function handleTranslateSelection() {
  const sel = extractSelectedText();
  if (!sel) { showError('请先选择内容'); return; }
  showLoadingState();
  chrome.runtime.sendMessage({ type: 'REQUEST_SELECTION_TRANSLATION', data: sel });
}

function handlePartialResult(data) {
  const { success, startIndex, translations, progress, error } = data;

  // 更新批次进度
  completedBatches++;
  updateProgressBar(completedBatches, totalBatches, !success);

  if (!success) {
    console.warn('批次失败:', error);
    // 内容过滤错误时用原文
    if (error?.includes('unsafe') || error?.includes('sensitive')) {
      console.log('内容过滤，保留原文');
    }
  }

  const nodes = currentTranslationNodes;
  for (let i = 0; i < translations.length; i++) {
    const idx = startIndex + i;
    if (translatedIndices.has(idx)) continue;

    const item = nodes[idx];
    const trans = translations[i];
    if (item?.node?.parentElement) {
      try {
        // 翻译失败或内容相同时可能不渲染
        if (trans && trans !== item.text) {
          renderBilingual(item.node, trans);
        }
        translatedIndices.add(idx);
      } catch (e) {}
    }
  }
}

function handleTranslationComplete() {
  hideProgressBar();
  console.log('完成, 渲染:', translatedIndices.size);
  currentTranslationNodes = [];
  translatedIndices.clear();
}

function handleSelectionResult(data) {
  hideLoadingState();
  if (!data.success) { showError(data.error || '翻译失败'); return; }
  showSelectionPopup(data.translated, data.rect);
}

// 块状进度条
function showProgressBar() {
  let bar = document.getElementById('zhipu-progress-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'zhipu-progress-bar';
    bar.className = 'zhipu-progress-bar';
    bar.innerHTML = `
      <div class="zhipu-progress-title">翻译中</div>
      <div class="zhipu-progress-blocks" id="zhipu-blocks"></div>
      <div class="zhipu-progress-count" id="zhipu-count">0/0</div>
    `;
    document.body.appendChild(bar);
  }
  bar.style.display = 'block';
}

function hideProgressBar() {
  const bar = document.getElementById('zhipu-progress-bar');
  if (bar) {
    setTimeout(() => { bar.style.display = 'none'; }, 500);
  }
}

function updateProgressBar(done, total, failed = false) {
  const blocksEl = document.getElementById('zhipu-blocks');
  const countEl = document.getElementById('zhipu-count');
  if (!blocksEl) return;

  // 最多显示20个块
  const displayBlocks = Math.min(total, 20);
  const ratio = total / displayBlocks;

  let html = '';
  for (let i = 0; i < displayBlocks; i++) {
    const blockDone = (i + 1) * ratio <= done;
    const blockFailed = failed && Math.floor(done / ratio) === i;
    let cls = 'zhipu-block';
    if (blockFailed) cls += ' failed';
    else if (blockDone) cls += ' done';
    html += `<div class="${cls}"></div>`;
  }
  blocksEl.innerHTML = html;

  if (countEl) countEl.textContent = `${done}/${total}`;
}

function showLoadingState() {
  let loader = document.getElementById('zhipu-loading');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'zhipu-loading';
    loader.className = 'zhipu-loading';
    loader.innerHTML = '<div class="zhipu-spinner"></div><span>翻译中...</span>';
    document.body.appendChild(loader);
  }
  loader.style.display = 'flex';
}

function hideLoadingState() {
  const loader = document.getElementById('zhipu-loading');
  if (loader) loader.style.display = 'none';
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
