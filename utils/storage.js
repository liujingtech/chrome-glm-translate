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
  let hash = 0;
  const str = url + content;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `cache_${Math.abs(hash)}`;
}
