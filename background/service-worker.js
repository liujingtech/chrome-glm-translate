// background/service-worker.js

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

// 模型映射
const MODELS = {
  'GLM-4': 'glm-4',
  'GLM-4-AIR': 'glm-4-air',
  'GLM-4-FLASH': 'glm-4-flash'
};

// 插件安装时创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  // 翻译整页
  chrome.contextMenus.create({
    id: 'translatePage',
    title: '翻译整页',
    contexts: ['page']
  });

  // 翻译选中内容
  chrome.contextMenus.create({
    id: 'translateSelection',
    title: '翻译选中内容',
    contexts: ['selection']
  });

  console.log('智谱翻译插件已安装');
});

// 安全发送消息到tab
async function safeSendMessage(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    console.log('消息发送失败，尝试注入content script...');
    // 尝试注入content script后重试
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: [
          'utils/constants.js',
          'content/extractor.js',
          'content/renderer.js',
          'content/content.js'
        ]
      });
      // 注入CSS
      await chrome.scripting.insertCSS({
        target: { tabId: tabId },
        files: ['content/content.css']
      });
      // 重试发送消息
      await chrome.tabs.sendMessage(tabId, message);
    } catch (injectError) {
      console.error('注入content script失败:', injectError);
      // 显示通知
      chrome.notifications?.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: '智谱翻译',
        message: '此页面不支持翻译，请刷新页面后重试'
      });
    }
  }
}

// 右键菜单点击事件
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  // 检查是否是特殊页面
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    console.log('Chrome内部页面不支持content script');
    return;
  }

  // 检查API Key
  const hasKey = await checkApiKey();

  if (!hasKey) {
    // 显示API Key引导
    safeSendMessage(tab.id, { type: 'SHOW_API_GUIDE' });
    return;
  }

  switch (info.menuItemId) {
    case 'translatePage':
      await handleTranslatePage(tab);
      break;
    case 'translateSelection':
      await handleTranslateSelection(tab, info.selectionText, tab);
      break;
  }
});

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true;
});

// 处理消息
async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.type) {
      case 'REQUEST_TRANSLATION':
        await processPageTranslation(message.data, sender.tab.id);
        sendResponse({ success: true });
        break;

      case 'REQUEST_SELECTION_TRANSLATION':
        await processSelectionTranslation(message.data, sender.tab.id);
        sendResponse({ success: true });
        break;

      case 'SAVE_API_KEY':
        const isValid = await validateApiKey(message.data.apiKey);
        if (isValid) {
          await saveSettings({ apiKey: message.data.apiKey });
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'API Key无效' });
        }
        break;

      case 'GET_SETTINGS':
        const settings = await getSettings();
        sendResponse({ success: true, data: settings });
        break;

      case 'SAVE_SETTINGS':
        await saveSettings(message.data);
        sendResponse({ success: true });
        break;

      case 'CLEAR_CACHE':
        await clearCache();
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('Background处理消息失败:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// 处理整页翻译
async function handleTranslatePage(tab) {
  safeSendMessage(tab.id, { type: 'TRANSLATE_PAGE' });
}

// 处理选中翻译
async function handleTranslateSelection(tab, selectedText) {
  safeSendMessage(tab.id, {
    type: 'TRANSLATE_SELECTION',
    data: { text: selectedText }
  });
}

// 处理页面翻译请求
async function processPageTranslation(data, tabId) {
  const settings = await getSettings();
  const { groups, url, nodeCount } = data;
  const allTranslations = [];

  for (const group of groups) {
    // 合并一组文本
    const combinedText = group.join('\n---SEPARATOR---\n');

    // 检查缓存
    const cacheKey = generateCacheKey(url, combinedText);
    const cached = await getCache(cacheKey);

    let translatedText;
    if (cached) {
      translatedText = cached.translated;
    } else {
      // 调用API翻译
      try {
        translatedText = await translateText(
          combinedText,
          settings.targetLang,
          settings.model,
          settings.apiKey
        );

        // 保存缓存
        await setCache(cacheKey, {
          original: combinedText,
          translated: translatedText
        });
      } catch (error) {
        safeSendMessage(tabId, {
          type: 'TRANSLATE_RESULT',
          data: { success: false, error: error.message }
        });
        return;
      }
    }

    // 分割翻译结果
    const translations = translatedText.split('\n---SEPARATOR---\n');
    allTranslations.push(...translations);
  }

  // 发送翻译结果到content script
  safeSendMessage(tabId, {
    type: 'TRANSLATE_RESULT',
    data: { success: true, translations: allTranslations }
  });
}

// 处理选中翻译请求
async function processSelectionTranslation(data, tabId) {
  const settings = await getSettings();
  const { text, rect } = data;

  try {
    const translated = await translateText(
      text,
      settings.targetLang,
      settings.model,
      settings.apiKey
    );

    safeSendMessage(tabId, {
      type: 'SELECTION_TRANSLATION_RESULT',
      data: { success: true, translated, rect }
    });
  } catch (error) {
    safeSendMessage(tabId, {
      type: 'SELECTION_TRANSLATION_RESULT',
      data: { success: false, error: error.message, rect }
    });
  }
}

// 检查API Key是否存在
async function checkApiKey() {
  const settings = await getSettings();
  return !!settings.apiKey && settings.apiKey.trim().length > 0;
}

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

// 清除缓存
async function clearCache() {
  return new Promise((resolve) => {
    chrome.storage.local.set({ cache: {} }, resolve);
  });
}

// 生成缓存key
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

// 验证API Key
async function validateApiKey(apiKey) {
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
    return response.ok;
  } catch (error) {
    return false;
  }
}

// 翻译文本
async function translateText(text, targetLang, model, apiKey) {
  const languageName = LANGUAGE_MAP[targetLang] || targetLang;
  const modelIndex = MODELS[model] || 'glm-4-flash';

  const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelIndex,
      messages: [{
        role: 'user',
        content: `请将以下内容翻译成${languageName}。要求：
1. 只返回翻译结果，不要有任何解释或额外说明
2. 保持原文的格式和换行
3. 如果原文已经是${languageName}，请原样返回
4. 如果有多段内容用---SEPARATOR---分隔，翻译后保持相同的分隔符

原文：
${text}`
      }]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API请求失败: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}
