// content/extractor.js

const SKIP_PATTERNS = ['nav', 'menu', 'sidebar', 'footer', 'header', 'banner', 'ad-', 'ads-', 'comment', 'reply', 'social', 'share', 'file-navigation', 'Box-header'];

const MAIN_SELECTORS = [
  // GitHub 特定
  '.repository-content', '.readme', '.markdown-body', 'article.markdown-body',
  '[data-target="readme"]', '.js-file-line-container', '.blob-wrapper-embedded',
  // 通用
  'article', 'main', '[role="main"]', '.content', '#content', '.post', '.article'
];

function shouldSkipElement(el) {
  if (!el || !el.tagName) return true;
  const skipTags = typeof SKIP_TAGS !== 'undefined' ? SKIP_TAGS : ['SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA', 'NOSCRIPT', 'SVG', 'SELECT', 'BUTTON', 'IFRAME'];
  if (skipTags.includes(el.tagName)) return true;

  const className = (el.className || '').toString().toLowerCase();
  const id = (el.id || '').toLowerCase();
  const combined = className + ' ' + id;
  for (const p of SKIP_PATTERNS) {
    if (combined.includes(p)) return true;
  }

  try {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return true;
  } catch (e) {}
  return false;
}

function isInViewport(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  // 放宽视口判断 - 只要有一部分在视口内就算
  return rect.bottom > -100 && rect.top < window.innerHeight + 100 &&
         rect.right > -100 && rect.left < window.innerWidth + 100;
}

function findMainContentAreas() {
  for (const selector of MAIN_SELECTORS) {
    try {
      const els = document.querySelectorAll(selector);
      console.log('选择器', selector, '找到', els.length, '个');
      for (const el of els) {
        if (!shouldSkipElement(el) && el.textContent.trim().length > 50) {
          console.log('使用主区域:', selector);
          return [el];
        }
      }
    } catch (e) {}
  }
  console.log('使用 body');
  return [document.body];
}

function shouldSkipNode(node, mainAreas) {
  if (!node || node.nodeType !== 3) return true;

  let parent = node.parentElement;
  const path = [];
  while (parent) {
    path.push(parent.tagName);
    if (shouldSkipElement(parent)) return true;
    if (parent.dataset?.translated === 'true') return true;
    parent = parent.parentElement;
  }

  if (mainAreas && !mainAreas.includes(document.body)) {
    let inMain = false, p = node.parentElement;
    while (p) { if (mainAreas.includes(p)) { inMain = true; break; } p = p.parentElement; }
    if (!inMain) return true;
  }

  const text = (node.textContent || '').trim();
  if (!text || text.length < 2) return true;
  if (/^\d+$/.test(text)) return true;
  if (/^[^\w\u4e00-\u9fff]+$/.test(text)) return true;
  return false;
}

function extractPageTexts() {
  const textNodes = [];
  const mainAreas = findMainContentAreas();
  console.log('主内容区:', mainAreas[0].tagName, mainAreas[0].className);

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let totalNodes = 0, skippedNodes = 0, notInView = 0;
  let node;

  while (node = walker.nextNode()) {
    totalNodes++;

    if (shouldSkipNode(node, mainAreas)) {
      skippedNodes++;
      continue;
    }

    const parent = node.parentElement;
    if (parent && isInViewport(parent)) {
      textNodes.push({ node, text: node.textContent.trim(), parent });
    } else {
      notInView++;
    }
  }

  console.log('总节点:', totalNodes, '跳过:', skippedNodes, '不在视口:', notInView, '有效:', textNodes.length);
  return textNodes;
}

function extractSelectedText() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const text = sel.toString().trim();
  if (!text) return null;
  const rect = sel.getRangeAt(0).getBoundingClientRect();
  return {
    text,
    rect: {
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height
    }
  };
}
