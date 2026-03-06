// utils/api.js

// 调用智谱API进行翻译
async function translateText(text, targetLang, model, apiKey) {
  const languageName = getLanguageName(targetLang);
  const modelIndex = getModelIndex(model);

  const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelIndex,
      messages: [{
        role: 'user',
        content: `请将以下内容翻译成${languageName}。要求：
1. 只返回翻译结果，不要有任何解释或额外说明
2. 保持原文的格式和换行
3. 如果原文已经是${languageName}，请原样返回
4. 如果有多段内容用---SEPARATOR---分隔，翻译后保持相同的分隔符

原文：
${text}`
      }]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API请求失败: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

// 验证API Key是否有效
async function validateApiKey(apiKey) {
  try {
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages: [{
          role: 'user',
          content: 'Hi'
        }],
        max_tokens: 1
      })
    });

    return response.ok;
  } catch (error) {
    return false;
  }
}
