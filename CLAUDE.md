# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# 智谱翻译 Chrome 插件 - Claude 开发指南

## 项目概述

这是一个基于智谱 GLM 大模型的 Chrome 网页翻译插件，使用 Manifest V3。

**核心功能**：右键翻译整页、划词翻译、直接替换原文（非双语对照）

## 快速开始

1. 在 Chrome 中访问 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」，选择本项目目录
4. 修改代码后：
   - content script → 刷新页面
   - background/service-worker → 点击扩展页刷新按钮

## 调试方法

- **Service Worker 控制台**：`chrome://extensions/` → 点击扩展的 "Service Worker" 链接
- **Content Script 控制台**：在目标页面按 F12 打开开发者工具
- **存储数据**：开发者工具 → Application → Storage → Extensions

## 架构说明

```
chromeplugin/
├── manifest.json              # 扩展配置，content_scripts 注入顺序很重要
├── background/
│   └── service-worker.js      # 后台服务，处理 API 调用、缓存、消息路由
├── content/
│   ├── content.js             # 主入口，处理消息、协调翻译流程
│   ├── extractor.js           # 提取页面可翻译文本（TreeWalker）
│   ├── renderer.js            # 渲染翻译结果（直接替换文本节点）
│   └── content.css            # UI 样式（进度条、弹窗等）
├── options/                   # 设置页面
├── popup/                     # 点击扩展图标的弹窗
├── utils/
│   ├── constants.js           # 常量：语言列表、模型映射、默认设置
│   └── storage.js             # 存储：getSettings、saveSettings、缓存
└── icons/                     # 图标（16/48/128px PNG + SVG 源文件）
```

## 关键代码流程

### 整页翻译流程

1. 用户右键 → `background` 发送 `TRANSLATE_PAGE` 消息
2. `content.js` 的 `handleTranslatePage()` 获取设置，调用 `extractPageTexts()`
3. `extractor.js` 使用 TreeWalker 提取文本节点，过滤无效内容
4. `content.js` 发送 `REQUEST_TRANSLATION` 到 background
5. `background` 先查询缓存，未命中的文本分批（每批 20 条）并行调用 GLM API
6. 每批完成后发送 `PARTIAL_TRANSLATION_RESULT`，`content.js` 调用 `replaceText()` 替换
7. 全部完成后发送 `TRANSLATION_COMPLETE`

### 关键函数

| 文件 | 函数 | 作用 |
|------|------|------|
| extractor.js | `extractPageTexts()` | 提取页面文本，返回 `[{node, text, parent}]` |
| extractor.js | `shouldSkip(el, strict)` | 判断元素是否应跳过（script/style/导航等） |
| renderer.js | `replaceText(node, text)` | 直接替换文本节点内容，保存原文到 `_originalText` |
| renderer.js | `removeAllTranslations()` | 恢复所有原文 |
| background | `translatePageParallel()` | 并发控制的批量翻译，含缓存查询 |
| background | `getTextCache()/setTextCache()` | 翻译结果缓存（7天过期，最多5000条） |

## 设置项

存储在 `chrome.storage.local`：

```javascript
{
  apiKey: '',           // 用户输入，必填
  targetLang: 'zh-CN',  // 目标语言
  model: 'GLM-3-Turbo', // 模型（并发数由模型决定）
  filterNodes: true     // 是否严格过滤无效节点
}
```

## 模型配置

```javascript
const MODELS = {
  'GLM-3-Turbo': { api: 'glm-3-turbo', maxConcurrency: 50 },
  'GLM-4-FLASH': { api: 'glm-4-flash', maxConcurrency: 50 },
  'GLM-4-AIR': { api: 'glm-4-air', maxConcurrency: 100 },
  'GLM-4': { api: 'glm-4', maxConcurrency: 30 }
};
```

## 缓存系统

- 缓存键：基于 `原文:目标语言` 的 hash
- TTL：7 天
- 最大条目：5000 条，超限时清理最旧的 20%
- 存储：`chrome.storage.local` 的 `cache` 字段

## API 调用

- 端点：`https://open.bigmodel.cn/api/paas/v4/chat/completions`
- 模型映射：`GLM-3-Turbo` → `glm-3-turbo`, `GLM-4` → `glm-4`, 等
- 批量翻译使用动态分隔符 `<<S${index}E>>` 分隔多条文本

## 常见问题排查

1. **翻译没反应** → 检查 content script 是否加载，看控制台是否有错误
2. **"没有可见内容"** → `filterNodes` 可能过于严格，检查 `extractPageTexts` 日志
3. **API 报错 "unsafe content"** → 某些内容触发安全过滤，已做 fallback 保留原文
4. **变量重复声明错误** → content script 只通过 manifest.json 加载，不要在 sendMsg 中重复注入

## 开发注意事项

- **不要硬编码 API Key**，始终从 `chrome.storage.local` 读取
- **content script 注入顺序**：constants.js → extractor.js → renderer.js → content.js
- **修改 content script 后**需要刷新页面才能生效
- **修改 background 后**需要点击扩展页的刷新按钮
- **发布新版本时**更新 manifest.json 的 version，重新打包 zip

## 打包发布

```powershell
# 创建发布包（排除开发文件）
Compress-Archive -Path background,content,icons,options,popup,utils,manifest.json -DestinationPath chromeplugin.zip
```
