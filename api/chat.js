export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.HF_API_KEY) {
    return res.status(500).json({ error: 'HF_API_KEY is not configured.' });
  }

  try {
    const { system, messages, max_tokens } = req.body;

    // Build messages in OpenAI-compatible format
    const chatMessages = [];
    if (system) {
      chatMessages.push({ role: 'system', content: system });
    }
    chatMessages.push(...messages);

    // IBM Granite 3.3 via HuggingFace Inference API (free, no credit card)
    // IBM officially publishes Granite on HuggingFace — same model, free access
    const response = await fetch(
      'https://api-inference.huggingface.co/models/ibm-granite/granite-3.3-8b-instruct/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HF_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'ibm-granite/granite-3.3-8b-instruct',
          messages: chatMessages,
          max_tokens: max_tokens || 4000,
        }),
      }
    );

    const data = await response.json();

    if (data.error) {
      return res.status(400).json({ error: data.error });
    }

    // Return in same format frontend expects — no frontend changes needed
    return res.status(200).json({
      content: [{ type: 'text', text: data.choices[0].message.content }],
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
