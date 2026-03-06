// content/extractor.js

console.log('extractor.js 加载');

const SKIP_PATTERNS = ['file-navigation', 'Box-header', 'Box-footer', 'jump-to-line'];

const MAIN_SELECTORS = [
  '.repository-content', '.readme', '.markdown-body', 'article.markdown-body',
  'article', 'main', '[role="main"]', '.content', '#content'
];

function shouldSkip(el, strict = true) {
  if (!el || !el.tagName) return true;
  const tag = el.tagName;
  if (['SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA', 'NOSCRIPT', 'SVG', 'SELECT', 'BUTTON', 'IFRAME'].includes(tag)) return true;

  if (strict) {
    const cls = (el.className || '').toString().toLowerCase();
    const id = (el.id || '').toLowerCase();
    for (const p of SKIP_PATTERNS) {
      if ((cls + ' ' + id).includes(p.toLowerCase())) return true;
    }
  }
  return false;
}

function extractPageTexts() {
  console.log('extractPageTexts 开始');
  const nodes = [];

  // 获取filterNodes设置（同步从全局变量或默认true）
  const filterNodes = typeof window.filterNodesEnabled !== 'undefined' ? window.filterNodesEnabled : true;

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

  // 直接在主内容区遍历
  const walker = document.createTreeWalker(mainArea, NodeFilter.SHOW_TEXT, null, false);
  let total = 0, skipped = 0;
  let n;

  while (n = walker.nextNode()) {
    total++;

    // 只检查直接父元素
    const p = n.parentElement;
    if (!p || shouldSkip(p, filterNodes)) { skipped++; continue; }
    if (p.dataset?.translated === 'true') { skipped++; continue; }

    // 检查文本
    const txt = (n.textContent || '').trim();
    if (!txt || txt.length < 2) { skipped++; continue; }
    if (filterNodes) {
      if (/^\d+$/.test(txt)) { skipped++; continue; }  // 纯数字跳过
      if (/^[^\w\u4e00-\u9fff]+$/.test(txt)) { skipped++; continue; }  // 只有符号
    }

    nodes.push({ node: n, text: txt, parent: p });
  }

  console.log('总节点:', total, '跳过:', skipped, '有效:', nodes.length, '过滤模式:', filterNodes ? '严格' : '宽松');
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
