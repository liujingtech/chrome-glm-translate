// utils/constants.js

// 智谱API模型映射
const MODELS = {
  'GLM-4': 'glm-4',
  'GLM-4-AIR': 'glm-4-air',
  'GLM-4-FLASH': 'glm-4-flash'
};

// 模型显示名称列表
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

// 语言代码到名称的映射
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
  model: 'GLM-4-FLASH'
};

// 智能过滤跳过的标签
const SKIP_TAGS = ['SCRIPT', 'STYLE', 'CODE', 'PRE', 'INPUT', 'TEXTAREA', 'NOSCRIPT', 'KBD', 'SAMP', 'SVG'];

// 智谱API端点
const API_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

// 消息类型常量
const MESSAGE_TYPES = {
  TRANSLATE_PAGE: 'TRANSLATE_PAGE',
  TRANSLATE_SELECTION: 'TRANSLATE_SELECTION',
  TRANSLATE_RESULT: 'TRANSLATE_RESULT',
  SELECTION_TRANSLATION_RESULT: 'SELECTION_TRANSLATION_RESULT',
  REQUEST_TRANSLATION: 'REQUEST_TRANSLATION',
  REQUEST_SELECTION_TRANSLATION: 'REQUEST_SELECTION_TRANSLATION',
  GET_SETTINGS: 'GET_SETTINGS',
  SAVE_SETTINGS: 'SAVE_SETTINGS',
  SAVE_API_KEY: 'SAVE_API_KEY',
  CHECK_API_KEY: 'CHECK_API_KEY',
  CLEAR_CACHE: 'CLEAR_CACHE',
  SHOW_API_GUIDE: 'SHOW_API_GUIDE',
  REMOVE_TRANSLATIONS: 'REMOVE_TRANSLATIONS'
};

// 获取模型API索引
function getModelIndex(modelName) {
  return MODELS[modelName] || 'glm-4-flash';
}

// 获取语言名称
function getLanguageName(code) {
  return LANGUAGE_MAP[code] || code;
}
