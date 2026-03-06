// options/options.js

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

const MODELS = [
  { value: 'GLM-3-Turbo', name: 'GLM-3-Turbo', maxConcurrency: 50 },
  { value: 'GLM-4-FLASH', name: 'GLM-4-Flash', maxConcurrency: 50 },
  { value: 'GLM-4-AIR', name: 'GLM-4-Air', maxConcurrency: 100 },
  { value: 'GLM-4', name: 'GLM-4', maxConcurrency: 30 }
];

const DEFAULT_SETTINGS = {
  apiKey: '',
  targetLang: 'zh-CN',
  model: 'GLM-3-Turbo',
  filterNodes: true
};
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  initLanguageSelect();
  initModelSelect();
  bindEvents();
  // 监听存储变化，实时同步
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.targetLang !== undefined || changes.model !== undefined) {
        loadSettings();
        initLanguageSelect();
        initModelSelect();
      }
    }
  });
});
async function loadSettings() {
  return new Promise(resolve => {
    chrome.storage.local.get(['apiKey', 'targetLang', 'model', 'filterNodes'], (result) => {
      document.getElementById('apiKey').value = result.apiKey || '';
      document.getElementById('targetLang').value = result.targetLang || 'zh-CN';
      document.getElementById('model').value = result.model || 'GLM-3-Turbo';
      document.getElementById('filterNodes').checked = result.filterNodes !== false;
      resolve();
    });
  });
}
function initLanguageSelect() {
  const select = document.getElementById('targetLang');
  const currentValue = select.value;
  select.innerHTML = '';
  LANGUAGES.forEach(lang => {
    const option = document.createElement('option');
    option.value = lang.code;
    option.textContent = lang.name;
    if (lang.code === currentValue) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}
function initModelSelect() {
  const select = document.getElementById('model');
  const currentValue = select.value;
  select.innerHTML = '';
  MODELS.forEach(model => {
    const option = document.createElement('option');
    option.value = model.value;
    option.textContent = `${model.name} (并发: ${model.maxConcurrency})`;
    if (model.value === currentValue) {
      option.selected = true;
    }
    select.appendChild(option);
  });
  // 监听模型变化，更新并发数显示
  select.addEventListener('change', () => {
    updateModelConcurrency(select.value);
  });
  // 初始化显示
  updateModelConcurrency(select.value);
}
function updateModelConcurrency(modelValue) {
  const model = MODELS.find(m => m.value === modelValue);
  const el = document.getElementById('modelConcurrency');
  if (model && el) {
    el.textContent = `最大并发: ${model.maxConcurrency}`;
  }
}
function bindEvents() {
  document.getElementById('verifyApiKey').addEventListener('click', verifyApiKey);
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
  document.getElementById('openShortcuts').addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  });
  document.getElementById('clearCache').addEventListener('click', clearCache);
  document.getElementById('resetSettings').addEventListener('click', resetSettings);
}
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
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'glm-3-turbo', messages: [{ role: 'user', content: 'Hi' }], max_tokens: 1 })
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
async function saveSettings() {
  const settings = {
    apiKey: document.getElementById('apiKey').value.trim(),
    targetLang: document.getElementById('targetLang').value,
    model: document.getElementById('model').value,
    filterNodes: document.getElementById('filterNodes').checked
  };
  const statusEl = document.getElementById('saveStatus');
  return new Promise(resolve => {
    chrome.storage.local.set(settings, () => {
      showStatus(statusEl, '设置已保存', 'success');
      setTimeout(() => { statusEl.textContent = ''; }, 2000);
      resolve();
    });
  });
}
async function clearCache() {
  if (!confirm('确定要清除所有翻译缓存吗?')) return;
  return new Promise(resolve => {
    chrome.storage.local.set({ cache: {} }, () => {
      alert('缓存已清除');
      resolve();
    });
  });
}
async function resetSettings() {
  if (!confirm('确定要重置所有设置吗？')) return;
  return new Promise(resolve => {
    chrome.storage.local.set({ ...DEFAULT_SETTINGS, cache: {} }, () => {
      location.reload();
      resolve();
    });
  });
}
function showStatus(element, message, type) {
  element.textContent = message;
  element.className = `status-message ${type}`;
}
