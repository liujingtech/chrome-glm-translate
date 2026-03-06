// utils/constants.js

const MODELS = {
  'GLM-3-Turbo': 'glm-3-turbo',
  'GLM-4': 'glm-4',
  'GLM-4-AIR': 'glm-4-air',
  'GLM-4-FLASH': 'glm-4-flash'
};

const MODEL_NAMES = Object.keys(MODELS);

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

const LANGUAGE_MAP = {
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
const DEFAULT_SETTINGS = {
  apiKey: '',
  targetLang: 'zh-CN',
  model: 'GLM-3-Turbo',
  filterNodes: true,
  maxConcurrency: 5
};

const SKIP_TAGS = ['SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA', 'NOSCRIPT', 'SVG', 'SELECT', 'BUTTON', 'IFRAME'];

function getModelIndex(name) {
  return MODELS[name] || 'glm-3-turbo';
}

function getLanguageName(code) {
  return LANGUAGE_MAP[code] || code;
}
