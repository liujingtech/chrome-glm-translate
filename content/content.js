// content/content.js

// 监听来自background的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // 保持消息通道开放，支持异步响应
});

// 处理消息
async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.type) {
      case 'TRANSLATE_PAGE':
        await handleTranslatePage();
        sendResponse({ success: true });
        break;

      case 'TRANSLATE_SELECTION':
        await handleTranslateSelection();
        sendResponse({ success: true });
        break;

      case 'TRANSLATE_RESULT':
        await handleTranslateResult(message.data);
        sendResponse({ success: true });
        break;

      case 'REMOVE_TRANSLATIONS':
        removeAllTranslations();
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
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('处理消息失败:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// 处理整页翻译
async function handleTranslatePage() {
  showLoadingState();

  try {
    // 提取页面文本
    const textNodes = extractPageTexts();

    if (textNodes.length === 0) {
      hideLoadingState();
      showError('页面上没有可翻译的内容');
      return;
    }

    // 分组处理
    const groups = groupTextsForTranslation(textNodes);

    // 发送翻译请求到background
    chrome.runtime.sendMessage({
      type: 'REQUEST_TRANSLATION',
      data: {
        groups: groups.map(group => group.map(item => item.text)),
        url: window.location.href,
        nodeCount: textNodes.length
      }
    });

  } catch (error) {
    hideLoadingState();
    showError('翻译失败: ' + error.message);
  }
}

// 处理选中内容翻译
async function handleTranslateSelection() {
  const selection = extractSelectedText();

  if (!selection) {
    showError('请先选择要翻译的内容');
    return;
  }

  showLoadingState();

  // 发送翻译请求到background
  chrome.runtime.sendMessage({
    type: 'REQUEST_SELECTION_TRANSLATION',
    data: {
      text: selection.text,
      rect: selection.rect
    }
  });
}

// 处理翻译结果
async function handleTranslateResult(data) {
  hideLoadingState();

  if (!data.success) {
    showError(data.error || '翻译失败');
    return;
  }

  // 重新提取页面文本节点以匹配
  const textNodes = extractPageTexts();
  const translatedTexts = data.translations;

  // 渲染双语对照
  renderBilingualBatch(textNodes, translatedTexts);
}

// 处理选中翻译结果
function handleSelectionTranslationResult(data) {
  hideLoadingState();

  if (!data.success) {
    showError(data.error || '翻译失败');
    return;
  }

  showSelectionPopup(data.translated, data.rect);
}

// 设置引导弹窗事件
function setupGuideEvents() {
  const submitBtn = document.getElementById('zhipu-guide-submit');
  const apiInput = document.getElementById('zhipu-api-input');
  const overlay = document.querySelector('.zhipu-guide-overlay');

  if (submitBtn && apiInput) {
    submitBtn.onclick = async () => {
      const apiKey = apiInput.value.trim();
      if (!apiKey) {
        apiInput.focus();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = '验证中...';

      // 发送到background验证
      chrome.runtime.sendMessage({
        type: 'SAVE_API_KEY',
        data: { apiKey }
      }, (response) => {
        if (response && response.success) {
          hideApiKeyGuide();
          showSuccess('API Key配置成功！');
        } else {
          submitBtn.disabled = false;
          submitBtn.textContent = '保存并开始使用';
          showError(response?.error || 'API Key验证失败');
        }
      });
    };
  }

  // 点击遮罩关闭
  if (overlay) {
    overlay.onclick = hideApiKeyGuide;
  }
}

// 初始化时清理可能存在的旧翻译（页面刷新时）
window.addEventListener('load', () => {
  removeAllTranslations();
});
