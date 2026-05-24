const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Proxy endpoint for Gemini API
app.post('/api/chat', async (req, res) => {
  try {
    const { contents } = req.body;
    
    if (!API_KEY) {
      return res.status(500).json({ error: { message: "API Key not configured in .env file" } });
    }

    const MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error('Error proxying chat request:', error);
    res.status(500).json({ error: { message: "Internal Server Error" } });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
