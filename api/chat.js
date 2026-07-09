export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY is not configured.' });
  }

  try {
    const { system, messages, max_tokens } = req.body;

    // Convert Anthropic-style {system, messages} → Groq/OpenAI format
    const groqMessages = [];
    if (system) {
      groqMessages.push({ role: 'system', content: system });
    }
    groqMessages.push(...messages);

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',   // fast + free on Groq
        max_tokens: max_tokens || 1000,
        messages: groqMessages,
      }),
    });

    const data = await response.json();

    if (data.error) {
      return res.status(400).json({ error: data.error.message });
    }

    // Return in Anthropic-style format so the frontend needs zero changes
    return res.status(200).json({
      content: [{ type: 'text', text: data.choices[0].message.content }],
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
