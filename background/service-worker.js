// background/service-worker.js

const LANGUAGE_MAP = {
  'zh-CN': '简体中文', 'zh-TW': '繁体中文', 'en': '英语',
  'ja': '日语', 'ko': '韩语', 'fr': '法语',
  'de': '德语', 'es': '西班牙语', 'ru': '俄语'
};

const MODELS = { 'GLM-4': 'glm-4', 'GLM-4-AIR': 'glm-4-air', 'GLM-4-FLASH': 'glm-4-flash' };

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
      // 立即响应，后台继续翻译
      sendRes({ success: true });
      await translatePage(msg.data, sender.tab.id);
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
    } else {
      sendRes({ success: false });
    }
  } catch (e) {
    console.error('处理失败:', e);
    sendRes({ success: false, error: e.message });
  }
}

// 翻译页面 - 流式渲染
async function translatePage(data, tabId) {
  const settings = await getSettings();
  const texts = data.texts;
  const batchSize = 15; // 减小批次，更快响应
  const totalBatches = Math.ceil(texts.length / batchSize);
  let translatedCount = 0;

  console.log('开始翻译, 总数:', texts.length, '批次:', totalBatches);

  for (let i = 0; i < texts.length; i += batchSize) {
    const batchNum = Math.floor(i / batchSize) + 1;
    const batch = texts.slice(i, i + batchSize);

    try {
      const SEP = `<<<T${Date.now()}P>>>`;
      const joined = batch.join('\n' + SEP + '\n');
      const translated = await translate(joined, settings, SEP);
      const parts = translated.split(SEP);
      const translations = parts.map(p => p.trim());

      translatedCount += translations.length;

      // 立即发送这批结果，content script 会立即渲染
      sendMsg(tabId, {
        type: 'PARTIAL_TRANSLATION_RESULT',
        data: {
          success: true,
          startIndex: i,
          translations: translations,
          progress: { current: batchNum, total: totalBatches, done: translatedCount, total: texts.length }
        }
      });

      console.log(`批次 ${batchNum}/${totalBatches} 完成, 已翻译: ${translatedCount}/${texts.length}`);
    } catch (e) {
      console.error(`批次 ${batchNum} 失败:`, e);
      // 失败时发送原文
      sendMsg(tabId, {
        type: 'PARTIAL_TRANSLATION_RESULT',
        data: {
          success: false,
          startIndex: i,
          translations: batch,
          error: e.message
        }
      });
    }
  }

  // 全部完成
  sendMsg(tabId, { type: 'TRANSLATION_COMPLETE' });
  console.log('翻译全部完成');
}

async function translateSelection(data, tabId) {
  const settings = await getSettings();
  const translated = await translate(data.text, settings, null);
  sendMsg(tabId, { type: 'SELECTION_TRANSLATION_RESULT', data: { success: true, translated, rect: data.rect } });
}

async function translate(text, settings, separator) {
  const lang = LANGUAGE_MAP[settings.targetLang] || settings.targetLang;
  const model = MODELS[settings.model] || 'glm-4-flash';

  let prompt;
  if (separator) {
    prompt = `翻译成${lang}，只返回翻译结果。
段落间用"${separator}"分隔，必须保留这个分隔符，不要删除。

${text}`;
  } else {
    prompt = `翻译成${lang}，只返回翻译结果：\n${text}`;
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
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'API请求失败');
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

async function checkApiKey() {
  const s = await getSettings();
  return !!s.apiKey;
}

async function getSettings() {
  return new Promise(r => chrome.storage.local.get(['apiKey', 'targetLang', 'model'], res => r({ apiKey: res.apiKey || '', targetLang: res.targetLang || 'zh-CN', model: res.model || 'GLM-4-FLASH' })));
}

async function saveSettings(s) {
  return new Promise(r => chrome.storage.local.set(s, r));
}

async function clearCache() {
  return new Promise(r => chrome.storage.local.set({ cache: {} }, r));
}

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
