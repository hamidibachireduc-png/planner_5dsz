export type AlgeriaRegion = 'center' | 'east' | 'west' | 'south';
export type MaterialCategory = 'structure' | 'paint' | 'finishing' | 'labor';
export type FinishLevel = 'economic' | 'standard' | 'luxury';

export interface AlgeriaRegionMeta {
  id: AlgeriaRegion;
  label: string;
  wilayasSample: string;
  multiplier: number;
}

export const ALGERIA_REGIONS: AlgeriaRegionMeta[] = [
  { id: 'center', label: 'الوسط', wilayasSample: 'الجزائر، البليدة، تيبازة، بومرداس، تيزي وزو', multiplier: 1.0 },
  { id: 'east', label: 'الشرق', wilayasSample: 'قسنطينة، سطيف، عنابة، باتنة، بجاية', multiplier: 0.97 },
  { id: 'west', label: 'الغرب', wilayasSample: 'وهران، تلمسان، سيدي بلعباس، مستغانم', multiplier: 0.98 },
  { id: 'south', label: 'الجنوب', wilayasSample: 'ورقلة، غرداية، بسكرة، بشار، تمنراست', multiplier: 1.08 },
];

export const MATERIAL_CATEGORIES: { id: MaterialCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'جميع البنود' },
  { id: 'structure', label: 'البناء والهيكل' },
  { id: 'paint', label: 'الدهن والتلبيس' },
  { id: 'finishing', label: 'الأرضيات والجبس' },
  { id: 'labor', label: 'اليد العاملة' },
];

export interface AlgeriaMaterialPrice {
  id: string;
  name: string;
  category: MaterialCategory;
  unit: string;
  priceDzd: number;
  minPriceDzd: number;
  maxPriceDzd: number;
  trend: 'up' | 'stable' | 'down';
  notes: string;
}

export interface GroundingSourceLink {
  title: string;
  uri: string;
}

export interface AlgeriaMarketSnapshot {
  region: AlgeriaRegion;
  sourceMode: 'live_search' | 'reference';
  updatedAtIso: string;
  nextAutoRefreshIso: string;
  marketSummary: string;
  prices: AlgeriaMaterialPrice[];
  sources: GroundingSourceLink[];
}

export const BASE_ALGERIA_PRICES: AlgeriaMaterialPrice[] = [
  // ── Structure / Gros Œuvre ──
  {
    id: 'cement_bag',
    name: 'إسمنت رمادي CPJ 42.5',
    category: 'structure',
    unit: 'كيس 50 كغ',
    priceDzd: 900,
    minPriceDzd: 830,
    maxPriceDzd: 980,
    trend: 'stable',
    notes: 'لافارج / جيكا / بسكرة — تسليم مخازن مواد البناء',
  },
  {
    id: 'rebar_q',
    name: 'حديد التسليح (Torsadé 10/12/14)',
    category: 'structure',
    unit: 'قنطار (100 كغ)',
    priceDzd: 13800,
    minPriceDzd: 13100,
    maxPriceDzd: 14800,
    trend: 'up',
    notes: 'توسالي / بلارة AQS — السعر المتداول للقنطار',
  },
  {
    id: 'brick_8',
    name: 'آجر أحمر 8 ثقوب (بريك 8)',
    category: 'structure',
    unit: 'وحدة',
    priceDzd: 36,
    minPriceDzd: 31,
    maxPriceDzd: 44,
    trend: 'stable',
    notes: 'للقواطع والجدران الداخلية حسب الولاية والنقل',
  },
  {
    id: 'brick_12',
    name: 'آجر أحمر 12 ثقباً (بريك 12)',
    category: 'structure',
    unit: 'وحدة',
    priceDzd: 49,
    minPriceDzd: 43,
    maxPriceDzd: 58,
    trend: 'stable',
    notes: 'للواجهات الخارجية والعزل المزدوج',
  },
  {
    id: 'sand_m3',
    name: 'رمل البناء والتلييس (Oued / Concassé)',
    category: 'structure',
    unit: 'م³',
    priceDzd: 2700,
    minPriceDzd: 2200,
    maxPriceDzd: 3300,
    trend: 'stable',
    notes: 'سعر المتر المكعب شاملاً النقل القريب',
  },
  {
    id: 'gravel_m3',
    name: 'حصى الخرسانة (Gravier 8/15 - 15/25)',
    category: 'structure',
    unit: 'م³',
    priceDzd: 2500,
    minPriceDzd: 2050,
    maxPriceDzd: 3000,
    trend: 'stable',
    notes: 'محاجر البناء المعتمدة للخرسانة المسلحة',
  },

  // ── Paint & Wall Prep ──
  {
    id: 'paint_vinyl_25',
    name: 'طلاء فينيل مائي داخلي (Vinylique)',
    category: 'paint',
    unit: 'دلو 25 كغ',
    priceDzd: 5200,
    minPriceDzd: 4100,
    maxPriceDzd: 6800,
    trend: 'stable',
    notes: 'النوعية المتوسطة/الجيدة للجدران والأسقف الداخلية',
  },
  {
    id: 'paint_satin_15',
    name: 'طلاء ساتيني قابل للغسل (Satinée)',
    category: 'paint',
    unit: 'دلو 15 كغ',
    priceDzd: 9800,
    minPriceDzd: 8200,
    maxPriceDzd: 12500,
    trend: 'up',
    notes: 'مقاوم للرطوبة والغسل للمطابخ والممرات والصالون',
  },
  {
    id: 'enduit_25',
    name: 'عجينة التمليس / الأندوي (Enduit)',
    category: 'paint',
    unit: 'كيس 25 كغ',
    priceDzd: 1300,
    minPriceDzd: 1050,
    maxPriceDzd: 1600,
    trend: 'stable',
    notes: 'تجهيز وتمليس الجدران قبل الطلاء النهائي',
  },
  {
    id: 'facade_paint_25',
    name: 'طلاء واجهات خارجي مقاوم (Façade)',
    category: 'paint',
    unit: 'دلو 25 كغ',
    priceDzd: 7600,
    minPriceDzd: 6200,
    maxPriceDzd: 9500,
    trend: 'stable',
    notes: 'طلاء أكريليك خارجي مقاوم للشمس والأمطار',
  },

  // ── Flooring & Gypsum ──
  {
    id: 'ceramic_m2',
    name: 'بلاط وسيراميك أرضي (Dalle de sol)',
    category: 'finishing',
    unit: 'م²',
    priceDzd: 1900,
    minPriceDzd: 1350,
    maxPriceDzd: 3100,
    trend: 'stable',
    notes: 'إنتاج محلي ممتاز (60×60 / 45×45) أو مستورد متوسط',
  },
  {
    id: 'ciment_colle_25',
    name: 'إسمنت الغراء للسيراميك (Ciment Colle)',
    category: 'finishing',
    unit: 'كيس 25 كغ',
    priceDzd: 850,
    minPriceDzd: 720,
    maxPriceDzd: 1050,
    trend: 'stable',
    notes: 'غراء التثبيت المعزز للبلاط والفايونس',
  },
  {
    id: 'placo_ba13',
    name: 'ألواح الجبس والأسقف (Placoplâtre BA13)',
    category: 'finishing',
    unit: 'لوح (3 م²)',
    priceDzd: 1650,
    minPriceDzd: 1450,
    maxPriceDzd: 2050,
    trend: 'stable',
    notes: 'لوح 1.20×2.50 م للأسقف المستعارة والديكور',
  },

  // ── Labor & Concrete Works (per m, m², m³, unit) ──
  {
    id: 'labor_wall_brick_m2',
    name: 'يد عاملة لبناء جدار بالآجر (بريك 8 أو 12)',
    category: 'labor',
    unit: 'م² جدار',
    priceDzd: 1150,
    minPriceDzd: 900,
    maxPriceDzd: 1550,
    trend: 'stable',
    notes: 'بناء الجدران الداخلية والخارجية بالمتر المربع شاملاً المونة',
  },
  {
    id: 'labor_wall_plaster_m2',
    name: 'يد عاملة لطلية وتلبيس الجدار (Talochage / Crépissage)',
    category: 'labor',
    unit: 'م² تلبيس',
    priceDzd: 650,
    minPriceDzd: 500,
    maxPriceDzd: 900,
    trend: 'stable',
    notes: 'تلبيس إسمنتي للجدران (يحسب لكل وجه داخلي أو خارجي)',
  },
  {
    id: 'labor_column_unit',
    name: 'يد عاملة للبوطون: بيلي / عمود مسلح (Poteau)',
    category: 'labor',
    unit: 'بيلي (عمود)',
    priceDzd: 7500,
    minPriceDzd: 5500,
    maxPriceDzd: 10500,
    trend: 'up',
    notes: 'كوفراج وحدادة وصب العمود الواحد حتى ارتفاع 3م',
  },
  {
    id: 'labor_beam_ml',
    name: 'يد عاملة للبوطون: سانتر / حزام مسلح (Chaînage / Poutre)',
    category: 'labor',
    unit: 'م طولي',
    priceDzd: 1650,
    minPriceDzd: 1200,
    maxPriceDzd: 2300,
    trend: 'up',
    notes: 'كوفراج وتركيب الحديد وصب السانتر بالمتر الطولي',
  },
  {
    id: 'labor_dalle_m2',
    name: 'يد عاملة للبوطون: دالة كاملة (Dalle Hourdis / Plancher)',
    category: 'labor',
    unit: 'م² دالة',
    priceDzd: 3800,
    minPriceDzd: 3000,
    maxPriceDzd: 4900,
    trend: 'up',
    notes: 'كوفراج السقف + رص الهوردي والبوتريل + شبكة الحديد + الصب',
  },
  {
    id: 'concrete_ready_m3',
    name: 'خرسانة مسلحة جاهزة للصب (Béton C25/30)',
    category: 'structure',
    unit: 'م³ بوطون',
    priceDzd: 14500,
    minPriceDzd: 13000,
    maxPriceDzd: 16800,
    trend: 'up',
    notes: 'لصب البيليات والسوانتر والدالة الكاملة (متوسط السوق الجزائري)',
  },
  {
    id: 'labor_foundation_ml',
    name: 'يد عاملة للأساسات واللونغرين (Semelles & Longrines)',
    category: 'labor',
    unit: 'م طولي',
    priceDzd: 2200,
    minPriceDzd: 1700,
    maxPriceDzd: 2900,
    trend: 'stable',
    notes: 'حفر، نظافة، سميلات وأحزمة أرضية بالمتر الطولي',
  },
  {
    id: 'labor_structure_m2',
    name: 'يد عاملة عامة للبناء والهيكل (شامل بالمتر المربع)',
    category: 'labor',
    unit: 'م² مبني',
    priceDzd: 13500,
    minPriceDzd: 11000,
    maxPriceDzd: 17000,
    trend: 'up',
    notes: 'أجرة المقاول الإجمالية للهيكل والخرسانة والآجر بالمتر المربع',
  },
  {
    id: 'labor_paint_m2',
    name: 'يد عاملة للدهن والأندوي (وجهين)',
    category: 'labor',
    unit: 'م² جدار/سقف',
    priceDzd: 550,
    minPriceDzd: 420,
    maxPriceDzd: 780,
    trend: 'stable',
    notes: 'تشمل الحك والتمليس بالأندوي وطبقتي طلاء',
  },
  {
    id: 'labor_tile_m2',
    name: 'يد عاملة لتركيب البلاط والسيراميك',
    category: 'labor',
    unit: 'م² أرضية',
    priceDzd: 1050,
    minPriceDzd: 850,
    maxPriceDzd: 1450,
    trend: 'stable',
    notes: 'تركيب الدال دو صول والبلينت مع ضبط الميزان',
  },
  {
    id: 'labor_placo_m2',
    name: 'يد عاملة لتركيب البلاكو بلاتر والديكور (BA13)',
    category: 'labor',
    unit: 'م² سقف',
    priceDzd: 950,
    minPriceDzd: 750,
    maxPriceDzd: 1350,
    trend: 'stable',
    notes: 'تركيب الهيكل المعدني وألواح الجبس والبانداج',
  },
  {
    id: 'labor_waterproof_m2',
    name: 'يد عاملة للكتامة وعزل السطح (Étanchéité)',
    category: 'labor',
    unit: 'م² سطح',
    priceDzd: 850,
    minPriceDzd: 650,
    maxPriceDzd: 1200,
    trend: 'stable',
    notes: 'تطبيق الباكس والزفت لعزل الأسطح والحمامات',
  },
  {
    id: 'labor_plumbing_pt',
    name: 'يد عاملة للترصيص الصحي والغاز (نقطة تجهيز)',
    category: 'labor',
    unit: 'نقطة',
    priceDzd: 4500,
    minPriceDzd: 3500,
    maxPriceDzd: 6200,
    trend: 'stable',
    notes: 'تمديد أنابيب الماء البارد/الساخن والصرف لكل جهاز صحي',
  },
  {
    id: 'labor_electric_pt',
    name: 'يد عاملة للكهرباء المعمارية (نقطة إنارة/مأخذ)',
    category: 'labor',
    unit: 'نقطة',
    priceDzd: 1400,
    minPriceDzd: 1000,
    maxPriceDzd: 2000,
    trend: 'stable',
    notes: 'سحب الأسلاك وتثبيت العلب والمآخذ والإنارة لكل نقطة',
  },
];

export function buildRegionalReferenceSnapshot(region: AlgeriaRegion): AlgeriaMarketSnapshot {
  const regionMeta = ALGERIA_REGIONS.find((r) => r.id === region) || ALGERIA_REGIONS[0];
  const now = new Date();
  const nextRefresh = new Date(now.getTime() + 4 * 60 * 60 * 1000);

  const prices = BASE_ALGERIA_PRICES.map((item) => {
    let mult = regionMeta.multiplier;
    if (region === 'south' && (item.id === 'sand_m3' || item.id === 'gravel_m3')) {
      mult = 0.9;
    }
    const roundStep = item.priceDzd >= 1000 ? 50 : 1;
    const scale = (v: number) => Math.round((v * mult) / roundStep) * roundStep;
    return {
      ...item,
      priceDzd: scale(item.priceDzd),
      minPriceDzd: scale(item.minPriceDzd),
      maxPriceDzd: scale(item.maxPriceDzd),
    };
  });

  return {
    region,
    sourceMode: 'reference',
    updatedAtIso: now.toISOString(),
    nextAutoRefreshIso: nextRefresh.toISOString(),
    marketSummary: `الأسعار المرجعية المحدثة للسوق الجزائري (${regionMeta.label}: ${regionMeta.wilayasSample}). يمكنك تحديثها مباشرة عبر البحث الحي أو تعديل سعر أي بند يدوياً.`,
    prices,
    sources: [],
  };
}

export interface EstimatorInputs {
  floorAreaSqm: number;
  floorsCount: number;
  wallLengthM: number;
  wallHeightM: number;
  roomsCount?: number;
  salonsCount?: number;
  kitchensCount?: number;
  bathroomsCount?: number;
  garagesCount?: number;
  balconiesCount?: number;
  paintCoats: 2 | 3;
  finishLevel: FinishLevel;
  includeStructure: boolean;
  includePaint: boolean;
  includeTiling: boolean;
  includeLabor: boolean;
}

export interface CostLineItem {
  id: string;
  name: string;
  category: MaterialCategory;
  quantity: number;
  unit: string;
  unitPriceDzd: number;
  totalDzd: number;
}

export interface CostEstimateResult {
  builtAreaSqm: number;
  paintAreaSqm: number;
  lines: CostLineItem[];
  structureTotalDzd: number;
  paintTotalDzd: number;
  finishingTotalDzd: number;
  laborTotalDzd: number;
  grandTotalDzd: number;
  costPerSqmDzd: number;
}

export function estimateDimensionsFromSpaces(spaces: {
  roomsCount: number;
  salonsCount: number;
  kitchensCount: number;
  bathroomsCount: number;
  garagesCount: number;
  balconiesCount: number;
}): { floorAreaSqm: number; wallLengthM: number } {
  const rooms = Math.max(0, spaces.roomsCount);
  const salons = Math.max(0, spaces.salonsCount);
  const kitchens = Math.max(0, spaces.kitchensCount);
  const baths = Math.max(0, spaces.bathroomsCount);
  const garages = Math.max(0, spaces.garagesCount);
  const balconies = Math.max(0, spaces.balconiesCount);

  const rawSpacesArea =
    rooms * 13.5 + salons * 22 + kitchens * 13 + baths * 5.5 + garages * 20 + balconies * 7;
  const circulationArea = Math.max(8, rawSpacesArea * 0.14);
  const floorAreaSqm = Math.max(20, Math.round(rawSpacesArea + circulationArea));

  // Perimeter + interior partition walls from space counts
  const perimeterEst = Math.sqrt(floorAreaSqm) * 4;
  const partitionEst =
    rooms * 6.5 + salons * 7 + kitchens * 6 + baths * 4.5 + garages * 8 + balconies * 2.5;
  const wallLengthM = Math.max(12, Math.round(perimeterEst + partitionEst * 0.55));

  return { floorAreaSqm, wallLengthM };
}

export function computeAlgeriaConstructionEstimate(
  inputs: EstimatorInputs,
  priceList: AlgeriaMaterialPrice[]
): CostEstimateResult {
  const priceMap = new Map<string, AlgeriaMaterialPrice>();
  priceList.forEach((p) => priceMap.set(p.id, p));

  const getPrice = (id: string) => priceMap.get(id)?.priceDzd ?? 0;
  const finishMult =
    inputs.finishLevel === 'economic' ? 0.88 : inputs.finishLevel === 'luxury' ? 1.25 : 1.0;

  const floorArea = Math.max(10, Number(inputs.floorAreaSqm) || 10);
  const floors = Math.max(1, Math.min(8, Math.round(inputs.floorsCount) || 1));
  const builtAreaSqm = floorArea * floors;
  const wallLen = Math.max(8, Number(inputs.wallLengthM) || floorArea * 0.45);
  const wallH = Math.max(2.2, Math.min(5.0, Number(inputs.wallHeightM) || 2.9));

  const roomsCount = Math.max(0, Number(inputs.roomsCount ?? 3));
  const salonsCount = Math.max(0, Number(inputs.salonsCount ?? 1));
  const kitchensCount = Math.max(0, Number(inputs.kitchensCount ?? 1));
  const bathroomsCount = Math.max(0, Number(inputs.bathroomsCount ?? 1));
  const garagesCount = Math.max(0, Number(inputs.garagesCount ?? 0));
  const balconiesCount = Math.max(0, Number(inputs.balconiesCount ?? 1));

  // Space-aware wall & wet-area ceramic tiling adjustments
  const extraSpaceWallArea =
    (roomsCount + salonsCount + kitchensCount + bathroomsCount) * 2.2 * floors +
    garagesCount * 14;
  const netWallOneSideSqm = wallLen * wallH * floors * 0.85 + extraSpaceWallArea * 0.35;
  const wetWallTileSqm = (kitchensCount * 14 + bathroomsCount * 18) * floors;
  const garageFloorAreaSqm = garagesCount * 20;
  const balconyAreaSqm = balconiesCount * 7 * floors;
  const totalCeramicSqm =
    builtAreaSqm * 1.1 + wetWallTileSqm * 1.08 + balconyAreaSqm * 0.9;
  const paintAreaSqm = Math.round(
    Math.max(20, netWallOneSideSqm * 1.85 - wetWallTileSqm * 0.8 + builtAreaSqm)
  );

  const lines: CostLineItem[] = [];
  const pushLine = (id: string, qty: number, unitPriceOverride?: number) => {
    const item = priceMap.get(id);
    if (!item || qty <= 0) return;
    const unitPriceDzd = Math.round(unitPriceOverride ?? item.priceDzd);
    const quantity = Math.ceil(qty);
    lines.push({
      id: item.id,
      name: item.name,
      category: item.category,
      quantity,
      unit: item.unit,
      unitPriceDzd,
      totalDzd: quantity * unitPriceDzd,
    });
  };

  if (inputs.includeStructure) {
    // Garages require slightly thicker floor slab & lintel/beam reinforcement
    const structuralArea = builtAreaSqm + garageFloorAreaSqm * 0.15;
    pushLine('cement_bag', structuralArea * 5.5);
    pushLine('rebar_q', structuralArea * 0.38);
    pushLine('brick_8', netWallOneSideSqm * 12);
    pushLine('brick_12', netWallOneSideSqm * 7 + garagesCount * 280);
    pushLine('sand_m3', structuralArea * 0.45);
    pushLine('gravel_m3', structuralArea * 0.38);
    if (inputs.includeLabor) {
      pushLine('labor_structure_m2', builtAreaSqm);
    }
  }

  if (inputs.includePaint) {
    const coats = inputs.paintCoats === 3 ? 3 : 2;
    pushLine('enduit_25', paintAreaSqm / 22);
    pushLine('paint_vinyl_25', (paintAreaSqm * coats * 0.72) / 70);
    pushLine('paint_satin_15', (paintAreaSqm * coats * 0.28) / 45, getPrice('paint_satin_15') * finishMult);
    pushLine('facade_paint_25', ((builtAreaSqm * 0.35 + balconiesCount * 8) * 2) / 55);
    if (inputs.includeLabor) {
      pushLine('labor_paint_m2', paintAreaSqm * (coats === 3 ? 1.15 : 1));
    }
  }

  if (inputs.includeTiling) {
    pushLine('ceramic_m2', totalCeramicSqm, getPrice('ceramic_m2') * finishMult);
    pushLine('ciment_colle_25', totalCeramicSqm / 4.5);
    pushLine('placo_ba13', ((builtAreaSqm - garageFloorAreaSqm * 0.5) * 0.6) / 3);
    if (inputs.includeLabor) {
      pushLine('labor_tile_m2', builtAreaSqm + wetWallTileSqm * 0.85);
    }
  }

  const structureTotalDzd = lines
    .filter((l) => l.category === 'structure')
    .reduce((s, l) => s + l.totalDzd, 0);
  const paintTotalDzd = lines
    .filter((l) => l.category === 'paint')
    .reduce((s, l) => s + l.totalDzd, 0);
  const finishingTotalDzd = lines
    .filter((l) => l.category === 'finishing')
    .reduce((s, l) => s + l.totalDzd, 0);
  const laborTotalDzd = lines
    .filter((l) => l.category === 'labor')
    .reduce((s, l) => s + l.totalDzd, 0);

  const grandTotalDzd = structureTotalDzd + paintTotalDzd + finishingTotalDzd + laborTotalDzd;
  const costPerSqmDzd = builtAreaSqm > 0 ? Math.round(grandTotalDzd / builtAreaSqm) : 0;

  return {
    builtAreaSqm,
    paintAreaSqm,
    lines,
    structureTotalDzd,
    paintTotalDzd,
    finishingTotalDzd,
    laborTotalDzd,
    grandTotalDzd,
    costPerSqmDzd,
  };
}

export interface SmartLaborInputs {
  wallLengthM: number;
  wallHeightM: number;
  plasterFaces: 1 | 2;
  columnsCount: number;
  beamsLengthM: number;
  dalleAreaSqm: number;
  foundationLengthM: number;
  tilingAreaSqm: number;
  paintAreaSqm: number;
  placoAreaSqm: number;
  waterproofAreaSqm: number;
  plumbingPoints: number;
  electricPoints: number;
  includeConcreteSupply: boolean;
}

export interface SmartLaborLine {
  id: string;
  label: string;
  formulaHint: string;
  quantity: number;
  unit: string;
  unitRateDzd: number;
  totalDzd: number;
}

export interface SmartLaborEstimateResult {
  lines: SmartLaborLine[];
  masonryAndPlasterTotalDzd: number;
  concreteAndStructureTotalDzd: number;
  finishingAndTechTotalDzd: number;
  concreteVolumeM3: number;
  grandTotalDzd: number;
}

export function computeSmartLaborEstimate(
  inputs: SmartLaborInputs,
  priceList: AlgeriaMaterialPrice[]
): SmartLaborEstimateResult {
  const priceMap = new Map<string, number>();
  priceList.forEach((p) => priceMap.set(p.id, p.priceDzd));
  const rate = (id: string, fallback: number) => priceMap.get(id) ?? fallback;

  const wallLen = Math.max(0, Number(inputs.wallLengthM) || 0);
  const wallH = Math.max(2.0, Number(inputs.wallHeightM) || 2.9);
  const netWallArea = Number((wallLen * wallH * 0.88).toFixed(1)); // deduct ~12% openings
  const plasterArea = Number((netWallArea * (inputs.plasterFaces === 2 ? 2 : 1)).toFixed(1));
  const cols = Math.max(0, Math.round(inputs.columnsCount) || 0);
  const beamsM = Math.max(0, Number(inputs.beamsLengthM) || 0);
  const dalleSqm = Math.max(0, Number(inputs.dalleAreaSqm) || 0);
  const foundM = Math.max(0, Number(inputs.foundationLengthM) || 0);

  // Estimated concrete volume (m³): Columns (0.3*0.3*H) + Beams (0.25*0.35*L) + Dalle (0.12m avg slab concrete)
  const concreteVolumeM3 = Number(
    (cols * 0.3 * 0.3 * wallH + beamsM * 0.25 * 0.35 + dalleSqm * 0.12).toFixed(2)
  );

  const lines: SmartLaborLine[] = [];

  const push = (
    id: string,
    label: string,
    formulaHint: string,
    quantity: number,
    unit: string,
    unitRateDzd: number
  ) => {
    if (quantity <= 0) return;
    const roundedQty = Number(quantity.toFixed(1));
    lines.push({
      id,
      label,
      formulaHint,
      quantity: roundedQty,
      unit,
      unitRateDzd: Math.round(unitRateDzd),
      totalDzd: Math.round(roundedQty * unitRateDzd),
    });
  };

  push(
    'brick_masonry',
    'بناء الجدران بالآجر (بريك 8/12)',
    `${wallLen.toFixed(1)} م × ${wallH.toFixed(2)} م (صافي الفتحات)`,
    netWallArea,
    'م²',
    rate('labor_wall_brick_m2', 1150)
  );

  push(
    'wall_plaster',
    `طلية وتلبيس الجدار (${inputs.plasterFaces === 2 ? 'وجهين' : 'وجه واحد'})`,
    `${netWallArea.toFixed(1)} م² × ${inputs.plasterFaces}`,
    plasterArea,
    'م²',
    rate('labor_wall_plaster_m2', 650)
  );

  push(
    'concrete_columns',
    'أعمدة البوطون (البيليات - Poteaux)',
    `${cols} عمود بارتفاع ${wallH.toFixed(2)} م`,
    cols,
    'بيلي',
    rate('labor_column_unit', 7500)
  );

  push(
    'concrete_beams',
    'السوانتر والأحزمة (Chaînages / Poutres)',
    `حساب بالمتر الطولي (${beamsM.toFixed(1)} م)`,
    beamsM,
    'م طولي',
    rate('labor_beam_ml', 1650)
  );

  push(
    'concrete_dalle',
    'الدالة الكاملة (Dalle Hourdis / Plancher)',
    `كوفراج + هوردي + حديد + صب`,
    dalleSqm,
    'م²',
    rate('labor_dalle_m2', 3800)
  );

  push(
    'foundations',
    'الأساسات واللونغرين (Semelles & Longrines)',
    `بالمتر الطولي للأحزمة الأرضية`,
    foundM,
    'م طولي',
    rate('labor_foundation_ml', 2200)
  );

  if (inputs.includeConcreteSupply && concreteVolumeM3 > 0) {
    push(
      'concrete_supply',
      'تكلفة البوطون الجاهز للصب (C25/30)',
      `البيليات + السوانتر + الدالة`,
      concreteVolumeM3,
      'م³',
      rate('concrete_ready_m3', 14500)
    );
  }

  push(
    'tile_labor',
    'يد عاملة للسيراميك والبلاط (Dalle de sol)',
    `الأرضيات + جدران الحمام والمطبخ`,
    inputs.tilingAreaSqm,
    'م²',
    rate('labor_tile_m2', 1050)
  );

  push(
    'paint_labor',
    'يد عاملة للدهن والأندوي (وجهين)',
    `الجدران الداخلية والأسقف`,
    inputs.paintAreaSqm,
    'م²',
    rate('labor_paint_m2', 550)
  );

  push(
    'placo_labor',
    'تركيب البلاكو بلاتر والديكور (BA13)',
    `أسقف مستعارة وديكور`,
    inputs.placoAreaSqm,
    'م²',
    rate('labor_placo_m2', 950)
  );

  push(
    'waterproof_labor',
    'الكتامة وعزل السطح والحمامات (Étanchéité)',
    `حماية من التسرب والرطوبة`,
    inputs.waterproofAreaSqm,
    'م²',
    rate('labor_waterproof_m2', 850)
  );

  push(
    'plumbing_labor',
    'الترصيص الصحي والغاز (Plomberie)',
    `نقاط المياه الباردة والساخنة والصرف`,
    inputs.plumbingPoints,
    'نقطة',
    rate('labor_plumbing_pt', 4500)
  );

  push(
    'electric_labor',
    'الكهرباء المعمارية (Électricité)',
    `مآخذ + إنارة + لوحة توزيع`,
    inputs.electricPoints,
    'نقطة',
    rate('labor_electric_pt', 1400)
  );

  const byId = (ids: string[]) =>
    lines.filter((l) => ids.includes(l.id)).reduce((s, l) => s + l.totalDzd, 0);

  const masonryAndPlasterTotalDzd = byId(['brick_masonry', 'wall_plaster']);
  const concreteAndStructureTotalDzd = byId([
    'concrete_columns',
    'concrete_beams',
    'concrete_dalle',
    'foundations',
    'concrete_supply',
  ]);
  const finishingAndTechTotalDzd = byId([
    'tile_labor',
    'paint_labor',
    'placo_labor',
    'waterproof_labor',
    'plumbing_labor',
    'electric_labor',
  ]);
  const grandTotalDzd =
    masonryAndPlasterTotalDzd + concreteAndStructureTotalDzd + finishingAndTechTotalDzd;

  return {
    lines,
    masonryAndPlasterTotalDzd,
    concreteAndStructureTotalDzd,
    finishingAndTechTotalDzd,
    concreteVolumeM3,
    grandTotalDzd,
  };
}

export function formatDzd(value: number): string {
  return `${Math.round(value).toLocaleString('fr-DZ')} دج`;
}

export function formatMillionCentimes(dzd: number): string {
  const millions = dzd / 10000;
  return `${millions.toFixed(1)} مليون سنتيم`;
}
