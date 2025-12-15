import cors from 'cors';
import dotenv from 'dotenv';
import express, { type Request, type Response } from 'express';
import { z } from 'zod';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const detectorRequestSchema = z
  .object({
    mediaType: z.enum(['image', 'video']),
    url: z.string().url().optional(),
    base64: z.string().min(1).optional(),
  })
  .refine((data) => data.url || data.base64, {
    message: 'Debes enviar "url" o "base64" para analizar el archivo.',
    path: ['url'],
  });

type DetectorRequest = z.infer<typeof detectorRequestSchema>;

const DETECTOR_API_URL = process.env.DETECTOR_API_URL ?? '';
const DETECTOR_API_KEY = process.env.DETECTOR_API_KEY ?? '';

if (!DETECTOR_API_URL) {
  throw new Error('Falta la variable de entorno DETECTOR_API_URL.');
}

if (!DETECTOR_API_KEY) {
  throw new Error('Falta la variable de entorno DETECTOR_API_KEY.');
}

const SCORE_THRESHOLD = Number(process.env.AI_PERCENTAGE_THRESHOLD ?? 5);

function normalizeProbability(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error('El puntaje de IA no es un número.');
  }

  if (value < 0) {
    throw new Error('El puntaje de IA no puede ser negativo.');
  }

  if (value <= 1) {
    return Number((value * 100).toFixed(2));
  }

  if (value <= 100) {
    return Number(value.toFixed(2));
  }

  throw new Error('El puntaje de IA debe estar entre 0 y 100.');
}

function extractAiProbability(detectorResponse: unknown): number {
  const response = detectorResponse as Record<string, unknown>;

  const candidates: Array<number | undefined> = [
    response.ai_probability as number | undefined,
    response.aiProbability as number | undefined,
    response.score as number | undefined,
    response.confidence as number | undefined,
    (response.result as Record<string, unknown> | undefined)?.score as number | undefined,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'number') {
      return normalizeProbability(candidate);
    }
  }

  const tasks = (response.tasks as Array<Record<string, unknown>>) ?? [];
  for (const task of tasks) {
    const score = task.score as number | undefined;
    if (typeof score === 'number') {
      return normalizeProbability(score);
    }
  }

  const models = (response.models as Array<Record<string, unknown>>) ?? [];
  for (const model of models) {
    const score = model.score as number | undefined;
    if (typeof score === 'number') {
      return normalizeProbability(score);
    }
  }

  throw new Error('No se pudo extraer el puntaje de IA de la respuesta del detector.');
}

async function callDetectorApi(payload: DetectorRequest) {
  const body = {
    media_type: payload.mediaType,
    url: payload.url,
    base64: payload.base64,
  };

  const response = await fetch(DETECTOR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DETECTOR_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error del detector (${response.status}): ${errorText}`);
  }

  return response.json();
}

app.post('/api/analyze', async (req: Request, res: Response) => {
  const parseResult = detectorRequestSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Solicitud inválida.',
      details: parseResult.error.flatten(),
    });
  }

  try {
    const detectorResponse = await callDetectorApi(parseResult.data);
    const aiPercentage = extractAiProbability(detectorResponse);
    const isAi = aiPercentage > SCORE_THRESHOLD;

    return res.json({
      verdict: isAi ? `ES IA (${aiPercentage}%)` : `NO ES IA (${aiPercentage}%)`,
      aiPercentage,
      threshold: SCORE_THRESHOLD,
      detectorResponse,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return res.status(502).json({ error: message });
  }
});

const PORT = Number(process.env.PORT ?? 3000);
app.listen(PORT, () => {
  console.log(`Servidor iniciado en el puerto ${PORT}`);
});

