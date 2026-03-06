// content/extractor.js
// 依赖: utils/constants.js (定义了 SKIP_TAGS)

// 需要跳过的class/id关键词
const SKIP_PATTERNS = [
  'nav', 'menu', 'sidebar', 'footer', 'header', 'banner', 'ad-', 'ads-',
  'comment', 'reply', 'social', 'share', 'related', 'recommend'
];

// 主要内容选择器
const MAIN_SELECTORS = [
  'article', 'main', '[role="main"]', '.post-content', '.article-content',
  '.entry-content', '.content', '.post', '.article', '.markdown-body'
];

function shouldSkipElement(el) {
  if (!el || !el.tagName) return true;
  // SKIP_TAGS 来自 constants.js
  if (typeof SKIP_TAGS !== 'undefined' && SKIP_TAGS.includes(el.tagName)) return true;

  const className = (el.className || '').toString().toLowerCase();
  const id = (el.id || '').toLowerCase();
  const combined = className + ' ' + id;

  for (const pattern of SKIP_PATTERNS) {
    if (combined.includes(pattern)) return true;
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
      document.querySelectorAll(selector).forEach(el => {
        if (!shouldSkipElement(el) && el.textContent.trim().length > 100) {
          areas.push(el);
        }
      });
    } catch (e) {}
  }
  return areas.length > 0 ? areas : [document.body];
}

function shouldSkipNode(node, mainAreas) {
  if (!node || !node.textContent) return true;

  let parent = node.parentElement;
  while (parent) {
    if (shouldSkipElement(parent)) return true;
    parent = parent.parentElement;
  }

  // 检查是否在主要内容区域外
  if (mainAreas && !mainAreas.includes(document.body)) {
    let inMain = false, p = node.parentElement;
    while (p) { if (mainAreas.includes(p)) { inMain = true; break; } p = p.parentElement; }
    if (!inMain) return true;
  }

  const text = node.textContent.trim();
  if (!text || text.length < 2 || /^\d+$/.test(text)) return true;

  return false;
}

function extractPageTexts() {
  const textNodes = [];
  const mainAreas = findMainContentAreas();
  console.log('主要内容区域:', mainAreas.length);

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

  console.log('文本节点:', textNodes.length);
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
