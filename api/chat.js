export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { message: "Method not allowed" } });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: { message: "GROQ_API_KEY is not configured in Vercel environment variables." } });
  }

  try {
    const { system, messages, max_tokens } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: { message: "A non-empty messages array is required." } });
    }
    if (messages.some(message => !message || !["user", "assistant"].includes(message.role) || typeof message.content !== "string")) {
      return res.status(400).json({ error: { message: "Each message must have a valid role and text content." } });
    }

    const chatMessages = [];
    if (typeof system === "string" && system.trim()) chatMessages.push({ role: "system", content: system });
    chatMessages.push(...messages);

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        max_tokens: Number.isInteger(max_tokens) ? Math.min(Math.max(max_tokens, 1), 4000) : 4000,
        messages: chatMessages,
      }),
    });

    const data = await response.json();
    if (!response.ok || data.error) {
      const message = data.error?.message || `Groq request failed with status ${response.status}.`;
      return res.status(response.status >= 400 && response.status < 600 ? response.status : 502)
        .json({ error: { message } });
    }

    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      return res.status(502).json({ error: { message: "The AI provider returned an empty response." } });
    }

    return res.status(200).json({ content: [{ type: "text", text: content }] });
  } catch (error) {
    console.error("/api/chat error:", error);
    return res.status(500).json({ error: { message: "An unexpected server error occurred. Please try again." } });
  }
}
