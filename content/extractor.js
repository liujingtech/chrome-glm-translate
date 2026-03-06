// content/extractor.js

// SKIP_TAGS 在 utils/constants.js 中定义，这里直接使用

// 判断节点是否应该跳过
function shouldSkipNode(node) {
  // 检查父元素标签
  let parent = node.parentElement;
  while (parent) {
    if (SKIP_TAGS.includes(parent.tagName)) {
      return true;
    }
    // 跳过已翻译的内容
    if (parent.dataset && parent.dataset.translated === 'true') {
      return true;
    }
    // 跳过可编辑区域
    if (parent.isContentEditable) {
      return true;
    }
    parent = parent.parentElement;
  }

  // 跳过空文本
  if (!node.textContent || !node.textContent.trim()) {
    return true;
  }

  // 跳过纯空白字符
  if (/^\s+$/.test(node.textContent)) {
    return true;
  }

  return false;
}

// 提取页面所有可翻译的文本节点
function extractPageTexts() {
  const textNodes = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  let node;
  while (node = walker.nextNode()) {
    if (!shouldSkipNode(node)) {
      textNodes.push({
        node: node,
        text: node.textContent.trim(),
        parent: node.parentElement
      });
    }
  }

  return textNodes;
}

// 提取选中的文本
function extractSelectedText() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const text = selection.toString().trim();
  if (!text) {
    return null;
  }

  // 获取选区的位置信息
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

// 将文本按段落/块分组，避免单次API调用内容过长
function groupTextsForTranslation(textNodes, maxChunkSize = 2000) {
  const groups = [];
  let currentGroup = [];
  let currentLength = 0;

  for (const item of textNodes) {
    const text = item.text;

    // 如果单个文本超过限制，单独处理
    if (text.length > maxChunkSize) {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
        currentLength = 0;
      }
      groups.push([item]);
      continue;
    }

    // 如果加入当前文本会超限，先保存当前组
    if (currentLength + text.length > maxChunkSize && currentGroup.length > 0) {
      groups.push(currentGroup);
      currentGroup = [];
      currentLength = 0;
    }

    currentGroup.push(item);
    currentLength += text.length;
  }

  // 保存最后一组
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

// 生成内容的简单hash
function hashContent(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}
