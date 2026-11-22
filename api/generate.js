// The "kitchen": runs on Vercel's server, so your secret key stays hidden.

// Change the model here if you ever need to
const MODEL = 'gemini-3.5-flash-lite';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST.' });
  }

  const body = req.body || {};
  const diet = body.diet === 'veg' ? 'veg' : 'non-veg';
  const spice = ['mild', 'medium', 'spicy'].includes(body.spice) ? body.spice : 'medium';
  const ingredients = Array.isArray(body.ingredients)
    ? body.ingredients.map(x => String(x).trim().slice(0, 40)).filter(Boolean).slice(0, 15)
    : [];

  if (ingredients.length === 0) {
    return res.status(400).json({ error: 'Please add at least one ingredient.' });
  }

  // The key comes from Vercel's settings, never from the code
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'Server key is missing.' });
  }

  // Our instruction (prompt) to the AI
  const prompt =
    'You are a friendly hostel cooking helper. Create exactly 3 DIFFERENT simple recipes a student can cook ' +
    'with basic hostel equipment (a stove or induction and a pan).\n' +
    'Diet: ' + diet + '. ' +
    (diet === 'veg' ? 'Do NOT use meat, fish or eggs.\n' : 'Meat, fish or eggs are allowed.\n') +
    'Spice level: ' + spice + '. Adjust the chilli and spices in every recipe to match this level.\n' +
    'Main ingredients the student has: ' + ingredients.join(', ') + '.\n' +
    'You may also assume basic items like salt, oil, water and common spices.\n' +
    'Return JSON in this shape: {"recipes": [ {"title": string, "time": string (approximate total cooking time ' +
    'like "20 minutes"), "ingredients": array of strings with rough quantities, "steps": array of short clear ' +
    'strings, 5 to 7 steps} ]}. The "recipes" array must have exactly 3 items. Keep everything simple and ' +
    'beginner friendly.';

  try {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      const msg = (data.error && data.error.message) || 'AI request failed.';
      return res.status(500).json({ error: msg });
    }

    // Pull the AI's text out of the reply and turn it into an object
    const text = data.candidates[0].content.parts[0].text;
    const result = JSON.parse(text);
    if (!Array.isArray(result.recipes) || result.recipes.length === 0) {
      return res.status(500).json({ error: 'The AI gave a strange answer. Please try again.' });
    }
    return res.status(200).json({ recipes: result.recipes.slice(0, 3) });
  } catch (e) {
    return res.status(500).json({ error: 'Could not generate. Please try again.' });
  }
};
