import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import {
  ALGERIA_REGIONS,
  buildRegionalReferenceSnapshot,
  type AlgeriaMarketSnapshot,
  type AlgeriaMaterialPrice,
  type AlgeriaRegion,
  type GroundingSourceLink,
} from './src/data/algeriaMarketPrices.ts';

const PORT = Number(process.env.PORT) || 3000;
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours auto-refresh window
const priceCache = new Map<AlgeriaRegion, { snapshot: AlgeriaMarketSnapshot; expiresAt: number }>();

function normalizeRegion(raw: unknown): AlgeriaRegion {
  if (raw === 'east' || raw === 'west' || raw === 'south') return raw;
  return 'center';
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const fenced = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function fetchLiveAlgeriaPrices(region: AlgeriaRegion): Promise<AlgeriaMarketSnapshot> {
  const fallback = buildRegionalReferenceSnapshot(region);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return fallback;
  }

  const regionMeta = ALGERIA_REGIONS.find((r) => r.id === region) || ALGERIA_REGIONS[0];
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const itemDescriptors = fallback.prices
    .map((p) => `- ${p.id}: ${p.name} (الوحدة: ${p.unit}، المرجع التقريبي: ${p.priceDzd} دج)`)
    .join('\n');

  const prompt = `ابحث في الويب عن أحدث أسعار مواد البناء والدهن والسيراميك واليد العاملة المتداولة حالياً في السوق الجزائري (بالدينار الجزائري DZD) لمنطقة ${regionMeta.label} (${regionMeta.wilayasSample}).
أرجع النتيجة بصيغة JSON صالحة فقط بدون أي نص إضافي خارج كود JSON، وفق الهيكل التالي:
{
  "marketSummary": "ملخص قصير بالعربية لحالة السوق والأسعار اليوم في هذه المنطقة",
  "prices": [
    {
      "id": "cement_bag",
      "priceDzd": 900,
      "minPriceDzd": 850,
      "maxPriceDzd": 980,
      "trend": "stable",
      "notes": "ملاحظة موجزة عن السعر أو العلامات المتوفرة بالجزائر"
    }
  ]
}
استخدم المعرفات التالية بدقة:
${itemDescriptors}
تأكد أن جميع الأسعار بالدينار الجزائري الصحيح (وليس بالسنتيم) وأن trend هو أحد القيم: "up" أو "stable" أو "down".`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const parsed = extractJsonObject(response.text || '');
    const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const sources: GroundingSourceLink[] = [];
    if (Array.isArray(rawChunks)) {
      const seen = new Set<string>();
      for (const chunk of rawChunks) {
        const web = (chunk as { web?: { uri?: string; title?: string } }).web;
        if (web?.uri && !seen.has(web.uri)) {
          seen.add(web.uri);
          sources.push({
            uri: web.uri,
            title: web.title || web.uri,
          });
        }
      }
    }

    if (!parsed || !Array.isArray(parsed.prices)) {
      return {
        ...fallback,
        sources: sources.slice(0, 6),
      };
    }

    const incomingMap = new Map<string, Record<string, unknown>>();
    for (const entry of parsed.prices) {
      if (entry && typeof entry === 'object' && typeof (entry as { id?: unknown }).id === 'string') {
        incomingMap.set((entry as { id: string }).id, entry as Record<string, unknown>);
      }
    }

    const mergedPrices: AlgeriaMaterialPrice[] = fallback.prices.map((baseItem) => {
      const inc = incomingMap.get(baseItem.id);
      if (!inc) return baseItem;

      // Guardrail: keep values within reasonable bounds (0.4x .. 2.5x reference) to avoid unit/centime mixups
      const rawPrice = Number(inc.priceDzd);
      const validPrice =
        Number.isFinite(rawPrice) &&
        rawPrice >= baseItem.priceDzd * 0.4 &&
        rawPrice <= baseItem.priceDzd * 2.5
          ? Math.round(rawPrice)
          : baseItem.priceDzd;

      const rawMin = Number(inc.minPriceDzd);
      const validMin =
        Number.isFinite(rawMin) && rawMin >= baseItem.priceDzd * 0.3 && rawMin <= validPrice
          ? Math.round(rawMin)
          : Math.min(baseItem.minPriceDzd, validPrice);

      const rawMax = Number(inc.maxPriceDzd);
      const validMax =
        Number.isFinite(rawMax) && rawMax >= validPrice && rawMax <= baseItem.priceDzd * 3
          ? Math.round(rawMax)
          : Math.max(baseItem.maxPriceDzd, validPrice);

      const trend =
        inc.trend === 'up' || inc.trend === 'down' || inc.trend === 'stable'
          ? inc.trend
          : baseItem.trend;

      const notes =
        typeof inc.notes === 'string' && inc.notes.trim().length > 2
          ? inc.notes.trim().slice(0, 140)
          : baseItem.notes;

      return {
        ...baseItem,
        priceDzd: validPrice,
        minPriceDzd: validMin,
        maxPriceDzd: validMax,
        trend,
        notes,
      };
    });

    const now = new Date();
    const nextRefresh = new Date(now.getTime() + CACHE_TTL_MS);
    const summary =
      typeof parsed.marketSummary === 'string' && parsed.marketSummary.trim().length > 5
        ? parsed.marketSummary.trim().slice(0, 320)
        : fallback.marketSummary;

    return {
      region,
      sourceMode: 'live_search',
      updatedAtIso: now.toISOString(),
      nextAutoRefreshIso: nextRefresh.toISOString(),
      marketSummary: summary,
      prices: mergedPrices,
      sources: sources.slice(0, 6),
    };
  } catch (err) {
    console.error('Failed to fetch live Algeria market prices via Gemini Search grounding:', err);
    return fallback;
  }
}

async function getMarketSnapshot(region: AlgeriaRegion, forceRefresh: boolean): Promise<AlgeriaMarketSnapshot> {
  const existing = priceCache.get(region);
  const now = Date.now();
  if (!forceRefresh && existing && existing.expiresAt > now) {
    return existing.snapshot;
  }
  const snapshot = await fetchLiveAlgeriaPrices(region);
  priceCache.set(region, {
    snapshot,
    expiresAt: now + CACHE_TTL_MS,
  });
  return snapshot;
}

interface ServerSubscriberRecord {
  id: string;
  displayName: string;
  username: string;
  password: string;
  proActive: boolean;
  proPlan: 'free' | 'monthly' | 'annual';
  active: boolean;
  expiresAtMs: number | null;
  phone?: string;
  notes?: string;
  createdAtMs: number;
  isUniversalPasskey?: boolean;
}

const SUBSCRIBERS_DIR = path.resolve(process.cwd(), '.data');
const SUBSCRIBERS_FILE = path.join(SUBSCRIBERS_DIR, 'subscribers.json');

function readServerSubscribers(): ServerSubscriberRecord[] {
  try {
    if (!fs.existsSync(SUBSCRIBERS_FILE)) return [];
    const raw = fs.readFileSync(SUBSCRIBERS_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as ServerSubscriberRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeServerSubscribers(list: ServerSubscriberRecord[]): void {
  try {
    fs.mkdirSync(SUBSCRIBERS_DIR, { recursive: true });
    fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch {
    // Ignore write failures in read-only containers
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/subscribers', (_req, res) => {
    res.json({ subscribers: readServerSubscribers() });
  });

  app.post('/api/subscribers', (req, res) => {
    const incoming = req.body as Partial<ServerSubscriberRecord>;
    if (!incoming?.username || !incoming?.password) {
      res.status(400).json({ error: 'اسم المستخدم والرقم السري مطلوبان.' });
      return;
    }
    const cleanUsername = String(incoming.username).trim();
    const list = readServerSubscribers();
    const record: ServerSubscriberRecord = {
      id: String(incoming.id || `sub_${Date.now()}`),
      displayName: String(incoming.displayName || cleanUsername).trim().slice(0, 120),
      username: cleanUsername.slice(0, 120),
      password: String(incoming.password).trim().slice(0, 120),
      proActive: Boolean(incoming.proActive),
      proPlan:
        incoming.proPlan === 'annual' || incoming.proPlan === 'monthly'
          ? incoming.proPlan
          : 'free',
      active: incoming.active !== false,
      expiresAtMs: typeof incoming.expiresAtMs === 'number' ? incoming.expiresAtMs : null,
      phone: incoming.phone ? String(incoming.phone).slice(0, 30) : undefined,
      notes: incoming.notes ? String(incoming.notes).slice(0, 240) : undefined,
      createdAtMs: typeof incoming.createdAtMs === 'number' ? incoming.createdAtMs : Date.now(),
      isUniversalPasskey: Boolean(incoming.isUniversalPasskey),
    };
    const idx = list.findIndex(
      (s) => s.id === record.id || s.username.toLowerCase() === cleanUsername.toLowerCase()
    );
    const next = idx >= 0 ? list.map((s, i) => (i === idx ? record : s)) : [record, ...list];
    writeServerSubscribers(next);
    res.json({ ok: true, subscriber: record });
  });

  app.delete('/api/subscribers/:id', (req, res) => {
    const id = req.params.id;
    const next = readServerSubscribers().filter((s) => s.id !== id);
    writeServerSubscribers(next);
    res.json({ ok: true });
  });

  app.post('/api/subscribers/login', (req, res) => {
    const { username, password } = (req.body || {}) as { username?: string; password?: string };
    const cleanUser = String(username || '').trim().toLowerCase();
    const cleanPass = String(password || '').trim();
    const list = readServerSubscribers();
    const found = list.find((s) => s.username.trim().toLowerCase() === cleanUser);
    if (!found) {
      res.status(404).json({ ok: false });
      return;
    }
    if (found.password !== cleanPass && found.password.toUpperCase() !== cleanPass.toUpperCase()) {
      res.status(403).json({ ok: false, error: 'الرقم السري غير صحيح.' });
      return;
    }
    if (!found.active) {
      res.status(403).json({ ok: false, error: 'تم تعطيل هذا الحساب من طرف الإدارة.' });
      return;
    }
    if (found.expiresAtMs && Date.now() > found.expiresAtMs) {
      res.status(403).json({ ok: false, error: 'انتهت مدة صلاحية هذا الحساب.' });
      return;
    }
    res.json({ ok: true, subscriber: found });
  });

  app.get('/api/algeria-market-prices', async (req, res) => {
    const region = normalizeRegion(req.query.region);
    const force = req.query.force === '1' || req.query.force === 'true';
    try {
      const snapshot = await getMarketSnapshot(region, force);
      res.json(snapshot);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'تعذر جلب أسعار السوق الجزائري.',
        fallback: buildRegionalReferenceSnapshot(region),
      });
    }
  });

  // Periodic background refresh for any regions cached by users
  const refreshTimer = setInterval(() => {
    for (const region of priceCache.keys()) {
      void getMarketSnapshot(region, true);
    }
  }, CACHE_TTL_MS);
  refreshTimer.unref();

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
