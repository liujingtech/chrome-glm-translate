// content/extractor.js
// 依赖: utils/constants.js (定义了 SKIP_TAGS)

// 需要跳过的class/id关键词（更精确）
const SKIP_PATTERNS = [
  'file-navigation', 'Box-header', 'Box-footer', 'jump-to-line',
  'discussion-sidebar', 'timeline-comment-actions',
  'reaction-popover', 'emoji-picker', 'hx_badge-icon'
];

// 主要内容选择器（按优先级）
const MAIN_SELECTORS = [
  // GitHub
  '.repository-content', '.readme', '.markdown-body', '[data-target="readme"]',
  'article.markdown-body', '.blob-wrapper', '.js-file-line-container',
  // 通用
  'article', 'main', '[role="main"]',
  '.post-content', '.article-content', '.entry-content',
  '.content-body', '.text-content',
  // 最后备用
  '#content', '#main', '.content'
];

function shouldSkipElement(el) {
  if (!el || !el.tagName) return true;

  // 使用 constants.js 中的 SKIP_TAGS
  const skipTags = typeof SKIP_TAGS !== 'undefined' ? SKIP_TAGS :
    ['SCRIPT', 'STYLE', 'CODE', 'PRE', 'INPUT', 'TEXTAREA', 'NOSCRIPT', 'KBD', 'SAMP', 'SVG', 'NAV', 'FOOTER', 'HEADER', 'ASIDE'];

  if (skipTags.includes(el.tagName)) return true;

  const className = (el.className || '').toString().toLowerCase();
  const id = (el.id || '').toLowerCase();
  const combined = className + ' ' + id;

  for (const pattern of SKIP_PATTERNS) {
    if (combined.includes(pattern.toLowerCase())) return true;
  }

  try {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return true;
  } catch (e) {}

  return false;
}

function findMainContentAreas() {
  const areas = [];

  for (const selector of MAIN_SELECTORS) {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (!shouldSkipElement(el) && el.textContent.trim().length > 50) {
          areas.push(el);
        }
      });
      if (areas.length > 0) break; // 找到就停止
    } catch (e) {}
  }

  return areas.length > 0 ? areas : [document.body];
}

function shouldSkipNode(node, mainAreas) {
  if (!node || !node.textContent) return true;

  // 检查父元素
  let parent = node.parentElement;
  let depth = 0;
  while (parent && depth < 20) {
    if (shouldSkipElement(parent)) return true;
    if (parent.dataset?.translated === 'true') return true;
    parent = parent.parentElement;
    depth++;
  }

  // 检查是否在主要内容区域外
  if (mainAreas && !mainAreas.includes(document.body)) {
    let inMain = false;
    let p = node.parentElement;
    while (p) {
      if (mainAreas.includes(p)) { inMain = true; break; }
      p = p.parentElement;
    }
    if (!inMain) return true;
  }

  const text = node.textContent.trim();
  if (!text || text.length < 2) return true;
  if (/^\d+$/.test(text)) return true;  // 纯数字
  if (/^[^\w\u4e00-\u9fff]*$/.test(text)) return true; // 无实际内容

  return false;
}

function extractPageTexts() {
  const textNodes = [];
  const mainAreas = findMainContentAreas();
  console.log('主要内容区域:', mainAreas.map(el => el.tagName + (el.className ? '.' + el.className.split(' ')[0] : '') + (el.id ? '#' + el.id : '')));

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
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

  console.log('文本节点数量:', textNodes.length);
  return textNodes;
}

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
