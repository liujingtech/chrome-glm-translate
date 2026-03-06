# 文本缓存功能设计

## 概述

为智谱翻译插件添加基于单条文本的翻译缓存，实现节省 API 调用 + 提升翻译速度的目标。

## 需求

- **目的**：节省 API 调用次数/费用 + 提升翻译速度
- **缓存粒度**：单条文本级别（复用性最高）
- **存储位置**：chrome.storage.local（持久化）
- **语言区分**：不同目标语言分别缓存
- **过期策略**：时间过期（TTL 7天）+ 条目上限（5000条）

## 设计

### 1. 缓存 Key 设计

```javascript
// Key 格式：hash(原文 + 目标语言)
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

### 2. 缓存数据结构

```javascript
// chrome.storage.local.cache
{
  "t_12345678": {
    original: "Hello World",
    translated: "你好世界",
    targetLang: "zh-CN",
    timestamp: 1709500000000
  }
}
```

### 3. 核心流程

```
翻译请求 → 遍历文本查缓存 → 收集未命中文本
    ↓
未缓存文本分批 → 调用 API → 结果存入缓存
    ↓
合并缓存结果 + 新翻译 → 按原顺序返回
```

### 4. 过期清理配置

```javascript
const CACHE_CONFIG = {
  TTL: 7 * 24 * 60 * 60 * 1000,  // 7 天
  MAX_ENTRIES: 5000,              // 最大条目数
  CLEANUP_RATIO: 0.2              // 超限时清理 20% 最旧条目
};
```

## 文件改动

| 文件 | 改动 |
|------|------|
| `utils/storage.js` | 新增缓存函数：`getTextCache()`, `setTextCache()`, `cleanupCache()` |
| `background/service-worker.js` | 修改 `translatePageParallel()` 和 `translateSelection()` 加入缓存逻辑 |

## 兼容性

- 现有缓存结构（基于 URL）将被替换为新结构
- 不影响现有翻译功能
