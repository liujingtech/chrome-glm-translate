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

### 方式一：下载安装包（推荐）

1. 前往 [Releases](../../releases) 页面下载最新版本的 `chromeplugin.zip`
2. 解压 zip 文件到任意目录
3. 打开 Chrome，访问 `chrome://extensions/`
4. 开启右上角「开发者模式」
5. 点击「加载已解压的扩展程序」，选择解压后的文件夹
6. 安装完成

### 方式二：从源码安装

1. 克隆本项目：`git clone https://github.com/你的用户名/chromeplugin.git`
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

## 隐私政策 / Privacy Policy

**最后更新 / Last Updated**: 2024年3月

### 中文

**智谱翻译**（以下简称"本扩展"）尊重并保护用户隐私。本隐私政策说明我们如何收集、使用和保护您的信息：

1. **数据收集**
   - 本扩展仅收集用户主动配置的 API Key 和设置偏好（目标语言、模型选择等）
   - 翻译时，本扩展会读取当前网页的文本内容用于翻译
   - 翻译结果会缓存在本地以提升性能

2. **数据存储**
   - 所有数据均存储在用户本地的 Chrome Storage 中
   - 我们不会将任何用户数据上传到我们的服务器

3. **数据传输**
   - 网页文本内容会发送到智谱 GLM API 进行翻译
   - API Key 会随翻译请求发送到智谱 API 进行身份验证
   - 智谱 API 的数据处理请参考[智谱隐私政策](https://open.bigmodel.cn/)

4. **数据使用**
   - 收集的数据仅用于提供翻译服务
   - 我们不会出售、出租或共享用户数据给第三方

5. **第三方服务**
   - 本扩展使用智谱 GLM API 提供翻译服务
   - 使用本扩展即表示您同意智谱 API 的服务条款

### English

**ZhiPu Translate** (hereinafter "this extension") respects and protects user privacy. This privacy policy explains how we collect, use, and protect your information:

1. **Data Collection**
   - This extension only collects the API Key and preference settings (target language, model selection, etc.) that users actively configure
   - During translation, this extension reads the text content of the current web page for translation
   - Translation results are cached locally for better performance

2. **Data Storage**
   - All data is stored in the user's local Chrome Storage
   - We do not upload any user data to our servers

3. **Data Transmission**
   - Web page text content is sent to ZhiPu GLM API for translation
   - API Key is sent to ZhiPu API for authentication with each translation request
   - Please refer to [ZhiPu Privacy Policy](https://open.bigmodel.cn/) for ZhiPu API's data processing

4. **Data Usage**
   - Collected data is only used to provide translation services
   - We do not sell, rent, or share user data with third parties

5. **Third-Party Services**
   - This extension uses ZhiPu GLM API to provide translation services
   - By using this extension, you agree to ZhiPu API's terms of service

### 联系我们 / Contact

如有隐私相关问题，请联系：liujingtech@gmail.com

For privacy-related questions, please contact: liujingtech@gmail.com

## License

MIT
