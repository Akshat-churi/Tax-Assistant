// api/chat.js
// Vercel Serverless Function to proxy chat requests to Gemini API

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
  }

  try {
    const { contents } = req.body;
    const API_KEY = process.env.GEMINI_API_KEY;

    if (!API_KEY) {
      return res.status(500).json({ error: { message: "GEMINI_API_KEY is not configured in Vercel environment variables." } });
    }

    const MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

    const apiResponse = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    });

    const data = await apiResponse.json();

    if (!apiResponse.ok) {
      return res.status(apiResponse.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error in Vercel serverless function:', error);
    return res.status(500).json({ error: { message: "Internal Server Error" } });
  }
}
