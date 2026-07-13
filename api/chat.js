/**
 * API Route: /api/chat
 * Model: IBM Granite 3.0 8B via IBM watsonx.ai
 *
 * Flow:
 *  1. Exchange IBM API key → IAM access token
 *  2. Call watsonx.ai with IBM Granite model
 *  3. Return response to frontend
 *
 * Required Vercel env variables:
 *   IBM_API_KEY      → your IBM Cloud API key
 *   IBM_PROJECT_ID   → your watsonx.ai project ID
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.IBM_API_KEY || !process.env.IBM_PROJECT_ID) {
    console.error('❌ IBM_API_KEY or IBM_PROJECT_ID not set in environment variables');
    return res.status(500).json({ error: 'IBM credentials are not configured.' });
  }

  try {
    const { system, messages, max_tokens } = req.body;

    // ── STEP 1: Exchange IBM API key for IAM access token ──────────────────
    console.log('🔑 Getting IBM IAM access token...');

    const iamRes = await fetch('https://iam.cloud.ibm.com/identity/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${process.env.IBM_API_KEY}`,
    });

    const iamData = await iamRes.json();

    if (!iamData.access_token) {
      console.error('❌ IAM token error:', JSON.stringify(iamData).substring(0, 300));
      return res.status(401).json({ error: 'Failed to authenticate with IBM Cloud. Check your IBM_API_KEY.' });
    }

    console.log('✅ IAM token obtained');

    // ── STEP 2: Build messages for IBM Granite ─────────────────────────────
    const chatMessages = [];
    if (system) chatMessages.push({ role: 'system', content: system });
    chatMessages.push(...messages);

    // ── STEP 3: Call IBM Granite via watsonx.ai ────────────────────────────
    console.log('📤 Calling IBM Granite 3.0 via watsonx.ai...');

    const watsonRes = await fetch(
      'https://us-south.ml.cloud.ibm.com/ml/v1/text/chat?version=2023-05-29',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${iamData.access_token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          model_id: 'ibm/granite-3-8b-instruct',
          project_id: process.env.IBM_PROJECT_ID,
          messages: chatMessages,
          max_tokens: max_tokens || 4000,
          temperature: 0.7,
        }),
      }
    );

    const rawText = await watsonRes.text();
    console.log('📥 watsonx status:', watsonRes.status);
    console.log('📥 watsonx preview:', rawText.substring(0, 400));

    let watsonData;
    try {
      watsonData = JSON.parse(rawText);
    } catch {
      console.error('❌ JSON parse error:', rawText.substring(0, 300));
      return res.status(500).json({ error: 'Invalid response from watsonx.ai' });
    }

    if (!watsonRes.ok || watsonData.error) {
      const errMsg = watsonData.error?.message || watsonData.message || JSON.stringify(watsonData).substring(0, 300);
      console.error('❌ watsonx.ai error:', errMsg);
      return res.status(watsonRes.status || 400).json({ error: errMsg });
    }

    // Extract text from response
    const text = watsonData.choices?.[0]?.message?.content
               || watsonData.results?.[0]?.generated_text;

    if (!text) {
      console.error('❌ No text in watsonx response:', JSON.stringify(watsonData).substring(0, 300));
      return res.status(500).json({ error: 'No response text from IBM Granite.' });
    }

    console.log('✅ IBM Granite responded successfully');

    // Return in same format frontend expects — no frontend changes needed
    return res.status(200).json({
      content: [{ type: 'text', text }],
    });

  } catch (error) {
    console.error('❌ Handler error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
