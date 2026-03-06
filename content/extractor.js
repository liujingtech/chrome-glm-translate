// content/extractor.js

console.log('extractor.js 加载');

const SKIP_PATTERNS = ['nav', 'menu', 'sidebar', 'footer', 'header', 'banner', 'ad-', 'comment', 'reply', 'social', 'share'];

const MAIN_SELECTORS = [
  '.repository-content', '.readme', '.markdown-body', 'article.markdown-body',
  'article', 'main', '[role="main"]', '.content', '#content'
];

function shouldSkip(el) {
  if (!el || !el.tagName) return true;
  const tag = el.tagName;
  if (['SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA', 'NOSCRIPT', 'SVG', 'SELECT', 'BUTTON', 'IFRAME'].includes(tag)) return true;

  const cls = (el.className || '').toString().toLowerCase();
  const id = (el.id || '').toLowerCase();
  for (const p of SKIP_PATTERNS) {
    if ((cls + ' ' + id).includes(p)) return true;
  }
  return false;
}

function isInView(el) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.bottom > -50 && r.top < window.innerHeight + 50;
}

function extractPageTexts() {
  console.log('extractPageTexts 开始执行');
  const nodes = [];

  // 找主内容区
  let mainArea = null;
  for (const sel of MAIN_SELECTORS) {
    const el = document.querySelector(sel);
    if (el && el.textContent.trim().length > 50) {
      mainArea = el;
      console.log('找到主区域:', sel);
      break;
    }
  }
  if (!mainArea) mainArea = document.body;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let total = 0, skipped = 0;
  let n;

  while (n = walker.nextNode()) {
    total++;

    // 检查父元素
    let p = n.parentElement, skip = false;
    while (p) {
      if (shouldSkip(p)) { skip = true; break; }
      if (p.dataset?.translated === 'true') { skip = true; break; }
      p = p.parentElement;
    }
    if (skip) { skipped++; continue; }

    // 检查文本
    const txt = (n.textContent || '').trim();
    if (!txt || txt.length < 2 || /^\d+$/.test(txt)) { skipped++; continue; }

    // 检查是否在主内容区和视口内
    let inMain = false;
    p = n.parentElement;
    while (p) { if (p === mainArea) { inMain = true; break; } p = p.parentElement; }

    if (!inMain) { skipped++; continue; }
    if (!isInView(n.parentElement)) { skipped++; continue; }

    nodes.push({ node: n, text: txt, parent: n.parentElement });
  }

  console.log('总节点:', total, '跳过:', skipped, '有效:', nodes.length);
  return nodes;
}

function extractSelectedText() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const txt = sel.toString().trim();
  if (!txt) return null;
  const rect = sel.getRangeAt(0).getBoundingClientRect();
  return {
    text: txt,
    rect: { top: rect.top + window.scrollY, left: rect.left + window.scrollX, width: rect.width, height: rect.height }
  };
}

console.log('extractor.js 加载完成');
