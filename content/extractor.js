// content/extractor.js

// 需要跳过的class/id关键词
const SKIP_PATTERNS = [
  'nav', 'menu', 'sidebar', 'footer', 'header', 'banner', 'ad-', 'ads-',
  'comment', 'reply', 'social', 'share', 'related', 'recommend'
];

// 主要内容选择器
const MAIN_SELECTORS = [
  '.repository-content', '.readme', '.markdown-body', '[data-target="readme"]',
  'article', 'main', '[role="main"]', '.post-content', '.article-content',
  '.entry-content', '.content', '.post', '.article', '#content', '#main'
];

function shouldSkipElement(el) {
  if (!el || !el.tagName) return true;
  const skipTags = typeof SKIP_TAGS !== 'undefined' ? SKIP_TAGS : ['SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA', 'NOSCRIPT', 'SVG', 'SELECT', 'BUTTON', 'IFRAME'];
  if (skipTags.includes(el.tagName)) return true;

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

function isInViewport(el) {
  const rect = el.getBoundingClientRect();
  return rect.top < window.innerHeight && rect.bottom > 0 &&
         rect.left < window.innerWidth && rect.right > 0;
}

function findMainContentAreas() {
  for (const selector of MAIN_SELECTORS) {
    try {
      const el = document.querySelector(selector);
      if (el && !shouldSkipElement(el) && el.textContent.trim().length > 100) {
        return [el];
      }
    } catch (e) {}
  }
  return [document.body];
}

function shouldSkipNode(node, mainAreas) {
  if (!node || !node.textContent) return true;

  let parent = node.parentElement;
  while (parent) {
    if (shouldSkipElement(parent)) return true;
    if (parent.dataset?.translated === 'true') return true;
    parent = parent.parentElement;
  }

  // 检查是否在主要内容区域
  if (mainAreas && !mainAreas.includes(document.body)) {
    let inMain = false, p = node.parentElement;
    while (p) { if (mainAreas.includes(p)) { inMain = true; break; } p = p.parentElement; }
    if (!inMain) return true;
  }

  const text = node.textContent.trim();
  if (!text || text.length < 2 || /^\d+$/.test(text)) return true;
  return false;
}

// 只提取可见区域内的文本
function extractPageTexts() {
  const textNodes = [];
  const mainAreas = findMainContentAreas();
  console.log('主内容区:', mainAreas[0].tagName);

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let node;
  while (node = walker.nextNode()) {
    if (!shouldSkipNode(node, mainAreas)) {
      // 检查是否在视口内
      const parent = node.parentElement;
      if (parent && isInViewport(parent)) {
        textNodes.push({
          node: node,
          text: node.textContent.trim(),
          parent: parent
        });
      }
    }
  }

  console.log('可见文本节点:', textNodes.length);
  return textNodes;
}

function extractSelectedText() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const text = selection.toString().trim();
  if (!text) return null;
  const rect = selection.getRangeAt(0).getBoundingClientRect();
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
