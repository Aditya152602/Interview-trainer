export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.HF_API_KEY) {
    console.error('❌ HF_API_KEY is not set');
    return res.status(500).json({ error: 'HF_API_KEY is not configured.' });
  }

  try {
    const { system, messages } = req.body;
    const userMessage = messages[messages.length - 1].content;

    // IBM Granite 3.0 chat template format
    const prompt =
      `<|start_of_role|>system<|end_of_role|>${system || "You are a helpful assistant."}<|end_of_text|>\n` +
      `<|start_of_role|>user<|end_of_role|>${userMessage}<|end_of_text|>\n` +
      `<|start_of_role|>assistant<|end_of_role|>`;

    console.log('📤 Calling IBM Granite 3.0 via HuggingFace...');

    // Using basic text-generation endpoint (not /v1/chat/completions)
    // granite-3.0-8b-instruct is available on HuggingFace free serverless inference
    const response = await fetch(
      'https://api-inference.huggingface.co/models/ibm-granite/granite-3.0-8b-instruct',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HF_API_KEY}`,
          'Content-Type': 'application/json',
          'x-wait-for-model': 'true',   // wait for cold start instead of failing
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: 3000,
            return_full_text: false,
            temperature: 0.7,
            do_sample: true,
          },
        }),
      }
    );

    const rawText = await response.text();
    console.log('📥 HF Status:', response.status);
    console.log('📥 HF Preview:', rawText.substring(0, 400));

    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error('❌ JSON parse failed:', rawText.substring(0, 200));
      return res.status(500).json({ error: `Parse error: ${rawText.substring(0, 200)}` });
    }

    // Handle HF errors
    if (data.error) {
      const errMsg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
      console.error('❌ HF error:', errMsg);
      return res.status(400).json({ error: errMsg });
    }

    // Extract generated text
    const generatedText = Array.isArray(data)
      ? data[0]?.generated_text
      : data?.generated_text;

    if (!generatedText) {
      console.error('❌ No text in response:', JSON.stringify(data).substring(0, 200));
      return res.status(500).json({ error: 'No text returned from IBM Granite.' });
    }

    console.log('✅ IBM Granite 3.0 responded successfully');

    // Return in same format frontend expects — no frontend changes needed
    return res.status(200).json({
      content: [{ type: 'text', text: generatedText }],
    });

  } catch (error) {
    console.error('❌ Handler error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
