import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  ALGERIA_REGIONS,
  buildRegionalReferenceSnapshot,
  type AlgeriaMarketSnapshot,
  type AlgeriaMaterialPrice,
  type AlgeriaRegion,
  type GroundingSourceLink,
} from './src/data/algeriaMarketPrices.ts';
import {
  SKETCH_FURNITURE_PRESETS,
  sanitizeGeneratedFloorPlan,
} from './src/utils/sketchSanitizer.ts';

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
  app.use(express.json({ limit: '15mb' }));

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

  app.post('/api/sketch-to-plan', async (req, res) => {
    try {
      const body = (req.body || {}) as {
        imageBase64?: string;
        mimeType?: string;
        approxWidthM?: number;
        approxDepthM?: number;
        wallHeight?: number;
        includeFurniture?: boolean;
        projectTitle?: string;
      };

      const rawB64 = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : '';
      if (!rawB64 || rawB64.length < 100) {
        res.status(400).json({ error: 'يرجى إرفاق صورة صالحة للورقة المرسومة.' });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        res.status(503).json({
          code: 'MISSING_API_KEY',
          error:
            'مفتاح التحليل الذكي غير متاح حالياً في هذا التشغيل. يمكنك إدراج الصورة كخلفية شفافة للرسم اليدوي مباشرة داخل مساحة العمل 2D.',
        });
        return;
      }

      const mimeType =
        typeof body.mimeType === 'string' && body.mimeType.startsWith('image/')
          ? body.mimeType
          : 'image/jpeg';

      const cleanBase64 = rawB64.includes(',') ? rawB64.split(',').pop() || '' : rawB64;

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const allowedFurnitureKeys = Object.keys(SKETCH_FURNITURE_PRESETS).join(', ');
      const dimInstruction =
        body.approxWidthM && body.approxDepthM
          ? `استخدم الأبعاد الكلية المطلوبة من المستخدم تقريباً: العرض الكلي ≈ ${body.approxWidthM} متر، والطول/العمق الكلي ≈ ${body.approxDepthM} متر.`
          : `استنتج الأبعاد الواقعية بالمتر من الأرقام المكتوبة على الورقة إن وجدت، وإلا قدّر أبعاداً منطقية لمسكن جزائري (عادة 8×8 م إلى 16×12 م).`;

      const furnitureInstruction =
        body.includeFurniture === false
          ? 'أرجع مصفوفة furniture فارغة [].'
          : `أضف قطع الأثاث والتجهيزات المناسبة لكل غرفة (أو المرسومة على الورقة) مستخدماً فقط القيم المسموحة في type: [${allowedFurnitureKeys}]، مع وضع كل قطعة داخل حدود غرفتها.`;

      const promptText = `أنت مهندس معماري جزائري خبير في قراءة المخططات اليدوية المرسومة على الورق (Sketches) وتحويلها إلى مخططات هندسية رقمية دقيقة ثنائية وثلاثية الأبعاد.

حلّل هذه الصورة لمخطط مرسوم على ورقة، واستخرج منها جميع الغرف والجدران والأبواب والنوافذ والأثاث بأقصى دقة هندسية ممكنة:
1. ${dimInstruction}
2. ضع المخطط متمركزاً حول نقطة الأصل (0, 0) بحيث تمتد الإحداثيات من حوالي (-totalWidthM/2, -totalDepthM/2) إلى (+totalWidthM/2, +totalDepthM/2).
3. تأكد أن الغرف متلاصقة بدون تداخل غير منطقي، وأن إحداثيات الجدران (walls) تطابق حدود الغرف والفواصل الداخلية بدقة (بالمضاعف 0.25 متر).
4. حدد الأبواب (door) والنوافذ (window) والأقواس (arch) بدقة على الجدران عبر wallIndex (رقم الفهرس بدءاً من 0 في مصفوفة walls) و offsetRatio بين 0.15 و 0.85.
5. استخرج أسماء الغرف المكتوبة على الورقة بالعربية أو الفرنسية واترجمها إلى العربية الواضحة (مثل: غرفة المعيشة، صالون الضيوف، مطبخ، غرفة نوم 1، حمام، مرحاض، رواق، فناء).
6. ${furnitureInstruction}`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
            {
              text: promptText,
            },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: 'اسم وصفي قصير للمخطط بالعربية' },
              notes: { type: Type.STRING, description: 'ملخص موجز بالعربية للغرف والتقسيم المستخلص' },
              totalWidthM: { type: Type.NUMBER, description: 'العرض الإجمالي للمبنى بالمتر' },
              totalDepthM: { type: Type.NUMBER, description: 'العمق الإجمالي للمبنى بالمتر' },
              rooms: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    x: { type: Type.NUMBER, description: 'الحافة اليسرى بالمتر' },
                    z: { type: Type.NUMBER, description: 'الحافة العلوية بالمتر' },
                    width: { type: Type.NUMBER, description: 'عرض الغرفة بالمتر' },
                    depth: { type: Type.NUMBER, description: 'عمق الغرفة بالمتر' },
                    floorStyle: {
                      type: Type.STRING,
                      description: 'أحد القيم: oak, walnut, marble, tile, concrete, terrazzo, carpet',
                    },
                  },
                  required: ['name', 'x', 'z', 'width', 'depth'],
                },
              },
              walls: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    x1: { type: Type.NUMBER },
                    z1: { type: Type.NUMBER },
                    x2: { type: Type.NUMBER },
                    z2: { type: Type.NUMBER },
                    isExterior: { type: Type.BOOLEAN },
                  },
                  required: ['x1', 'z1', 'x2', 'z2'],
                },
              },
              openings: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    wallIndex: { type: Type.INTEGER },
                    type: { type: Type.STRING, description: 'door | window | arch' },
                    offsetRatio: { type: Type.NUMBER, description: '0.15 to 0.85' },
                    width: { type: Type.NUMBER },
                  },
                  required: ['wallIndex', 'type', 'offsetRatio', 'width'],
                },
              },
              furniture: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING },
                    name: { type: Type.STRING },
                    x: { type: Type.NUMBER },
                    z: { type: Type.NUMBER },
                    rotationDeg: { type: Type.INTEGER },
                  },
                  required: ['type', 'x', 'z'],
                },
              },
            },
            required: ['title', 'rooms', 'walls'],
          },
        },
      });

      const parsed = extractJsonObject(response.text || '');
      if (!parsed) {
        res.status(422).json({
          error: 'تعذر قراءة تفاصيل المخطط من الصورة. تأكد من وضوح الخطوط والإضاءة وأعد المحاولة.',
        });
        return;
      }

      const sanitized = sanitizeGeneratedFloorPlan(parsed, {
        wallHeight: body.wallHeight,
        approxWidthM: body.approxWidthM,
        approxDepthM: body.approxDepthM,
        includeFurniture: body.includeFurniture,
        requestedTitle: body.projectTitle,
      });

      res.json({
        ok: true,
        ...sanitized,
      });
    } catch (err) {
      console.error('Sketch-to-plan conversion error:', err);
      res.status(500).json({
        error:
          err instanceof Error
            ? `تعذر تحليل صورة الورقة: ${err.message}`
            : 'حدث خطأ أثناء تحويل صورة الورقة إلى مخطط هندسي.',
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
