// content/extractor.js

// 需要跳过的标签
const SKIP_TAGS = ['SCRIPT', 'STYLE', 'CODE', 'PRE', 'INPUT', 'TEXTAREA', 'NOSCRIPT', 'KBD', 'SAMP', 'SVG', 'NAV', 'FOOTER', 'HEADER', 'ASIDE'];

// 需要跳过的class/id关键词
const SKIP_PATTERNS = [
  'nav', 'menu', 'sidebar', 'footer', 'header', 'banner', 'ad-', 'ads-',
  'comment', 'reply', 'social', 'share', 'related', 'recommend', 'more',
  'breadcrumb', 'pagination', 'tag', 'category', 'meta', 'author-info',
  'cookie', 'gdpr', 'newsletter', 'subscribe', 'popup', 'modal', 'dialog',
  'notification', 'toast', 'tooltip', 'dropdown', 'search', 'login', 'signup'
];

// 主要内容选择器（优先翻译这些区域）
const MAIN_SELECTORS = [
  'article', 'main', '[role="main"]', '.post-content', '.article-content',
  '.entry-content', '.content', '.post', '.article', '#content', '#main',
  '.markdown-body', '.readme', '.documentation', '.docs-content'
];

// 判断是否应该跳过该元素
function shouldSkipElement(el) {
  if (!el || !el.tagName) return true;

  // 跳过特定标签
  if (SKIP_TAGS.includes(el.tagName)) return true;

  // 检查class和id是否匹配跳过模式
  const className = (el.className || '').toString().toLowerCase();
  const id = (el.id || '').toLowerCase();
  const combined = className + ' ' + id;

  for (const pattern of SKIP_PATTERNS) {
    if (combined.includes(pattern)) return true;
  }

  // 跳过隐藏元素
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return true;
  if (parseFloat(style.opacity) < 0.1) return true;

  // 跳过很小的元素
  const rect = el.getBoundingClientRect();
  if (rect.width < 50 || rect.height < 20) return true;

  return false;
}

// 查找主要内容区域
function findMainContentAreas() {
  const areas = [];

  // 首先尝试找主要内容选择器
  for (const selector of MAIN_SELECTORS) {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (!shouldSkipElement(el) && el.textContent.trim().length > 100) {
          areas.push(el);
        }
      });
    } catch (e) {}
  }

  // 如果找到了主要内容区域，就用这些
  if (areas.length > 0) {
    return areas;
  }

  // 否则返回body
  return [document.body];
}

// 判断节点是否在主内容区域内
function isInMainContent(node, mainAreas) {
  let parent = node.parentElement;
  while (parent) {
    if (mainAreas.includes(parent)) return true;
    parent = parent.parentElement;
  }
  return false;
}

// 判断节点是否应该跳过
function shouldSkipNode(node, mainAreas) {
  if (!node || !node.textContent) return true;

  // 检查父元素
  let parent = node.parentElement;
  while (parent) {
    if (shouldSkipElement(parent)) return true;
    if (parent.dataset?.translated === 'true') return true;
    if (parent.isContentEditable) return true;
    parent = parent.parentElement;
  }

  // 检查是否在主要内容区域外（如果有定义主要内容）
  if (mainAreas && mainAreas.length > 0 && !mainAreas.includes(document.body)) {
    if (!isInMainContent(node, mainAreas)) return true;
  }

  // 跳过空文本
  const text = node.textContent.trim();
  if (!text) return true;
  if (/^\s+$/.test(text)) return true;

  // 跳过太短的文本（小于2个字符）
  if (text.length < 2) return true;

  // 跳过纯数字
  if (/^\d+$/.test(text)) return true;

  // 跳过看起来像代码的内容
  if (/^{.*}$/.test(text) || /^\[.*\]$/.test(text)) return true;

  return false;
}

// 提取页面可翻译的文本节点
function extractPageTexts() {
  const textNodes = [];
  const mainAreas = findMainContentAreas();

  console.log('找到主要内容区域:', mainAreas.length);

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  let node;
  while (node = walker.nextNode()) {
    if (!shouldSkipNode(node, mainAreas)) {
      textNodes.push({
        node: node,
        text: node.textContent.trim(),
        parent: node.parentElement
      });
    }
  }

  console.log('提取到文本节点:', textNodes.length);
  return textNodes;
}

// 提取选中的文本
function extractSelectedText() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const text = selection.toString().trim();
  if (!text) return null;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  return {
    text: text,
    rect: {
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height
    }
  };
}
