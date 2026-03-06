// content/renderer.js

if (typeof window.__ZHIPU_RENDERER_LOADED__ === 'undefined') {
window.__ZHIPU_RENDERER_LOADED__ = true;

// 直接替换原文为译文
window.replaceText = function(textNode, translatedText) {
  if (!textNode || !textNode.parentElement) return null;

  // 保存原文（用于可能的恢复功能）
  textNode._originalText = textNode.textContent;

  // 直接替换文本
  textNode.textContent = translatedText;

  // 标记父元素已翻译
  textNode.parentElement.dataset.translated = 'true';

  return textNode;
}

// 批量替换文本
window.replaceTextBatch = function(textNodes, translatedTexts) {
  const results = [];

  for (let i = 0; i < textNodes.length; i++) {
    const item = textNodes[i];
    const translated = translatedTexts[i];

    if (translated && translated !== item.text) {
      try {
        window.replaceText(item.node, translated);
        results.push({
          original: item.text,
          translated: translated
        });
      } catch (e) {
        console.warn('替换文本失败:', e);
      }
    }
  }

  return results;
};

// 保留旧函数名兼容（内部调用替换）
window.renderBilingual = function(textNode, translatedText, settings = {}) {
  return window.replaceText(textNode, translatedText);
};

window.renderBilingualBatch = function(textNodes, translatedTexts, settings = {}) {
  return window.replaceTextBatch(textNodes, translatedTexts);
};

// 显示选中内容的翻译弹窗
window.showSelectionPopup = function(text, rect) {
  // 移除已存在的弹窗
  window.hideSelectionPopup();

  // 创建弹窗容器
  const popup = document.createElement('div');
  popup.id = 'zhipu-selection-popup';
  popup.className = 'zhipu-selection-popup';

  // 创建内容区域
  const content = document.createElement('div');
  content.className = 'zhipu-popup-content';
  content.textContent = text;

  // 创建关闭按钮
  const closeBtn = document.createElement('button');
  closeBtn.className = 'zhipu-popup-close';
  closeBtn.textContent = '×';
  closeBtn.onclick = window.hideSelectionPopup;

  popup.appendChild(closeBtn);
  popup.appendChild(content);

  // 定位弹窗
  document.body.appendChild(popup);

  // 计算位置（确保不超出视口）
  const popupRect = popup.getBoundingClientRect();
  let top = rect.top + rect.height + 10;
  let left = rect.left;

  // 如果底部空间不足，显示在上方
  if (top + popupRect.height > window.innerHeight + window.scrollY) {
    top = rect.top - popupRect.height - 10;
  }

  // 如果右侧空间不足，向左调整
  if (left + popupRect.width > window.innerWidth + window.scrollX) {
    left = window.innerWidth + window.scrollX - popupRect.width - 10;
  }

  popup.style.top = `${top}px`;
  popup.style.left = `${left}px`;

  return popup;
};

// 隐藏选中内容翻译弹窗
window.hideSelectionPopup = function() {
  const popup = document.getElementById('zhipu-selection-popup');
  if (popup) {
    popup.remove();
  }
};

// 移除所有翻译（恢复原页面）
window.removeAllTranslations = function() {
  // 恢复原文（如果保存了）
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let n;
  while (n = walker.nextNode()) {
    if (n._originalText) {
      n.textContent = n._originalText;
      delete n._originalText;
    }
  }

  // 移除旧的译文容器（兼容旧版本）
  const wrappers = document.querySelectorAll('.zhipu-translation-wrapper');
  wrappers.forEach(wrapper => wrapper.remove());

  // 移除选中翻译弹窗
  window.hideSelectionPopup();

  // 移除translated标记
  const translatedElements = document.querySelectorAll('[data-translated="true"]');
  translatedElements.forEach(el => {
    delete el.dataset.translated;
  });
};

// 显示加载状态
window.showLoadingState = function() {
  const loader = document.createElement('div');
  loader.id = 'zhipu-loading';
  loader.className = 'zhipu-loading';
  loader.innerHTML = '<div class="zhipu-spinner"></div><span>翻译中...</span>';
  document.body.appendChild(loader);
};

// 隐藏加载状态
window.hideLoadingState = function() {
  const loader = document.getElementById('zhipu-loading');
  if (loader) {
    loader.remove();
  }
};

// 显示错误提示
window.showError = function(message) {
  const error = document.createElement('div');
  error.className = 'zhipu-error';
  error.textContent = message;
  document.body.appendChild(error);

  // 3秒后自动消失
  setTimeout(() => {
    error.remove();
  }, 3000);
};

// 显示成功提示
window.showSuccess = function(message) {
  const success = document.createElement('div');
  success.className = 'zhipu-success';
  success.textContent = message;
  document.body.appendChild(success);

  setTimeout(() => {
    success.remove();
  }, 2000);
};

// 显示首次使用引导弹窗
window.showApiKeyGuide = function() {
  // 移除已存在的引导
  const existing = document.getElementById('zhipu-api-guide');
  if (existing) {
    existing.remove();
    return;
  }

  const guide = document.createElement('div');
  guide.id = 'zhipu-api-guide';
  guide.className = 'zhipu-api-guide';
  guide.innerHTML = `
    <div class="zhipu-guide-overlay"></div>
    <div class="zhipu-guide-content">
      <h3>欢迎使用智谱翻译</h3>
      <p>请先配置您的智谱API Key</p>
      <input type="password" id="zhipu-api-input" placeholder="请输入API Key">
      <a href="https://open.bigmodel.cn/" target="_blank" class="zhipu-guide-link">获取API Key →</a>
      <button id="zhipu-guide-submit">保存并开始使用</button>
    </div>
  `;

  document.body.appendChild(guide);

  return guide;
};

// 隐藏首次使用引导弹窗
window.hideApiKeyGuide = function() {
  const guide = document.getElementById('zhipu-api-guide');
  if (guide) {
    guide.remove();
  }
};

} // end if
