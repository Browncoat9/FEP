module.exports = async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { description } = req.body;

  if (!description || description.trim().length < 10) {
    return res.status(400).json({ error: 'Please provide a project description.' });
  }

  const prompt = `You are an experienced project risk analyst. Given the project description below, generate a risk register with 6-8 realistic risks.

Return ONLY a valid JSON array — no explanation, no markdown, just the raw JSON.

Each risk object must have exactly these fields:
- "id": risk ID string e.g. "R01"
- "risk": a clear, specific risk description (1-2 sentences)
- "category": one of: Technical, Resource, Timeline, Scope, Stakeholder, Budget, Compliance
- "likelihood": one of: High, Medium, Low
- "impact": one of: High, Medium, Low
- "mitigation": a concrete mitigation strategy (1-2 sentences)

Project description:
${description.trim()}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('Anthropic API error:', err);
      return res.status(502).json({ error: 'AI service error. Please try again.' });
    }

    const data = await response.json();
    const text = data.content[0].text.trim();

    // Strip markdown code fences if present
    const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    const risks = JSON.parse(cleaned);

    return res.status(200).json({ risks });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
