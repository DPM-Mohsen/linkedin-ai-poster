export async function POST(req) {
  try {
    const { text } = await req.json();
    if (!text?.trim()) return Response.json({ error: "No text provided" }, { status: 400 });

    const webhookUrl = process.env.ZAPIER_WEBHOOK_URL;
    if (!webhookUrl) return Response.json({ error: "Zapier webhook not configured" }, { status: 500 });

    // Server-side fetch to Zapier — no CORS issues here
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });

    const data = await res.json();
    return Response.json({ success: true, data });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
