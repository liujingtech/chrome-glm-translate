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
      showStatus(statusEl, 'API Key有效', 'success');
    } else {
      const data = await response.json().catch(() => ({}));
      showStatus(statusEl, data.error?.message || 'API Key无效', 'error');
    }
  } catch (error) {
    showStatus(statusEl, '验证失败: ' + error.message, 'error');
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
      showStatus(statusEl, '设置已保存', 'success');
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
