export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "No text provided" });

    const response = await fetch(process.env.ZAPIER_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });

    const data = await response.json();
    res.status(200).json({ success: true, data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
