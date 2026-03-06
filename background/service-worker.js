// background/service-worker.js

// ==================== 缓存系统 ====================

const CACHE_CONFIG = {
  TTL: 7 * 24 * 60 * 60 * 1000,  // 7 天（毫秒）
  MAX_ENTRIES: 5000,              // 最大条目数
  CLEANUP_RATIO: 0.2              // 超限时清理 20% 最旧条目
};

// 生成文本缓存 key（基于原文 + 目标语言）
function generateTextCacheKey(text, targetLang) {
  const str = `${text}:${targetLang}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `t_${Math.abs(hash)}`;
}

// 获取文本翻译缓存
async function getTextCache(text, targetLang) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['cache'], (result) => {
      const cache = result.cache || {};
      const key = generateTextCacheKey(text, targetLang);
      const entry = cache[key];

      if (!entry) {
        resolve(null);
        return;
      }

      // 检查是否过期
      if (Date.now() - entry.timestamp > CACHE_CONFIG.TTL) {
        delete cache[key];
        chrome.storage.local.set({ cache }, () => {});
        resolve(null);
        return;
      }

      resolve(entry.translated);
    });
  });
}

// 设置文本翻译缓存
async function setTextCache(text, translated, targetLang) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['cache'], (result) => {
      const cache = result.cache || {};
      const key = generateTextCacheKey(text, targetLang);

      cache[key] = {
        original: text,
        translated: translated,
        targetLang: targetLang,
        timestamp: Date.now()
      };

      chrome.storage.local.set({ cache }, async () => {
        // 检查是否需要清理
        await maybeCleanupCache(cache);
        resolve();
      });
    });
  });
}

// 检查并清理缓存
async function maybeCleanupCache(cache) {
  const entries = Object.entries(cache);

  if (entries.length > CACHE_CONFIG.MAX_ENTRIES) {
    console.log(`缓存超限 (${entries.length}/${CACHE_CONFIG.MAX_ENTRIES})，开始清理...`);

    // 按时间排序，删除最旧的 20%
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toDelete = Math.floor(entries.length * CACHE_CONFIG.CLEANUP_RATIO);

    for (let i = 0; i < toDelete; i++) {
      delete cache[entries[i][0]];
    }

    await chrome.storage.local.set({ cache });
    console.log(`缓存清理完成，删除了 ${toDelete} 条`);
  }
}

// ==================== 原有代码 ====================

const LANGUAGE_MAP = {
  'zh-CN': '简体中文', 'zh-TW': '繁体中文', 'en': '英语',
  'ja': '日语', 'ko': '韩语', 'fr': '法语',
  'de': '德语', 'es': '西班牙语', 'ru': '俄语'
};

const MODELS = { 'GLM-3-Turbo': 'glm-3-turbo', 'GLM-4': 'glm-4', 'GLM-4-AIR': 'glm-4-air', 'GLM-4-FLASH': 'glm-4-flash' };

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'translatePage', title: '翻译整页', contexts: ['page'] });
  chrome.contextMenus.create({ id: 'translateSelection', title: '翻译选中内容', contexts: ['selection'] });
  console.log('智谱翻译插件已安装');
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (tab.url.startsWith('chrome://')) return;
  if (!await checkApiKey()) { sendMsg(tab.id, { type: 'SHOW_API_GUIDE' }); return; }
  if (info.menuItemId === 'translatePage') sendMsg(tab.id, { type: 'TRANSLATE_PAGE' });
  if (info.menuItemId === 'translateSelection') sendMsg(tab.id, { type: 'TRANSLATE_SELECTION' });
});

chrome.runtime.onMessage.addListener((msg, sender, sendRes) => {
  handleMsg(msg, sender, sendRes);
  return true;
});

async function handleMsg(msg, sender, sendRes) {
  try {
    if (msg.type === 'REQUEST_TRANSLATION') {
      sendRes({ success: true });
      await translatePageParallel(msg.data, sender.tab.id);
    } else if (msg.type === 'REQUEST_SELECTION_TRANSLATION') {
      sendRes({ success: true });
      await translateSelection(msg.data, sender.tab.id);
    } else if (msg.type === 'SAVE_API_KEY') {
      if (await validateApiKey(msg.data.apiKey)) {
        await saveSettings({ apiKey: msg.data.apiKey });
        sendRes({ success: true });
      } else { sendRes({ success: false, error: 'API Key无效' }); }
    } else if (msg.type === 'GET_SETTINGS') {
      sendRes({ success: true, data: await getSettings() });
    } else if (msg.type === 'SAVE_SETTINGS') {
      await saveSettings(msg.data);
      sendRes({ success: true });
    } else if (msg.type === 'CLEAR_CACHE') {
      await clearCache();
      sendRes({ success: true });
    } else { sendRes({ success: false }); }
  } catch (e) {
    console.error('处理失败:', e);
    sendRes({ success: false, error: e.message });
  }
}

// 并行翻译页面（带并发限制）
async function translatePageParallel(data, tabId) {
  const settings = await getSettings();
  const texts = data.texts;
  const total = texts.length;
  const batchSize = 20;
  const maxConcurrency = settings.maxConcurrency || 5;
  const batches = [];

  // 分批
  for (let i = 0; i < texts.length; i += batchSize) {
    batches.push({ startIndex: i, texts: texts.slice(i, i + batchSize) });
  }

  console.log(`并行翻译: ${total}个文本, ${batches.length}个批次, 并发数: ${maxConcurrency}`);

  // 使用并发控制的并行翻译
  let running = 0;
  let index = 0;
  let hasError = false;

  return new Promise((resolve) => {
    function runNext() {
      while (running < maxConcurrency && index < batches.length) {
        const batchIndex = index++;
        const batch = batches[batchIndex];
        running++;

        (async () => {
          try {
            const SEP = `<<S${batchIndex}E>>`;
            const joined = batch.texts.join('\n' + SEP + '\n');
            const translated = await translate(joined, settings, SEP);
            const parts = translated.split(SEP);
            const translations = parts.map(p => p.trim());

            sendMsg(tabId, {
              type: 'PARTIAL_TRANSLATION_RESULT',
              data: {
                success: true,
                startIndex: batch.startIndex,
                translations: translations,
                progress: { done: batch.startIndex + translations.length, total: total }
              }
            });
          } catch (e) {
            console.error(`批次${batchIndex}失败:`, e);
            sendMsg(tabId, {
              type: 'PARTIAL_TRANSLATION_RESULT',
              data: { success: false, startIndex: batch.startIndex, translations: batch.texts, error: e.message }
            });
          } finally {
            running--;
            if (index < batches.length) {
              runNext();
            } else if (running === 0) {
              sendMsg(tabId, { type: 'TRANSLATION_COMPLETE' });
              console.log('并行翻译完成');
              resolve();
            }
          }
        })();
      }
    }

    runNext();
  });
}

async function translateSelection(data, tabId) {
  const settings = await getSettings();
  const translated = await translate(data.text, settings, null);
  sendMsg(tabId, { type: 'SELECTION_TRANSLATION_RESULT', data: { success: true, translated, rect: data.rect } });
}

async function translate(text, settings, separator) {
  const lang = LANGUAGE_MAP[settings.targetLang] || settings.targetLang;
  const model = MODELS[settings.model] || 'glm-3-turbo';

  let prompt;
  if (separator) {
    prompt = `翻译成${lang}，只返回结果。段落间用"${separator}"分隔，保持分隔符不变：

${text}`;
  } else {
    prompt = `翻译成${lang}，只返回结果：

${text}`;
  }

  const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.apiKey}` },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'API失败');
  }
  const data = await res.json();
  return data.choices[0]?.message?.content || text;
}

async function sendMsg(tabId, msg) {
  try {
    await chrome.tabs.sendMessage(tabId, msg);
  } catch (e) {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['utils/constants.js', 'content/extractor.js', 'content/renderer.js', 'content/content.js'] });
      await chrome.scripting.insertCSS({ target: { tabId }, files: ['content/content.css'] });
      await chrome.tabs.sendMessage(tabId, msg);
    } catch (err) { console.error('发送失败:', err); }
  }
}

async function checkApiKey() { const s = await getSettings(); return !!s.apiKey; }

async function getSettings() {
  return new Promise(r => chrome.storage.local.get(['apiKey', 'targetLang', 'model', 'maxConcurrency', 'filterNodes'], res => r({
    apiKey: res.apiKey || '',
    targetLang: res.targetLang || 'zh-CN',
    model: res.model || 'GLM-3-Turbo',
    maxConcurrency: res.maxConcurrency || 5,
    filterNodes: res.filterNodes !== false
  })));
}

async function saveSettings(s) { return new Promise(r => chrome.storage.local.set(s, r)); }

async function clearCache() { return new Promise(r => chrome.storage.local.set({ cache: {} }, r)); }

async function validateApiKey(key) {
  try {
    const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'glm-4-flash', messages: [{ role: 'user', content: 'Hi' }], max_tokens: 1 })
    });
    return res.ok;
  } catch { return false; }
}
