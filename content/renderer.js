// content/renderer.js

// 直接替换原文为翻译结果
function renderBilingual(textNode, translatedText) {
  if (!textNode || !translatedText) return;
  textNode.textContent = translatedText;
  if (textNode.parentElement) {
    textNode.parentElement.dataset.zhipuTranslated = 'true';
  }
}

// 选中翻译弹窗
function showSelectionPopup(text, rect) {
  hideSelectionPopup();

  const popup = document.createElement('div');
  popup.id = 'zhipu-selection-popup';
  popup.className = 'zhipu-popup';
  popup.textContent = text;

  document.body.appendChild(popup);

  let top = rect.top + rect.height + 8;
  let left = rect.left;

  if (top + 100 > window.innerHeight + window.scrollY) top = rect.top - 100;
  if (left + 320 > window.innerWidth + window.scrollX) left = window.innerWidth + window.scrollX - 340;

  popup.style.top = top + 'px';
  popup.style.left = left + 'px';

  setTimeout(() => document.addEventListener('click', hideSelectionPopup, { once: true }), 100);
}

function hideSelectionPopup() {
  const popup = document.getElementById('zhipu-selection-popup');
  if (popup) popup.remove();
}

// 移除所有翻译
function removeAllTranslations() {
  hideSelectionPopup();
  hideLoadingState();
  hideApiKeyGuide();
  document.querySelectorAll('[data-zhipu-translated]').forEach(el => {
    delete el.dataset.zhipuTranslated;
  });
}

// 加载状态
function showLoadingState() {
  hideLoadingState();
  const loader = document.createElement('div');
  loader.id = 'zhipu-loading';
  loader.innerHTML = '<span>翻译中...</span>';
  document.body.appendChild(loader);
}

function hideLoadingState() {
  document.getElementById('zhipu-loading')?.remove();
}

// 错误提示
function showError(msg) {
  hideLoadingState();
  const toast = document.createElement('div');
  toast.className = 'zhipu-toast error';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// 成功提示
function showSuccess(msg) {
  const toast = document.createElement('div');
  toast.className = 'zhipu-toast success';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// API配置引导
function showApiKeyGuide() {
  hideApiKeyGuide();
  const guide = document.createElement('div');
  guide.id = 'zhipu-guide';
  guide.innerHTML = `
    <div class="zhipu-guide-overlay"></div>
    <div class="zhipu-guide-modal">
      <h3>智谱翻译</h3>
      <p>请输入API Key</p>
      <input type="password" id="zhipu-api-input" placeholder="API Key">
      <a href="https://open.bigmodel.cn/" target="_blank">获取API Key</a>
      <button id="zhipu-guide-submit">保存</button>
    </div>
  `;
  document.body.appendChild(guide);
}

function hideApiKeyGuide() {
  document.getElementById('zhipu-guide')?.remove();
}
