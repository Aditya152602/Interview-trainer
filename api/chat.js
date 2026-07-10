export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.HF_API_KEY) {
    console.error('❌ HF_API_KEY is not set in environment variables');
    return res.status(500).json({ error: 'HF_API_KEY is not configured.' });
  }

  try {
    const { system, messages, max_tokens } = req.body;

    // Build messages array
    const chatMessages = [];
    if (system) chatMessages.push({ role: 'system', content: system });
    chatMessages.push(...messages);

    console.log('📤 Calling IBM Granite via HuggingFace...');

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
          temperature: 0.7,
        }),
      }
    );

    // Read raw response text first for better debugging
    const rawText = await response.text();
    console.log('📥 HF Status:', response.status);
    console.log('📥 HF Response:', rawText.substring(0, 500));

    // Parse JSON
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      console.error('❌ Failed to parse HF response as JSON:', rawText.substring(0, 300));
      return res.status(500).json({ error: `Invalid response from HuggingFace: ${rawText.substring(0, 200)}` });
    }

    // Handle HF errors (e.g. model loading, rate limits)
    if (data.error) {
      console.error('❌ HuggingFace API error:', data.error);

      // Model is loading — tell frontend to retry
      if (
        typeof data.error === 'string' &&
        data.error.toLowerCase().includes('loading')
      ) {
        return res.status(503).json({ error: 'Model is loading, please try again in 20 seconds.' });
      }

      return res.status(400).json({ error: data.error });
    }

    if (!response.ok) {
      console.error('❌ HF returned non-OK status:', response.status);
      return res.status(response.status).json({ error: `HuggingFace API error: HTTP ${response.status}` });
    }

    if (!data.choices || !data.choices[0]) {
      console.error('❌ Unexpected response shape:', JSON.stringify(data).substring(0, 300));
      return res.status(500).json({ error: 'Unexpected response format from HuggingFace.' });
    }

    console.log('✅ IBM Granite responded successfully');

    // Return in Anthropic-style format — frontend needs zero changes
    return res.status(200).json({
      content: [{ type: 'text', text: data.choices[0].message.content }],
    });

  } catch (error) {
    console.error('❌ Handler error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
