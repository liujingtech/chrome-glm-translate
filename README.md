# 智谱翻译 - Chrome 网页翻译插件

基于智谱 GLM 大模型的 Chrome 网页翻译插件，支持整页翻译和划词翻译。

## 功能特点

- **整页翻译**：右键菜单一键翻译整个网页
- **划词翻译**：选中文字后右键翻译，弹窗显示结果
- **直接替换**：翻译结果直接替换原文，保持页面整洁
- **多语言支持**：支持简体中文、繁体中文、英语、日语、韩语、法语、德语、西班牙语、俄语
- **多模型选择**：GLM-3-Turbo（默认）、GLM-4-FLASH（快速）、GLM-4-AIR（平衡）、GLM-4（最佳）
- **智能过滤**：自动过滤代码块、输入框、导航栏等无需翻译的内容
- **并发翻译**：支持配置最大并发数，提升翻译速度
- **可配置快捷键**：支持自定义键盘快捷键

## 安装

### 从源码安装

1. 下载或克隆本项目
2. 打开 Chrome，访问 `chrome://extensions/`
3. 开启右上角「开发者模式」
4. 点击「加载已解压的扩展程序」，选择项目目录
5. 安装完成

## 使用方法

### 配置 API Key

1. 访问 [智谱开放平台](https://open.bigmodel.cn/) 注册账号
2. 在控制台创建 API Key
3. 右键点击任意网页，选择「翻译整页」
4. 首次使用会弹出配置窗口，输入 API Key

### 翻译网页

- **整页翻译**：在网页空白处右键 → 「翻译整页」
- **划词翻译**：选中文字 → 右键 → 「翻译选中内容」

### 设置选项

点击扩展图标打开设置页面：

| 设置项 | 说明 |
|--------|------|
| 目标语言 | 翻译的目标语言 |
| 翻译模型 | GLM-3-Turbo（默认）、GLM-4-FLASH（快）、GLM-4-AIR（平衡）、GLM-4（质量高） |
| 过滤无效节点 | 是否过滤纯数字、符号、过短文本等 |
| 最大并发请求数 | 同时发送的 API 请求数量（1-20） |

## 项目结构

```
chromeplugin/
├── manifest.json          # 扩展配置
├── background/
│   └── service-worker.js  # 后台服务（API调用、消息处理）
├── content/
│   ├── content.js         # 内容脚本主入口
│   ├── extractor.js       # 页面文本提取
│   ├── renderer.js        # 翻译结果渲染
│   └── content.css        # 样式
├── options/
│   ├── options.html       # 设置页面
│   ├── options.js         # 设置逻辑
│   └── options.css        # 设置样式
├── popup/
│   ├── popup.html         # 弹窗页面
│   ├── popup.js           # 弹窗逻辑
│   └── popup.css          # 弹窗样式
├── utils/
│   ├── constants.js       # 常量定义
│   └── storage.js         # 存储工具
└── icons/                 # 图标资源
```

## 技术栈

- Chrome Extension Manifest V3
- Service Worker
- Content Scripts
- 智谱 GLM API

## 注意事项

- API Key 存储在本地 Chrome Storage，不会上传到任何服务器
- 翻译会消耗 API 配额，默认使用 GLM-3-Turbo，性价比高
- 部分网站可能因 CSP 策略限制无法正常工作

## License

MIT
