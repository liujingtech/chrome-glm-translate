// background/service-worker.js

const LANGUAGE_MAP = {
  'zh-CN': '简体中文', 'zh-TW': '繁体中文', 'en': '英语',
  'ja': '日语', 'ko': '韩语', 'fr': '法语',
  'de': '德语', 'es': '西班牙语', 'ru': '俄语'
};

const MODELS = { 'GLM-4': 'glm-4', 'GLM-4-AIR': 'glm-4-air', 'GLM-4-FLASH': 'glm-4-flash' };

// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'translatePage', title: '翻译整页', contexts: ['page'] });
  chrome.contextMenus.create({ id: 'translateSelection', title: '翻译选中内容', contexts: ['selection'] });
  console.log('智谱翻译插件已安装');
});

// 右键菜单点击
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (tab.url.startsWith('chrome://')) return;
  if (!await checkApiKey()) { sendMsg(tab.id, { type: 'SHOW_API_GUIDE' }); return; }
  if (info.menuItemId === 'translatePage') sendMsg(tab.id, { type: 'TRANSLATE_PAGE' });
  if (info.menuItemId === 'translateSelection') sendMsg(tab.id, { type: 'TRANSLATE_SELECTION' });
});

// 消息监听
chrome.runtime.onMessage.addListener((msg, sender, sendRes) => {
  handleMsg(msg, sender, sendRes);
  return true;
});

async function handleMsg(msg, sender, sendRes) {
  try {
    if (msg.type === 'REQUEST_TRANSLATION') {
      await translatePage(msg.data, sender.tab.id);
      sendRes({ success: true });
    } else if (msg.type === 'REQUEST_SELECTION_TRANSLATION') {
      await translateSelection(msg.data, sender.tab.id);
      sendRes({ success: true });
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
    console.error(e);
    sendRes({ success: false, error: e.message });
  }
}

async function translatePage(data, tabId) {
  const settings = await getSettings();
  const texts = data.texts;
  const translations = [];
  const batchSize = 30;

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const joined = batch.join('\n###SEP###\n');
    const translated = await translate(joined, settings);
    const parts = translated.split('###SEP###');
    translations.push(...parts.map(p => p.trim()));
  }

  sendMsg(tabId, { type: 'TRANSLATE_RESULT', data: { success: true, translations } });
}

async function translateSelection(data, tabId) {
  const settings = await getSettings();
  const translated = await translate(data.text, settings);
  sendMsg(tabId, { type: 'SELECTION_TRANSLATION_RESULT', data: { success: true, translated, rect: data.rect } });
}

async function translate(text, settings) {
  const lang = LANGUAGE_MAP[settings.targetLang] || settings.targetLang;
  const model = MODELS[settings.model] || 'glm-4-flash';

  const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.apiKey}` },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: `翻译成${lang}，只返回结果，保持###SEP###：\n${text}` }]
    })
  });

  if (!res.ok) throw new Error('API失败');
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
    } catch (err) { console.error(err); }
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
