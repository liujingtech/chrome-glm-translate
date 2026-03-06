# 智谱翻译 Chrome 插件实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建一个基于智谱API的网页翻译Chrome插件，支持右键翻译整页/选中内容，双语对照显示。

**Architecture:** Manifest V3架构，Background Service Worker处理右键菜单和API调用，Content Script负责页面文本提取和双语渲染，Popup/Options提供设置界面，使用chrome.storage.local存储配置和缓存。

**Tech Stack:** 原生JavaScript (ES6+), Chrome Extension Manifest V3, 智谱GLM API

---

## Task 1: 项目初始化和manifest.json

**Files:**
- Create: `manifest.json`
- Create: `icons/icon16.png`
- Create: `icons/icon48.png`
- Create: `icons/icon128.png`

**Step 1: 创建manifest.json**

```json
{
  "manifest_version": 3,
  "name": "智谱翻译",
  "version": "1.0.0",
  "description": "基于智谱API的网页翻译插件，支持整页翻译和选中翻译",
  "permissions": [
    "contextMenus",
    "storage",
    "activeTab"
  ],
  "background": {
    "service_worker": "background/service-worker.js"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": [
      "utils/constants.js",
      "content/extractor.js",
      "content/renderer.js",
      "content/content.js"
    ],
    "css": ["content/content.css"]
  }],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "options_page": "options/options.html",
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

**Step 2: 创建图标目录**

```bash
mkdir -p icons
```

**Step 3: 创建占位图标文件**

创建简单的占位图标（后续可替换为正式图标）。使用任意PNG图片工具创建16x16、48x48、128x128三个尺寸的图标。

**Step 4: 验证manifest有效性**

在Chrome中打开 `chrome://extensions/`，启用开发者模式，点击"加载已解压的扩展程序"，选择项目目录。确认无错误提示。

**Step 5: 提交**

```bash
git add manifest.json icons/
git commit -m "feat: 初始化项目结构和manifest.json"
```

---

## Task 2: 创建常量定义模块

**Files:**
- Create: `utils/constants.js`

**Step 1: 创建constants.js**

```javascript
// utils/constants.js

// 智谱API模型映射
const MODELS = {
  'GLM-4': 'glm-4',
  'GLM-4-AIR': 'glm-4-air',
  'GLM-4-FLASH': 'glm-4-flash'
};

// 模型显示名称
const MODEL_NAMES = Object.keys(MODELS);

// 支持的目标语言
const LANGUAGES = [
  { code: 'zh-CN', name: '简体中文' },
  { code: 'zh-TW', name: '繁体中文' },
  { code: 'en', name: '英语' },
  { code: 'ja', name: '日语' },
  { code: 'ko', name: '韩语' },
  { code: 'fr', name: '法语' },
  { code: 'de', name: '德语' },
  { code: 'es', name: '西班牙语' },
  { code: 'ru', name: '俄语' }
];

// 默认设置
const DEFAULT_SETTINGS = {
  apiKey: '',
  targetLang: 'zh-CN',
  model: 'GLM-4-FLASH'
};

// 智能过滤跳过的标签
const SKIP_TAGS = ['SCRIPT', 'STYLE', 'CODE', 'PRE', 'INPUT', 'TEXTAREA', 'NOSCRIPT', 'KBD', 'SAMP'];

// 智谱API端点
const API_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

// 消息类型常量
const MESSAGE_TYPES = {
  TRANSLATE_PAGE: 'TRANSLATE_PAGE',
  TRANSLATE_SELECTION: 'TRANSLATE_SELECTION',
  TRANSLATE_RESULT: 'TRANSLATE_RESULT',
  GET_SETTINGS: 'GET_SETTINGS',
  SAVE_SETTINGS: 'SAVE_SETTINGS',
  CHECK_API_KEY: 'CHECK_API_KEY',
  CLEAR_CACHE: 'CLEAR_CACHE'
};

// 导出（供其他脚本使用）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MODELS,
    MODEL_NAMES,
    LANGUAGES,
    DEFAULT_SETTINGS,
    SKIP_TAGS,
    API_ENDPOINT,
    MESSAGE_TYPES
  };
}
```

**Step 2: 提交**

```bash
git add utils/constants.js
git commit -m "feat: 添加常量定义模块"
```

---

## Task 3: 创建存储管理模块

**Files:**
- Create: `utils/storage.js`

**Step 1: 创建storage.js**

```javascript
// utils/storage.js

// 获取设置
async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['apiKey', 'targetLang', 'model'], (result) => {
      resolve({
        apiKey: result.apiKey || '',
        targetLang: result.targetLang || 'zh-CN',
        model: result.model || 'GLM-4-FLASH'
      });
    });
  });
}

// 保存设置
async function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.local.set(settings, resolve);
  });
}

// 检查是否已配置API Key
async function hasApiKey() {
  const settings = await getSettings();
  return !!settings.apiKey && settings.apiKey.trim().length > 0;
}

// 获取缓存
async function getCache(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['cache'], (result) => {
      const cache = result.cache || {};
      resolve(cache[key] || null);
    });
  });
}

// 设置缓存
async function setCache(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['cache'], (result) => {
      const cache = result.cache || {};
      cache[key] = {
        ...value,
        timestamp: Date.now()
      };
      chrome.storage.local.set({ cache }, resolve);
    });
  });
}

// 清除所有缓存
async function clearCache() {
  return new Promise((resolve) => {
    chrome.storage.local.set({ cache: {} }, resolve);
  });
}

// 生成缓存key（基于URL和内容hash）
function generateCacheKey(url, content) {
  // 简单hash函数
  let hash = 0;
  const str = url + content;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `cache_${Math.abs(hash)}`;
}
```

**Step 2: 提交**

```bash
git add utils/storage.js
git commit -m "feat: 添加存储管理模块"
```

---

## Task 4: 创建API调用模块

**Files:**
- Create: `utils/api.js`

**Step 1: 创建api.js**

```javascript
// utils/api.js

// 调用智谱API进行翻译
async function translateText(text, targetLang, model, apiKey) {
  const languageName = getLanguageName(targetLang);

  const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: getModelIndex(model),
      messages: [{
        role: 'user',
        content: `请将以下内容翻译成${languageName}。要求：
1. 只返回翻译结果，不要有任何解释或额外说明
2. 保持原文的格式和换行
3. 如果原文已经是${languageName}，请原样返回

原文：
${text}`
      }]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API请求失败: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

// 验证API Key是否有效
async function validateApiKey(apiKey) {
  try {
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages: [{
          role: 'user',
          content: 'Hi'
        }],
        max_tokens: 1
      })
    });

    return response.ok;
  } catch (error) {
    return false;
  }
}

// 获取模型索引
function getModelIndex(modelName) {
  const models = {
    'GLM-4': 'glm-4',
    'GLM-4-AIR': 'glm-4-air',
    'GLM-4-FLASH': 'glm-4-flash'
  };
  return models[modelName] || 'glm-4-flash';
}

// 获取语言名称
function getLanguageName(code) {
  const languages = {
    'zh-CN': '简体中文',
    'zh-TW': '繁体中文',
    'en': '英语',
    'ja': '日语',
    'ko': '韩语',
    'fr': '法语',
    'de': '德语',
    'es': '西班牙语',
    'ru': '俄语'
  };
  return languages[code] || code;
}
```

**Step 2: 提交**

```bash
git add utils/api.js
git commit -m "feat: 添加智谱API调用模块"
```

---

## Task 5: 创建文本提取器

**Files:**
- Create: `content/extractor.js`

**Step 1: 创建extractor.js**

```javascript
// content/extractor.js

// 需要跳过的标签
const SKIP_TAGS = ['SCRIPT', 'STYLE', 'CODE', 'PRE', 'INPUT', 'TEXTAREA', 'NOSCRIPT', 'KBD', 'SAMP', 'SVG'];

// 判断节点是否应该跳过
function shouldSkipNode(node) {
  // 检查父元素标签
  let parent = node.parentElement;
  while (parent) {
    if (SKIP_TAGS.includes(parent.tagName)) {
      return true;
    }
    // 跳过已翻译的内容
    if (parent.dataset && parent.dataset.translated === 'true') {
      return true;
    }
    // 跳过可编辑区域
    if (parent.isContentEditable) {
      return true;
    }
    parent = parent.parentElement;
  }

  // 跳过空文本
  if (!node.textContent || !node.textContent.trim()) {
    return true;
  }

  // 跳过纯空白字符
  if (/^\s+$/.test(node.textContent)) {
    return true;
  }

  return false;
}

// 提取页面所有可翻译的文本节点
function extractPageTexts() {
  const textNodes = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  let node;
  while (node = walker.nextNode()) {
    if (!shouldSkipNode(node)) {
      textNodes.push({
        node: node,
        text: node.textContent.trim(),
        parent: node.parentElement
      });
    }
  }

  return textNodes;
}

// 提取选中的文本
function extractSelectedText() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const text = selection.toString().trim();
  if (!text) {
    return null;
  }

  // 获取选区的位置信息
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  return {
    text: text,
    rect: {
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height
    }
  };
}

// 将文本按段落/块分组，避免单次API调用内容过长
function groupTextsForTranslation(textNodes, maxChunkSize = 2000) {
  const groups = [];
  let currentGroup = [];
  let currentLength = 0;

  for (const item of textNodes) {
    const text = item.text;

    // 如果单个文本超过限制，单独处理
    if (text.length > maxChunkSize) {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
        currentLength = 0;
      }
      groups.push([item]);
      continue;
    }

    // 如果加入当前文本会超限，先保存当前组
    if (currentLength + text.length > maxChunkSize && currentGroup.length > 0) {
      groups.push(currentGroup);
      currentGroup = [];
      currentLength = 0;
    }

    currentGroup.push(item);
    currentLength += text.length;
  }

  // 保存最后一组
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

// 生成内容的简单hash
function hashContent(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}
```

**Step 2: 提交**

```bash
git add content/extractor.js
git commit -m "feat: 添加页面文本提取器"
```

---

## Task 6: 创建双语渲染器

**Files:**
- Create: `content/renderer.js`

**Step 1: 创建renderer.js**

```javascript
// content/renderer.js

// 为单个文本节点渲染双语对照
function renderBilingual(textNode, translatedText) {
  const parent = textNode.parentElement;

  // 创建译文容器
  const translationWrapper = document.createElement('div');
  translationWrapper.className = 'zhipu-translation-wrapper';
  translationWrapper.dataset.translated = 'true';

  const translationContent = document.createElement('div');
  translationContent.className = 'zhipu-translation-content';
  translationContent.textContent = translatedText;

  translationWrapper.appendChild(translationContent);

  // 在原文节点后插入译文
  if (textNode.nextSibling) {
    parent.insertBefore(translationWrapper, textNode.nextSibling);
  } else {
    parent.appendChild(translationWrapper);
  }

  // 标记原文父元素
  parent.dataset.translated = 'true';

  return translationWrapper;
}

// 批量渲染双语对照
function renderBilingualBatch(textNodes, translatedTexts) {
  const results = [];

  for (let i = 0; i < textNodes.length; i++) {
    const item = textNodes[i];
    const translated = translatedTexts[i];

    if (translated && translated !== item.text) {
      try {
        const wrapper = renderBilingual(item.node, translated);
        results.push({
          original: item.text,
          translated: translated,
          wrapper: wrapper
        });
      } catch (e) {
        console.warn('渲染译文失败:', e);
      }
    }
  }

  return results;
}

// 显示选中内容的翻译弹窗
function showSelectionPopup(text, rect) {
  // 移除已存在的弹窗
  hideSelectionPopup();

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
  closeBtn.onclick = hideSelectionPopup;

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
}

// 隐藏选中内容翻译弹窗
function hideSelectionPopup() {
  const popup = document.getElementById('zhipu-selection-popup');
  if (popup) {
    popup.remove();
  }
}

// 移除所有翻译（恢复原页面）
function removeAllTranslations() {
  // 移除所有译文容器
  const wrappers = document.querySelectorAll('.zhipu-translation-wrapper');
  wrappers.forEach(wrapper => wrapper.remove());

  // 移除选中翻译弹窗
  hideSelectionPopup();

  // 移除translated标记
  const translatedElements = document.querySelectorAll('[data-translated="true"]');
  translatedElements.forEach(el => {
    delete el.dataset.translated;
  });
}

// 显示加载状态
function showLoadingState() {
  const loader = document.createElement('div');
  loader.id = 'zhipu-loading';
  loader.className = 'zhipu-loading';
  loader.innerHTML = '<div class="zhipu-spinner"></div><span>翻译中...</span>';
  document.body.appendChild(loader);
}

// 隐藏加载状态
function hideLoadingState() {
  const loader = document.getElementById('zhipu-loading');
  if (loader) {
    loader.remove();
  }
}

// 显示错误提示
function showError(message) {
  const error = document.createElement('div');
  error.className = 'zhipu-error';
  error.textContent = message;
  document.body.appendChild(error);

  // 3秒后自动消失
  setTimeout(() => {
    error.remove();
  }, 3000);
}

// 显示首次使用引导弹窗
function showApiKeyGuide() {
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
}

// 隐藏首次使用引导弹窗
function hideApiKeyGuide() {
  const guide = document.getElementById('zhipu-api-guide');
  if (guide) {
    guide.remove();
  }
}
```

**Step 2: 提交**

```bash
git add content/renderer.js
git commit -m "feat: 添加双语渲染器"
```

---

## Task 7: 创建Content Script主入口

**Files:**
- Create: `content/content.js`

**Step 1: 创建content.js**

```javascript
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
        url: window.location.href
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

  // 获取原文节点
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

// 显示成功提示
function showSuccess(message) {
  const success = document.createElement('div');
  success.className = 'zhipu-success';
  success.textContent = message;
  document.body.appendChild(success);

  setTimeout(() => {
    success.remove();
  }, 2000);
}

// 初始化时清理可能存在的旧翻译（页面刷新时）
window.addEventListener('load', () => {
  removeAllTranslations();
});
```

**Step 2: 提交**

```bash
git add content/content.js
git commit -m "feat: 添加Content Script主入口"
```

---

## Task 8: 创建Content Script样式

**Files:**
- Create: `content/content.css`

**Step 1: 创建content.css**

```css
/* content/content.css */

/* 双语对照译文样式 */
.zhipu-translation-wrapper {
  margin: 4px 0;
  padding: 8px 12px;
  background-color: #f5f5f5;
  border-left: 3px solid #1890ff;
  border-radius: 0 4px 4px 0;
  font-size: 0.95em;
  line-height: 1.6;
  color: #333;
}

.zhipu-translation-content {
  word-wrap: break-word;
  white-space: pre-wrap;
}

/* 选中内容翻译弹窗 */
.zhipu-selection-popup {
  position: absolute;
  z-index: 2147483647;
  max-width: 400px;
  min-width: 200px;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  font-size: 14px;
  line-height: 1.6;
  color: #333;
}

.zhipu-popup-content {
  margin-top: 8px;
  word-wrap: break-word;
  white-space: pre-wrap;
}

.zhipu-popup-close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  font-size: 18px;
  color: #999;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.zhipu-popup-close:hover {
  background: #f0f0f0;
  color: #666;
}

/* 加载状态 */
.zhipu-loading {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 2147483647;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  font-size: 14px;
  color: #333;
}

.zhipu-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #e6e6e6;
  border-top-color: #1890ff;
  border-radius: 50%;
  animation: zhipu-spin 0.8s linear infinite;
}

@keyframes zhipu-spin {
  to {
    transform: rotate(360deg);
  }
}

/* 错误提示 */
.zhipu-error {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 2147483647;
  padding: 12px 20px;
  background: #fff2f0;
  border: 1px solid #ffccc7;
  border-radius: 8px;
  color: #ff4d4f;
  font-size: 14px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  animation: zhipu-fadeIn 0.3s ease;
}

/* 成功提示 */
.zhipu-success {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 2147483647;
  padding: 12px 20px;
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  border-radius: 8px;
  color: #52c41a;
  font-size: 14px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  animation: zhipu-fadeIn 0.3s ease;
}

@keyframes zhipu-fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* API Key引导弹窗 */
.zhipu-api-guide {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2147483647;
  display: flex;
  align-items: center;
  justify-content: center;
}

.zhipu-guide-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
}

.zhipu-guide-content {
  position: relative;
  z-index: 1;
  width: 360px;
  padding: 24px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  text-align: center;
}

.zhipu-guide-content h3 {
  margin: 0 0 16px;
  font-size: 20px;
  color: #333;
}

.zhipu-guide-content p {
  margin: 0 0 16px;
  color: #666;
}

.zhipu-guide-content input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  font-size: 14px;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.zhipu-guide-content input:focus {
  outline: none;
  border-color: #1890ff;
}

.zhipu-guide-link {
  display: block;
  margin: 12px 0 16px;
  color: #1890ff;
  text-decoration: none;
  font-size: 13px;
}

.zhipu-guide-link:hover {
  text-decoration: underline;
}

.zhipu-guide-content button {
  width: 100%;
  padding: 10px 16px;
  background: #1890ff;
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.zhipu-guide-content button:hover {
  background: #40a9ff;
}

.zhipu-guide-content button:disabled {
  background: #d9d9d9;
  cursor: not-allowed;
}
```

**Step 2: 提交**

```bash
git add content/content.css
git commit -m "feat: 添加Content Script样式"
```

---

## Task 9: 创建Background Service Worker

**Files:**
- Create: `background/service-worker.js`

**Step 1: 创建service-worker.js**

```javascript
// background/service-worker.js

// 插件安装时创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  // 翻译整页
  chrome.contextMenus.create({
    id: 'translatePage',
    title: '翻译整页',
    contexts: ['page']
  });

  // 翻译选中内容
  chrome.contextMenus.create({
    id: 'translateSelection',
    title: '翻译选中内容',
    contexts: ['selection']
  });

  console.log('智谱翻译插件已安装');
});

// 右键菜单点击事件
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  // 检查API Key
  const hasKey = await checkApiKey();

  if (!hasKey) {
    // 显示API Key引导
    chrome.tabs.sendMessage(tab.id, { type: 'SHOW_API_GUIDE' });
    return;
  }

  switch (info.menuItemId) {
    case 'translatePage':
      await handleTranslatePage(tab);
      break;
    case 'translateSelection':
      await handleTranslateSelection(tab, info.selectionText);
      break;
  }
});

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true;
});

// 处理消息
async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.type) {
      case 'REQUEST_TRANSLATION':
        await processPageTranslation(message.data, sender.tab.id);
        sendResponse({ success: true });
        break;

      case 'REQUEST_SELECTION_TRANSLATION':
        await processSelectionTranslation(message.data, sender.tab.id);
        sendResponse({ success: true });
        break;

      case 'SAVE_API_KEY':
        const isValid = await validateApiKey(message.data.apiKey);
        if (isValid) {
          await saveSettings({ apiKey: message.data.apiKey });
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'API Key无效' });
        }
        break;

      case 'GET_SETTINGS':
        const settings = await getSettings();
        sendResponse({ success: true, data: settings });
        break;

      case 'SAVE_SETTINGS':
        await saveSettings(message.data);
        sendResponse({ success: true });
        break;

      case 'CLEAR_CACHE':
        await clearCache();
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('Background处理消息失败:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// 处理整页翻译
async function handleTranslatePage(tab) {
  try {
    chrome.tabs.sendMessage(tab.id, { type: 'TRANSLATE_PAGE' });
  } catch (error) {
    console.error('触发整页翻译失败:', error);
  }
}

// 处理选中翻译
async function handleTranslateSelection(tab, selectedText) {
  try {
    chrome.tabs.sendMessage(tab.id, {
      type: 'TRANSLATE_SELECTION',
      data: { text: selectedText }
    });
  } catch (error) {
    console.error('触发选中翻译失败:', error);
  }
}

// 处理页面翻译请求
async function processPageTranslation(data, tabId) {
  const settings = await getSettings();
  const { groups, url } = data;
  const allTranslations = [];

  for (const group of groups) {
    // 合并一组文本
    const combinedText = group.join('\n---SEPARATOR---\n');

    // 检查缓存
    const cacheKey = generateCacheKey(url, combinedText);
    const cached = await getCache(cacheKey);

    let translatedText;
    if (cached) {
      translatedText = cached.translated;
    } else {
      // 调用API翻译
      try {
        translatedText = await translateText(
          combinedText,
          settings.targetLang,
          settings.model,
          settings.apiKey
        );

        // 保存缓存
        await setCache(cacheKey, {
          original: combinedText,
          translated: translatedText
        });
      } catch (error) {
        chrome.tabs.sendMessage(tabId, {
          type: 'TRANSLATE_RESULT',
          data: { success: false, error: error.message }
        });
        return;
      }
    }

    // 分割翻译结果
    const translations = translatedText.split('\n---SEPARATOR---\n');
    allTranslations.push(...translations);
  }

  // 发送翻译结果到content script
  chrome.tabs.sendMessage(tabId, {
    type: 'TRANSLATE_RESULT',
    data: { success: true, translations: allTranslations }
  });
}

// 处理选中翻译请求
async function processSelectionTranslation(data, tabId) {
  const settings = await getSettings();
  const { text, rect } = data;

  try {
    const translated = await translateText(
      text,
      settings.targetLang,
      settings.model,
      settings.apiKey
    );

    chrome.tabs.sendMessage(tabId, {
      type: 'SELECTION_TRANSLATION_RESULT',
      data: { success: true, translated, rect }
    });
  } catch (error) {
    chrome.tabs.sendMessage(tabId, {
      type: 'SELECTION_TRANSLATION_RESULT',
      data: { success: false, error: error.message, rect }
    });
  }
}

// 检查API Key是否存在
async function checkApiKey() {
  const settings = await getSettings();
  return !!settings.apiKey && settings.apiKey.trim().length > 0;
}

// 获取设置
async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['apiKey', 'targetLang', 'model'], (result) => {
      resolve({
        apiKey: result.apiKey || '',
        targetLang: result.targetLang || 'zh-CN',
        model: result.model || 'GLM-4-FLASH'
      });
    });
  });
}

// 保存设置
async function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.local.set(settings, resolve);
  });
}

// 获取缓存
async function getCache(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['cache'], (result) => {
      const cache = result.cache || {};
      resolve(cache[key] || null);
    });
  });
}

// 设置缓存
async function setCache(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['cache'], (result) => {
      const cache = result.cache || {};
      cache[key] = {
        ...value,
        timestamp: Date.now()
      };
      chrome.storage.local.set({ cache }, resolve);
    });
  });
}

// 清除缓存
async function clearCache() {
  return new Promise((resolve) => {
    chrome.storage.local.set({ cache: {} }, resolve);
  });
}

// 生成缓存key
function generateCacheKey(url, content) {
  let hash = 0;
  const str = url + content;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `cache_${Math.abs(hash)}`;
}

// 验证API Key
async function validateApiKey(apiKey) {
  try {
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1
      })
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

// 翻译文本
async function translateText(text, targetLang, model, apiKey) {
  const languageName = getLanguageName(targetLang);
  const modelIndex = getModelIndex(model);

  const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelIndex,
      messages: [{
        role: 'user',
        content: `请将以下内容翻译成${languageName}。要求：
1. 只返回翻译结果，不要有任何解释或额外说明
2. 保持原文的格式和换行
3. 如果原文已经是${languageName}，请原样返回
4. 如果有多段内容用---SEPARATOR---分隔，翻译后保持相同的分隔符

原文：
${text}`
      }]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API请求失败: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

// 获取模型索引
function getModelIndex(modelName) {
  const models = {
    'GLM-4': 'glm-4',
    'GLM-4-AIR': 'glm-4-air',
    'GLM-4-FLASH': 'glm-4-flash'
  };
  return models[modelName] || 'glm-4-flash';
}

// 获取语言名称
function getLanguageName(code) {
  const languages = {
    'zh-CN': '简体中文',
    'zh-TW': '繁体中文',
    'en': '英语',
    'ja': '日语',
    'ko': '韩语',
    'fr': '法语',
    'de': '德语',
    'es': '西班牙语',
    'ru': '俄语'
  };
  return languages[code] || code;
}
```

**Step 2: 提交**

```bash
git add background/service-worker.js
git commit -m "feat: 添加Background Service Worker"
```

---

## Task 10: 创建Popup界面

**Files:**
- Create: `popup/popup.html`
- Create: `popup/popup.js`
- Create: `popup/popup.css`

**Step 1: 创建popup.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>智谱翻译</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="popup-container">
    <div class="popup-header">
      <span class="popup-icon">🔤</span>
      <span class="popup-title">智谱翻译</span>
    </div>

    <div class="popup-content">
      <div class="setting-item">
        <label>目标语言</label>
        <select id="targetLang"></select>
      </div>

      <div class="setting-item">
        <label>翻译模型</label>
        <select id="model"></select>
      </div>
    </div>

    <div class="popup-footer">
      <a href="../options/options.html" id="openOptions" class="link-btn">
        ⚙️ 完整设置
      </a>
    </div>
  </div>

  <script src="popup.js"></script>
</body>
</html>
```

**Step 2: 创建popup.js**

```javascript
// popup/popup.js

// 语言列表
const LANGUAGES = [
  { code: 'zh-CN', name: '简体中文' },
  { code: 'zh-TW', name: '繁体中文' },
  { code: 'en', name: '英语' },
  { code: 'ja', name: '日语' },
  { code: 'ko', name: '韩语' },
  { code: 'fr', name: '法语' },
  { code: 'de', name: '德语' },
  { code: 'es', name: '西班牙语' },
  { code: 'ru', name: '俄语' }
];

// 模型列表
const MODELS = ['GLM-4-FLASH', 'GLM-4-AIR', 'GLM-4'];

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  initLanguageSelect();
  initModelSelect();
  bindEvents();
});

// 加载设置
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['targetLang', 'model'], (result) => {
      window.currentSettings = {
        targetLang: result.targetLang || 'zh-CN',
        model: result.model || 'GLM-4-FLASH'
      };
      resolve();
    });
  });
}

// 初始化语言选择器
function initLanguageSelect() {
  const select = document.getElementById('targetLang');
  select.innerHTML = '';

  LANGUAGES.forEach(lang => {
    const option = document.createElement('option');
    option.value = lang.code;
    option.textContent = lang.name;
    if (lang.code === window.currentSettings.targetLang) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

// 初始化模型选择器
function initModelSelect() {
  const select = document.getElementById('model');
  select.innerHTML = '';

  MODELS.forEach(model => {
    const option = document.createElement('option');
    option.value = model;
    option.textContent = model;
    if (model === window.currentSettings.model) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

// 绑定事件
function bindEvents() {
  // 语言选择变化
  document.getElementById('targetLang').addEventListener('change', async (e) => {
    await saveSetting('targetLang', e.target.value);
  });

  // 模型选择变化
  document.getElementById('model').addEventListener('change', async (e) => {
    await saveSetting('model', e.target.value);
  });

  // 打开设置页
  document.getElementById('openOptions').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

// 保存设置
async function saveSetting(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}
```

**Step 3: 创建popup.css**

```css
/* popup/popup.css */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  width: 280px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 14px;
  color: #333;
}

.popup-container {
  padding: 16px;
}

.popup-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.popup-icon {
  font-size: 20px;
}

.popup-title {
  font-size: 16px;
  font-weight: 600;
}

.popup-content {
  margin-bottom: 16px;
}

.setting-item {
  margin-bottom: 12px;
}

.setting-item:last-child {
  margin-bottom: 0;
}

.setting-item label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: #666;
}

.setting-item select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  font-size: 14px;
  color: #333;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.2s;
}

.setting-item select:focus {
  outline: none;
  border-color: #1890ff;
}

.setting-item select:hover {
  border-color: #40a9ff;
}

.popup-footer {
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.link-btn {
  display: block;
  text-align: center;
  padding: 8px 12px;
  color: #1890ff;
  text-decoration: none;
  font-size: 13px;
  border-radius: 6px;
  transition: background 0.2s;
}

.link-btn:hover {
  background: #f0f7ff;
}
```

**Step 4: 提交**

```bash
git add popup/
git commit -m "feat: 添加Popup快速设置界面"
```

---

## Task 11: 创建Options设置页

**Files:**
- Create: `options/options.html`
- Create: `options/options.js`
- Create: `options/options.css`

**Step 1: 创建options.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>智谱翻译 - 设置</title>
  <link rel="stylesheet" href="options.css">
</head>
<body>
  <div class="options-container">
    <div class="options-header">
      <h1>🔤 智谱翻译</h1>
      <p>基于智谱GLM模型的网页翻译插件</p>
    </div>

    <!-- API配置 -->
    <div class="options-section">
      <h2>API配置</h2>
      <div class="form-group">
        <label for="apiKey">智谱API Key</label>
        <div class="input-group">
          <input type="password" id="apiKey" placeholder="请输入您的智谱API Key">
          <button id="verifyApiKey" class="btn btn-secondary">验证</button>
        </div>
        <div class="form-hint">
          <a href="https://open.bigmodel.cn/" target="_blank">获取API Key →</a>
        </div>
        <div id="apiKeyStatus" class="status-message"></div>
      </div>
    </div>

    <!-- 翻译设置 -->
    <div class="options-section">
      <h2>翻译设置</h2>
      <div class="form-group">
        <label for="targetLang">目标语言</label>
        <select id="targetLang"></select>
      </div>
      <div class="form-group">
        <label for="model">翻译模型</label>
        <select id="model"></select>
        <div class="form-hint">
          <span>GLM-4-FLASH: 快速响应 | GLM-4-AIR: 平衡性能 | GLM-4: 最佳效果</span>
        </div>
      </div>
    </div>

    <!-- 快捷键设置 -->
    <div class="options-section">
      <h2>快捷键</h2>
      <div class="form-group">
        <label>键盘快捷键</label>
        <button id="openShortcuts" class="btn btn-secondary">配置快捷键</button>
        <div class="form-hint">
          点击后在Chrome扩展快捷键设置页面配置
        </div>
      </div>
    </div>

    <!-- 其他设置 -->
    <div class="options-section">
      <h2>其他</h2>
      <div class="form-group">
        <button id="clearCache" class="btn btn-secondary">清除翻译缓存</button>
      </div>
      <div class="form-group">
        <button id="resetSettings" class="btn btn-danger">重置所有设置</button>
      </div>
    </div>

    <!-- 保存按钮 -->
    <div class="options-footer">
      <button id="saveSettings" class="btn btn-primary">保存设置</button>
      <span id="saveStatus" class="status-message"></span>
    </div>
  </div>

  <script src="options.js"></script>
</body>
</html>
```

**Step 2: 创建options.js**

```javascript
// options/options.js

// 语言列表
const LANGUAGES = [
  { code: 'zh-CN', name: '简体中文' },
  { code: 'zh-TW', name: '繁体中文' },
  { code: 'en', name: '英语' },
  { code: 'ja', name: '日语' },
  { code: 'ko', name: '韩语' },
  { code: 'fr', name: '法语' },
  { code: 'de', name: '德语' },
  { code: 'es', name: '西班牙语' },
  { code: 'ru', name: '俄语' }
];

// 模型列表
const MODELS = [
  { value: 'GLM-4-FLASH', name: 'GLM-4-FLASH (快速)' },
  { value: 'GLM-4-AIR', name: 'GLM-4-AIR (平衡)' },
  { value: 'GLM-4', name: 'GLM-4 (最佳)' }
];

// 默认设置
const DEFAULT_SETTINGS = {
  apiKey: '',
  targetLang: 'zh-CN',
  model: 'GLM-4-FLASH'
};

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  initLanguageSelect();
  initModelSelect();
  bindEvents();
});

// 加载设置
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['apiKey', 'targetLang', 'model'], (result) => {
      document.getElementById('apiKey').value = result.apiKey || '';
      window.currentSettings = {
        targetLang: result.targetLang || DEFAULT_SETTINGS.targetLang,
        model: result.model || DEFAULT_SETTINGS.model
      };
      resolve();
    });
  });
}

// 初始化语言选择器
function initLanguageSelect() {
  const select = document.getElementById('targetLang');
  select.innerHTML = '';

  LANGUAGES.forEach(lang => {
    const option = document.createElement('option');
    option.value = lang.code;
    option.textContent = lang.name;
    if (lang.code === window.currentSettings.targetLang) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

// 初始化模型选择器
function initModelSelect() {
  const select = document.getElementById('model');
  select.innerHTML = '';

  MODELS.forEach(model => {
    const option = document.createElement('option');
    option.value = model.value;
    option.textContent = model.name;
    if (model.value === window.currentSettings.model) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

// 绑定事件
function bindEvents() {
  // 验证API Key
  document.getElementById('verifyApiKey').addEventListener('click', verifyApiKey);

  // 保存设置
  document.getElementById('saveSettings').addEventListener('click', saveSettings);

  // 打开快捷键设置
  document.getElementById('openShortcuts').addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  });

  // 清除缓存
  document.getElementById('clearCache').addEventListener('click', clearCache);

  // 重置设置
  document.getElementById('resetSettings').addEventListener('click', resetSettings);
}

// 验证API Key
async function verifyApiKey() {
  const apiKey = document.getElementById('apiKey').value.trim();
  const statusEl = document.getElementById('apiKeyStatus');

  if (!apiKey) {
    showStatus(statusEl, '请输入API Key', 'error');
    return;
  }

  statusEl.textContent = '验证中...';
  statusEl.className = 'status-message';

  try {
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1
      })
    });

    if (response.ok) {
      showStatus(statusEl, '✓ API Key有效', 'success');
    } else {
      const data = await response.json().catch(() => ({}));
      showStatus(statusEl, `✗ ${data.error?.message || 'API Key无效'}`, 'error');
    }
  } catch (error) {
    showStatus(statusEl, `✗ 验证失败: ${error.message}`, 'error');
  }
}

// 保存设置
async function saveSettings() {
  const settings = {
    apiKey: document.getElementById('apiKey').value.trim(),
    targetLang: document.getElementById('targetLang').value,
    model: document.getElementById('model').value
  };

  const statusEl = document.getElementById('saveStatus');

  return new Promise((resolve) => {
    chrome.storage.local.set(settings, () => {
      showStatus(statusEl, '✓ 设置已保存', 'success');
      setTimeout(() => {
        statusEl.textContent = '';
      }, 2000);
      resolve();
    });
  });
}

// 清除缓存
async function clearCache() {
  if (!confirm('确定要清除所有翻译缓存吗？')) {
    return;
  }

  return new Promise((resolve) => {
    chrome.storage.local.set({ cache: {} }, () => {
      alert('缓存已清除');
      resolve();
    });
  });
}

// 重置设置
async function resetSettings() {
  if (!confirm('确定要重置所有设置吗？这将清除API Key和所有配置。')) {
    return;
  }

  return new Promise((resolve) => {
    chrome.storage.local.set({
      ...DEFAULT_SETTINGS,
      cache: {}
    }, () => {
      // 重新加载页面
      location.reload();
      resolve();
    });
  });
}

// 显示状态消息
function showStatus(element, message, type) {
  element.textContent = message;
  element.className = `status-message ${type}`;
}
```

**Step 3: 创建options.css**

```css
/* options/options.css */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 14px;
  color: #333;
  background: #f5f5f5;
  min-height: 100vh;
  padding: 24px;
}

.options-container {
  max-width: 600px;
  margin: 0 auto;
}

.options-header {
  text-align: center;
  margin-bottom: 32px;
}

.options-header h1 {
  font-size: 24px;
  margin-bottom: 8px;
}

.options-header p {
  color: #666;
  font-size: 14px;
}

.options-section {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.options-section h2 {
  font-size: 16px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.form-group {
  margin-bottom: 16px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}

.form-group input[type="text"],
.form-group input[type="password"],
.form-group select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #1890ff;
}

.input-group {
  display: flex;
  gap: 8px;
}

.input-group input {
  flex: 1;
}

.form-hint {
  margin-top: 8px;
  font-size: 12px;
  color: #999;
}

.form-hint a {
  color: #1890ff;
  text-decoration: none;
}

.form-hint a:hover {
  text-decoration: underline;
}

.status-message {
  margin-top: 8px;
  font-size: 13px;
}

.status-message.success {
  color: #52c41a;
}

.status-message.error {
  color: #ff4d4f;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #1890ff;
  color: #fff;
}

.btn-primary:hover {
  background: #40a9ff;
}

.btn-secondary {
  background: #f0f0f0;
  color: #333;
}

.btn-secondary:hover {
  background: #e6e6e6;
}

.btn-danger {
  background: #fff;
  color: #ff4d4f;
  border: 1px solid #ff4d4f;
}

.btn-danger:hover {
  background: #fff1f0;
}

.options-footer {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.options-footer .status-message {
  margin-top: 0;
}
```

**Step 4: 提交**

```bash
git add options/
git commit -m "feat: 添加Options完整设置页面"
```

---

## Task 12: 创建图标资源

**Files:**
- Create: `icons/icon16.png` (占位图标)
- Create: `icons/icon48.png` (占位图标)
- Create: `icons/icon128.png` (占位图标)

**Step 1: 创建简单的SVG占位图标**

由于没有图片编辑工具，使用Chrome扩展的默认占位方式。创建一个简单的HTML来生成图标：

```bash
# 在icons目录下创建占位文件
# 实际使用时应该用设计好的图标
touch icons/.gitkeep
```

**Step 2: 更新manifest.json使用内置图标或暂不使用图标**

由于图标是必需的，我们需要临时方案。可以使用一个在线favicon生成器或使用data URI。

最简单的方法是先生成一个简单的PNG文件。

**Step 3: 临时解决方案 - 使用Canvas生成图标**

在浏览器控制台运行以下代码生成图标：

```javascript
// 生成16x16图标
const canvas16 = document.createElement('canvas');
canvas16.width = 16;
canvas16.height = 16;
const ctx16 = canvas16.getContext('2d');
ctx16.fillStyle = '#1890ff';
ctx16.fillRect(0, 0, 16, 16);
ctx16.fillStyle = '#fff';
ctx16.font = '12px Arial';
ctx16.textAlign = 'center';
ctx16.fillText('T', 8, 12);
console.log(canvas16.toDataURL('image/png'));
```

**Step 4: 提交占位文件**

```bash
git add icons/
git commit -m "feat: 添加占位图标目录"
```

---

## Task 13: 最终测试和调试

**Step 1: 加载插件测试**

1. 打开Chrome浏览器
2. 访问 `chrome://extensions/`
3. 启用"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目目录

**Step 2: 测试右键菜单**

1. 打开任意英文网页
2. 右键点击页面空白处
3. 确认看到"翻译整页"选项
4. 选中一段文字
5. 右键点击
6. 确认看到"翻译选中内容"选项

**Step 3: 测试首次引导**

1. 首次使用时点击右键菜单
2. 确认弹出API Key配置引导
3. 输入测试API Key
4. 点击保存

**Step 4: 测试翻译功能**

1. 在英文页面点击"翻译整页"
2. 确认显示加载状态
3. 确认页面显示双语对照
4. 选中文字点击"翻译选中内容"
5. 确认弹窗显示翻译结果

**Step 5: 测试设置页**

1. 点击插件图标
2. 确认Popup显示正常
3. 切换语言和模型
4. 进入完整设置页
5. 测试各项设置功能

**Step 6: 修复发现的问题**

根据测试结果修复任何问题。

**Step 7: 最终提交**

```bash
git add .
git commit -m "fix: 修复测试发现的问题"
```

---

## 功能清单验收

- [ ] 右键菜单显示"翻译整页"和"翻译选中内容"
- [ ] 首次使用显示API Key配置引导
- [ ] 整页翻译正常工作，显示双语对照
- [ ] 选中翻译正常工作，弹窗显示结果
- [ ] Popup可快速切换语言和模型
- [ ] Options页可完整配置所有设置
- [ ] API Key验证功能正常
- [ ] 缓存功能正常
- [ ] 智能过滤跳过代码块等元素
