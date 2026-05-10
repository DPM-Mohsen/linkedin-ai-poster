export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  try {
    const { topic, tone, hook, length, hashtags, sfctx } = req.body;
    const lengthMap = { short:"~150 words", medium:"~250 words", long:"~400 words" };
    const prompt = `You are a LinkedIn content strategist for B2B SaaS. Write a high-performing LinkedIn post for a Salesforce Product Manager.

Topic: ${topic}
${sfctx ? `Salesforce context: ${sfctx}` : ""}
Tone: ${tone}
Hook style: ${hook} — make the first line impossible to scroll past
Length: ${lengthMap[length] || "~250 words"}
Hashtags: ${hashtags === "0" ? "No hashtags" : hashtags + " relevant hashtags at the very end"}

Rules:
- First line = powerful hook using ${hook} style
- Short paragraphs (1-3 lines) for LinkedIn readability
- Share a genuine insight, not generic advice
- End with a question or CTA to spark comments
- Write in first person, sound authentically human
- No subject line or title — just the post body
- Hashtags only at the very end if requested

Return ONLY the post text, nothing else.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    const post = data.content?.map(b => b.text || "").join("") || "";
    res.status(200).json({ post });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
