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
const MODELS = ['GLM-3-Turbo', 'GLM-4-FLASH', 'GLM-4-AIR', 'GLM-4'];

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  initLanguageSelect();
  initModelSelect();
  bindEvents();
  // 监听存储变化，实时同步
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.targetLang !== undefined) {
        window.currentSettings.targetLang = changes.targetLang.newValue;
        initLanguageSelect();
      }
      if (changes.model !== undefined) {
        window.currentSettings.model = changes.model.newValue;
        initModelSelect();
      }
    }
  });
});

// 加载设置
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['targetLang', 'model'], (result) => {
      window.currentSettings = {
        targetLang: result.targetLang || 'zh-CN',
        model: result.model || 'GLM-3-Turbo'
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
