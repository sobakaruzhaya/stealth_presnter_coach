import cors from 'cors';
import express from 'express';
import { createProvider } from './providers';
import type { AnalyzeRequest } from './types';

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const provider = createProvider();

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'stealth-presenter-coach-server' });
});

app.post('/analyze', async (req, res) => {
  const body = req.body as Partial<AnalyzeRequest>;

  if (!body || typeof body.transcript !== 'string' || !body.metrics || !Array.isArray(body.events)) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }

  try {
    const analysis = await provider.analyze({
      transcript: body.transcript,
      metrics: body.metrics,
      events: body.events
    });
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown analyze error' });
  }
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Stealth Presenter Coach server listening on http://localhost:${port}`);
});
