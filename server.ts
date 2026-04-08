import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config({ override: true });

const app = express();
app.use(express.json());

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function extractJSON(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : text.trim();
}

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
    res.json(JSON.parse(extractJSON(text)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

const PORT = 3001;
app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`));
