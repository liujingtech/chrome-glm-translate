# 文本缓存功能实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为智谱翻译插件添加单条文本级别的翻译缓存，节省 API 调用并提升翻译速度。

**Architecture:** 在 `storage.js` 中新增缓存函数，在 `service-worker.js` 的翻译流程中查询和写入缓存。缓存基于原文+目标语言生成 key，存储在 chrome.storage.local 中，支持 TTL 过期和条目上限清理。

**Tech Stack:** Chrome Extension Manifest V3, chrome.storage.local API

---

### Task 1: 更新 storage.js 缓存函数

**Files:**
- Modify: `utils/storage.js`

**Step 1: 添加缓存配置常量和 key 生成函数**

在文件开头添加：

```javascript
// 缓存配置
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
```

**Step 2: 添加获取单条文本缓存的函数**

```javascript
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
```

**Step 3: 添加设置文本缓存的函数**

```javascript
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
```

**Step 4: 添加缓存清理函数**

```javascript
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
```

**Step 5: 更新 clearCache 函数（保持兼容）**

现有的 `clearCache` 函数已经可以工作，无需修改。

**Step 6: 删除旧的 generateCacheKey 函数**

删除旧的 `generateCacheKey(url, content)` 函数，因为它不再使用。

**Step 7: 验证修改**

手动检查语法是否正确，确保函数导出或可在 content script 中使用。

---

### Task 2: 修改 service-worker.js 添加整页翻译缓存

**Files:**
- Modify: `background/service-worker.js`

**Step 1: 在 translatePageParallel 中添加缓存查询逻辑**

找到 `translatePageParallel` 函数，在 `const texts = data.texts;` 之后添加缓存查询：

```javascript
async function translatePageParallel(data, tabId) {
  const settings = await getSettings();
  const texts = data.texts;
  const total = texts.length;
  const targetLang = settings.targetLang;

  // 查询缓存，分离已缓存和未缓存的文本
  const cachedResults = new Map();  // index -> translated text
  const uncachedItems = [];         // { index, text }

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    const cached = await getTextCache(text, targetLang);
    if (cached !== null) {
      cachedResults.set(i, cached);
    } else {
      uncachedItems.push({ index: i, text: text });
    }
  }

  console.log(`缓存命中: ${cachedResults.size}/${total}, 需翻译: ${uncachedItems.length}`);

  // 如果全部命中缓存，直接返回结果
  if (uncachedItems.length === 0) {
    const translations = texts.map((_, i) => cachedResults.get(i));
    sendMsg(tabId, {
      type: 'PARTIAL_TRANSLATION_RESULT',
      data: {
        success: true,
        startIndex: 0,
        translations: translations,
        progress: { done: total, total: total }
      }
    });
    sendMsg(tabId, { type: 'TRANSLATION_COMPLETE' });
    console.log('全部命中缓存，翻译完成');
    return;
  }

  // ... 继续现有的批次翻译逻辑，但使用 uncachedItems
```

**Step 2: 修改批次处理逻辑使用 uncachedItems**

将现有的批次逻辑改为处理 `uncachedItems`，同时保持原有的 `startIndex` 映射：

```javascript
  const batchSize = 20;
  const maxConcurrency = settings.maxConcurrency || 5;
  const batches = [];

  // 分批（基于未缓存的文本）
  for (let i = 0; i < uncachedItems.length; i += batchSize) {
    const batchItems = uncachedItems.slice(i, i + batchSize);
    batches.push({
      startBatchIndex: i,
      items: batchItems  // [{index, text}, ...]
    });
  }

  console.log(`并行翻译: ${uncachedItems.length}个未缓存文本, ${batches.length}个批次, 并发数: ${maxConcurrency}`);
```

**Step 3: 修改翻译完成后的缓存存储和结果合并**

```javascript
        (async () => {
          try {
            const SEP = `<<S${batchIndex}E>>`;
            const batchTexts = batch.items.map(item => item.text);
            const joined = batchTexts.join('\n' + SEP + '\n');
            const translated = await translate(joined, settings, SEP);
            const parts = translated.split(SEP);
            const translations = parts.map(p => p.trim());

            // 存入缓存并合并到 cachedResults
            for (let j = 0; j < batch.items.length; j++) {
              const originalIndex = batch.items[j].index;
              const originalText = batch.items[j].text;
              const translatedText = translations[j];

              await setTextCache(originalText, translatedText, targetLang);
              cachedResults.set(originalIndex, translatedText);
            }

            // 按原顺序构建结果数组
            const allTranslations = texts.map((text, idx) => {
              if (cachedResults.has(idx)) {
                return cachedResults.get(idx);
              }
              return text;  // fallback 到原文
            });

            sendMsg(tabId, {
              type: 'PARTIAL_TRANSLATION_RESULT',
              data: {
                success: true,
                startIndex: 0,
                translations: allTranslations,
                progress: { done: batch.startBatchIndex + translations.length, total: uncachedItems.length }
              }
            });
```

**Step 4: 修改完成判断逻辑**

```javascript
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
```

---

### Task 3: 修改 service-worker.js 添加划词翻译缓存

**Files:**
- Modify: `background/service-worker.js`

**Step 1: 修改 translateSelection 函数**

```javascript
async function translateSelection(data, tabId) {
  const settings = await getSettings();
  const targetLang = settings.targetLang;

  // 先查缓存
  const cached = await getTextCache(data.text, targetLang);
  if (cached !== null) {
    console.log('划词翻译命中缓存');
    sendMsg(tabId, {
      type: 'SELECTION_TRANSLATION_RESULT',
      data: { success: true, translated: cached, rect: data.rect }
    });
    return;
  }

  // 未命中则调用 API
  const translated = await translate(data.text, settings, null);

  // 存入缓存
  await setTextCache(data.text, translated, targetLang);

  sendMsg(tabId, {
    type: 'SELECTION_TRANSLATION_RESULT',
    data: { success: true, translated, rect: data.rect }
  });
}
```

---

### Task 4: 更新 manifest.json 确保 storage.js 加载顺序

**Files:**
- Check: `manifest.json`

**Step 1: 检查 manifest.json**

确认 `utils/storage.js` 在 background service_worker 中可用。由于 Chrome Manifest V3 的 service worker 是单文件，需要检查 service-worker.js 是否能访问 storage.js 中的函数。

查看 manifest.json 的配置：

```json
{
  "background": {
    "service_worker": "background/service-worker.js"
  }
}
```

**Step 2: 确认方案**

由于 service worker 是单文件，有两个选择：
- A. 将缓存函数直接写在 service-worker.js 中
- B. 使用 ES modules（需要改 manifest）

选择 **A**（更简单）：将缓存函数添加到 service-worker.js 顶部，而不是 storage.js。

---

### Task 5: 整合缓存函数到 service-worker.js

**Files:**
- Modify: `background/service-worker.js`

**Step 1: 在 service-worker.js 顶部添加缓存函数**

将 Task 1 中的缓存函数添加到 `background/service-worker.js` 文件顶部（在现有代码之前）：

```javascript
// ==================== 缓存系统 ====================

const CACHE_CONFIG = {
  TTL: 7 * 24 * 60 * 60 * 1000,
  MAX_ENTRIES: 5000,
  CLEANUP_RATIO: 0.2
};

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
        await maybeCleanupCache(cache);
        resolve();
      });
    });
  });
}

async function maybeCleanupCache(cache) {
  const entries = Object.entries(cache);

  if (entries.length > CACHE_CONFIG.MAX_ENTRIES) {
    console.log(`缓存超限 (${entries.length}/${CACHE_CONFIG.MAX_ENTRIES})，开始清理...`);
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
```

---

### Task 6: 手动测试

**Step 1: 重新加载扩展**

1. 打开 `chrome://extensions/`
2. 找到智谱翻译插件
3. 点击刷新按钮

**Step 2: 测试整页翻译**

1. 打开一个英文网页（如 BBC 新闻）
2. 右键 → 翻译整页
3. 查看控制台日志，应该看到 "缓存命中: 0/N"
4. 再次右键 → 翻译整页
5. 应该看到 "缓存命中: N/N, 需翻译: 0" 或部分命中

**Step 3: 测试划词翻译**

1. 选中一段英文
2. 右键 → 翻译选中内容
3. 再次选中同一段
4. 右键 → 翻译选中内容
5. 第二次应该从缓存读取

**Step 4: 测试缓存清理**

1. 打开 chrome://extensions/
2. 点击插件的 "Service Worker" 链接查看控制台
3. 翻译多个页面
4. 观察缓存存储和清理日志

---

### Task 7: 提交代码

```bash
git add utils/storage.js background/service-worker.js docs/plans/2026-03-06-text-cache-design.md docs/plans/2026-03-06-text-cache-impl.md
git commit -m "feat: 添加单条文本级别的翻译缓存

- 基于原文+目标语言生成缓存 key
- 支持 TTL 过期（7天）和条目上限（5000条）
- 整页翻译和划词翻译均支持缓存
- 超限时自动清理最旧的 20% 条目"
```
