import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.post('/api/workflow-edit', async (req, res) => {
  try {
    const { system, messages } = req.body;
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      system,
      messages,
    });
    const text = response.content.find((b) => b.type === 'text')?.text || '{}';
    res.json(JSON.parse(text));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/scope-suggestions', async (req, res) => {
  try {
    const { prompt } = req.body;
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content.find((b) => b.type === 'text')?.text || '[]';
    res.json(JSON.parse(text));
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

const PORT = 3001;
app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`));
