// content/content.js

if (typeof window.__ZHIPU_CONTENT_LOADED__ === 'undefined') {
window.__ZHIPU_CONTENT_LOADED__ = true;

window.currentTranslationNodes = [];
window.translatedIndices = new Set();
window.totalBatches = 0;
window.completedBatches = 0;

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

async function handleTranslatePage() {
  showProgressBar();
  removeAllTranslations();
  window.translatedIndices.clear();
  window.completedBatches = 0;

  // 获取过滤设置
  try {
    const response = await new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, resolve);
    });
    if (response?.success && response.data) {
      window.filterNodesEnabled = response.data.filterNodes !== false;
    }
  } catch (e) {
    console.warn('获取设置失败，使用默认值');
  }

  const textNodes = extractPageTexts();
  if (textNodes.length === 0) {
    hideProgressBar();
    showError('没有可见内容');
    return;
  }

  window.currentTranslationNodes = textNodes;
  window.totalBatches = Math.ceil(textNodes.length / 20);
  updateProgressBar(0, window.totalBatches);

  console.log('翻译请求:', textNodes.length, '节点,', window.totalBatches, '批次');

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

  // 使用实际进度更新
  if (progress) {
    updateProgressBar(progress.done, progress.total, !success);
  }

  console.log('收到翻译结果:', { success, startIndex, transLen: translations?.length, nodesLen: window.currentTranslationNodes.length, progress });

  if (!success) {
    console.warn('批次失败:', error);
    return;
  }

  const nodes = window.currentTranslationNodes;
  let rendered = 0;
  let skipped = 0;
  let same = 0;

  for (let i = 0; i < translations.length; i++) {
    const idx = startIndex + i;
    if (window.translatedIndices.has(idx)) { skipped++; continue; }

    const item = nodes[idx];
    const trans = translations[i];

    if (!item?.node?.parentElement) {
      skipped++;
      continue;
    }

    if (!trans) {
      skipped++;
      continue;
    }

    if (trans === item.text) {
      same++;
      // 不要添加到 translatedIndices，因为可能还没真正翻译
      continue;
    }

    try {
      replaceText(item.node, trans);
      window.translatedIndices.add(idx);
      rendered++;
    } catch (e) {
      console.warn('渲染失败:', e);
    }
  }

  console.log(`渲染统计: 渲染=${rendered}, 原文相同=${same}, 跳过=${skipped}`);
}

function handleTranslationComplete() {
  hideProgressBar();
  console.log('完成, 渲染:', window.translatedIndices.size);
  window.currentTranslationNodes = [];
  window.translatedIndices.clear();
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

} // end if
