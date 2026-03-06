// utils/constants.js
if (typeof window.__ZHIPU_CONSTANTS_LOADED__ === 'undefined') {
window.__ZHIPU_CONSTANTS_LOADED__ = true;

window.MODELS = {
  'GLM-3-Turbo': { api: 'glm-3-turbo', maxConcurrency: 50 },
  'GLM-4-FLASH': { api: 'glm-4-flash', maxConcurrency: 50 },
  'GLM-4-AIR': { api: 'glm-4-air', maxConcurrency: 100 },
  'GLM-4': { api: 'glm-4', maxConcurrency: 30 }
};

window.MODEL_NAMES = Object.keys(window.MODELS);

window.LANGUAGES = [
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

window.LANGUAGE_MAP = {
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

// 默认设置
window.DEFAULT_SETTINGS = {
  apiKey: '',
  targetLang: 'zh-CN',
  model: 'GLM-3-Turbo',
  filterNodes: true
};

window.SKIP_TAGS = ['SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA', 'NOSCRIPT', 'SVG', 'SELECT', 'BUTTON', 'IFRAME'];

window.getModelIndex = function(name) {
  return window.MODELS[name]?.api || 'glm-3-turbo';
};

window.getLanguageName = function(code) {
  return window.LANGUAGE_MAP[code] || code;
};

} // end if
