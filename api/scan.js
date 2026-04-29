export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { base64, mime } = req.body || {};
  if (!base64 || !mime) return res.status(400).json({ error: "Missing base64 or mime" });

  const key = process.env.GEMINI_KEY;
  if (!key) return res.status(500).json({ error: "GEMINI_KEY not set in environment" });

  const prompt = `You are reading a CBC / Hematology lab report from a photograph. Extract the numeric measured values (NOT reference ranges) for these parameters.

Return ONLY a JSON object using these exact keys, with null for any value you cannot read clearly:

{
  "HGB": number | null,
  "TLC": number | null,
  "NEUT": number | null,
  "LYMPH": number | null,
  "MONO": number | null,
  "EOS": number | null,
  "BASO": number | null,
  "OTHER": number | null,
  "RBC": number | null,
  "HCT": number | null,
  "MCV": number | null,
  "MCH": number | null,
  "MCHC": number | null,
  "RDW_CV": number | null,
  "RDW_SV": number | null,
  "PLT": number | null,
  "MPV": number | null,
  "PDW": number | null,
  "PCT": number | null
}

No markdown, no explanation. Pure JSON only.`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: base64 } }] }],
          generationConfig: { temperature: 0, responseMimeType: "application/json" }
        })
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => "");
      return res.status(geminiRes.status).json({ error: `Gemini ${geminiRes.status}: ${errText.slice(0, 200)}` });
    }

    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(500).json({ error: "Empty response from Gemini" });

    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
