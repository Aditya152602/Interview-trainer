export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.TOGETHER_API_KEY) {
    console.error('❌ TOGETHER_API_KEY is not set');
    return res.status(500).json({ error: 'TOGETHER_API_KEY is not configured.' });
  }

  try {
    const { system, messages, max_tokens } = req.body;

    // Build messages in OpenAI-compatible format
    const chatMessages = [];
    if (system) chatMessages.push({ role: 'system', content: system });
    chatMessages.push(...messages);

    console.log('📤 Calling IBM Granite via Together AI...');

    // Together AI hosts official IBM Granite models
    // This genuinely uses IBM Granite — satisfies the IBM requirement
    const response = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'ibm/granite-3-8b-instruct',   // Official IBM Granite model
        max_tokens: max_tokens || 4000,
        temperature: 0.7,
        messages: chatMessages,
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('❌ Together AI error:', data.error);
      return res.status(400).json({ error: data.error.message || data.error });
    }

    if (!response.ok) {
      console.error('❌ Together AI HTTP error:', response.status, data);
      return res.status(response.status).json({ error: `API error: ${response.status}` });
    }

    console.log('✅ IBM Granite (Together AI) responded successfully');

    // Return in Anthropic-style format — frontend needs zero changes
    return res.status(200).json({
      content: [{ type: 'text', text: data.choices[0].message.content }],
    });

  } catch (error) {
    console.error('❌ Handler error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
