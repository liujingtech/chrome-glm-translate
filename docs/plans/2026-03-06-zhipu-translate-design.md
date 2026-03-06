# 智谱翻译 Chrome 插件设计文档

## 概述

基于智谱API的网页翻译Chrome插件，支持右键菜单翻译整页或选中内容，双语对照显示。

## 核心功能

- **翻译整页**：右键菜单触发，智能过滤不需要翻译的内容
- **翻译选中**：右键菜单翻译选中文本，弹窗显示结果
- **双语对照**：译文显示在原文下方，保持原文可见
- **多语言支持**：用户可选择目标翻译语言
- **模型切换**：支持 GLM-4-AIR、GLM-4-FLASH、GLM-4
- **页面级缓存**：刷新不重翻，关闭后清空
- **快捷键**：用户可自定义配置

## 项目结构

```
chromeplugin/
├── manifest.json           # Chrome扩展配置
├── background/
│   └── service-worker.js   # 右键菜单注册、API调用、缓存管理
├── content/
│   ├── content.js          # 主入口，消息监听
│   ├── extractor.js        # 页面文本提取、智能过滤
│   ├── renderer.js         # 双语对照渲染
│   └── content.css         # 翻译样式
├── popup/
│   ├── popup.html          # 快速设置弹窗
│   ├── popup.js
│   └── popup.css
├── options/
│   ├── options.html        # 完整设置页面
│   ├── options.js
│   └── options.css
├── utils/
│   ├── api.js              # 智谱API调用封装
│   ├── storage.js          # 存储管理封装
│   └── constants.js        # 常量定义（模型列表、语言列表等）
└── icons/                  # 插件图标资源
```

## 模块职责

### 1. Background Service Worker
- **右键菜单管理**：创建"翻译整页"和"翻译选中内容"两个菜单项
- **消息路由**：接收右键菜单事件，分发到对应处理函数
- **API调用**：调用智谱API进行翻译
- **缓存管理**：页面级缓存，key为`页面URL + 内容hash`

### 2. Content Script
- **消息监听**：接收来自background的翻译指令
- **文本提取器(extractor.js)**：
  - 遍历页面DOM，提取文本节点
  - 智能过滤：跳过`<code>`、`<input>`、`<textarea>`、`<script>`、已翻译节点
  - 支持选中区域提取
- **双语渲染器(renderer.js)**：
  - 在原文下方插入翻译文本
  - 添加视觉区分（灰色背景、左侧边框）
  - 支持撤销翻译（恢复原页面）

### 3. Popup（点击插件图标）
- 显示当前设置摘要：目标语言、当前模型
- 快速切换目标语言
- 快速切换模型
- 链接到完整设置页

### 4. Options Page（完整设置）
- **API配置**：智谱API Key输入框（带验证）
- **目标语言**：选择默认翻译目标语言
- **模型选择**：GLM-4-AIR / GLM-4-FLASH / GLM-4
- **快捷键配置**：显示Chrome快捷键设置入口
- **其他**：清除缓存按钮、重置设置

## 数据流

### 翻译整页流程
```
用户右键 → "翻译整页"
    ↓
Background接收事件 → 向当前Tab发送消息
    ↓
Content Script接收消息
    ↓
Extractor遍历DOM → 提取可翻译文本节点
    ↓
检查缓存 → 命中则直接渲染，未命中则调用API
    ↓
Background调用智谱API → 返回翻译结果
    ↓
Content Script渲染双语对照
```

### 翻译选中内容流程
```
用户选中文本 → 右键 → "翻译选中内容"
    ↓
Background接收事件 → 获取选中文本
    ↓
调用智谱API翻译
    ↓
Content Script在选中文本下方显示译文弹窗
```

## 数据存储

```javascript
// chrome.storage.local
{
  apiKey: "your-zhipu-api-key",
  targetLang: "zh-CN",
  model: "GLM-4-FLASH",
  cache: {
    "url-hash-xxx": {
      original: "原文内容",
      translated: "译文内容",
      timestamp: 1234567890
    }
  }
}
```

## UI设计

### 双语对照样式
- 译文区域：灰色背景 #f5f5f5，左侧蓝色边框

### 选中内容翻译弹窗
- 简洁卡片样式，右上角关闭按钮

### Popup弹窗
- 显示目标语言、当前模型下拉选择
- 快速访问完整设置

### Options设置页
- API Key配置区
- 翻译设置区（语言、模型）
- 快捷键配置入口
- 清除缓存、重置设置按钮

## 技术实现

### 智谱API调用
```javascript
const MODELS = {
  'GLM-4': 'glm-4',
  'GLM-4-AIR': 'glm-4-air',
  'GLM-4-FLASH': 'glm-4-flash'
};

async function translate(text, targetLang, model, apiKey) {
  const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: MODELS[model],
      messages: [{
        role: 'user',
        content: `请将以下内容翻译成${targetLang}，只返回翻译结果，不要解释：\n\n${text}`
      }]
    })
  });
  return response.json();
}
```

### 智能过滤规则
```javascript
const SKIP_TAGS = ['SCRIPT', 'STYLE', 'CODE', 'PRE', 'INPUT', 'TEXTAREA', 'NOSCRIPT'];

function shouldSkip(node) {
  if (SKIP_TAGS.includes(node.parentElement?.tagName)) return true;
  if (node.parentElement?.isContentEditable) return true;
  if (node.parentElement?.dataset?.translated) return true;
  if (!node.textContent.trim()) return true;
  return false;
}
```

### 支持的目标语言
```javascript
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
```

### Manifest V3 配置
```json
{
  "manifest_version": 3,
  "permissions": [
    "contextMenus",
    "storage",
    "activeTab"
  ],
  "background": {
    "service_worker": "background/service-worker.js"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content/content.js", "content/extractor.js", "content/renderer.js"],
    "css": ["content/content.css"]
  }],
  "action": {
    "default_popup": "popup/popup.html"
  },
  "options_page": "options/options.html"
}
```

## 功能总结

| 功能点 | 实现方式 |
|--------|----------|
| 翻译整页 | 右键菜单 → Content Script提取 → API翻译 → 双语渲染 |
| 翻译选中 | 右键菜单 → API翻译 → 弹窗显示 |
| 目标语言 | Popup/Options页切换，存储到chrome.storage |
| 模型切换 | Popup/Options页切换 |
| API Key配置 | 首次引导弹窗 + Options页修改 |
| 缓存 | 页面级，key=URL+hash，刷新保留，关闭清空 |
| 快捷键 | Chrome原生快捷键设置页配置 |
| 智能过滤 | 跳过code/input/textarea/已翻译节点 |
