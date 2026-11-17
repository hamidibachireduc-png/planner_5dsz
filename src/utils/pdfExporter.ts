import { jsPDF } from 'jspdf';
import { FLOOR_STYLES, FURNITURE_CATEGORIES, computeFloorPlanMetrics } from '../data/catalog';
import { FloorPlanData, FurnitureItem, UnitType } from '../types/planner';
import { BRAND_LOGO_URL } from './assets';

export interface PdfExportOptions {
  title: string;
  brandName: string;
  floorPlan: FloorPlanData;
}

const PAGE_W = 1240; // ~150 DPI A4 width
const PAGE_H = 1754; // ~150 DPI A4 height
const MARGIN_X = 56;
const CONTENT_W = PAGE_W - MARGIN_X * 2; // 1128px
const FOOTER_Y = PAGE_H - 58;
const BODY_BOTTOM_LIMIT = PAGE_H - 108;

const CATEGORY_LABEL_MAP: Record<string, string> = Object.fromEntries(
  FURNITURE_CATEGORIES.map((c) => [c.id, c.label])
);

function formatLen(meters: number, unit: UnitType): string {
  if (unit === 'ft') {
    return `${(meters * 3.28084).toFixed(1)} ft`;
  }
  return `${meters.toFixed(2)} m`;
}

function formatArea(sqm: number, unit: UnitType): string {
  if (unit === 'ft') {
    return `${(sqm * 10.7639).toFixed(1)} ft²`;
  }
  return `${sqm.toFixed(2)} م²`;
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}...`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}...`;
}

function loadLogoImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => resolve(null), 2500);
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
}

function createPageCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('تعذر تهيئة لوحة تصدير PDF');
  }
  // Crisp white architectural sheet
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);

  // Subtle sheet border frame
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.strokeRect(28, 28, PAGE_W - 56, PAGE_H - 56);

  return { canvas, ctx };
}

function drawContinuationHeader(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement | null,
  brandName: string,
  title: string,
  subtitle: string
): number {
  ctx.save();
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(MARGIN_X, 52, CONTENT_W, 88);
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(MARGIN_X, 52, CONTENT_W, 88);

  const rightX = PAGE_W - MARGIN_X - 20;
  if (logo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(rightX - 28, 96, 28, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(logo, rightX - 56, 68, 56, 56);
    ctx.restore();
  }

  const textAnchorX = logo ? rightX - 72 : rightX;
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1D4ED8';
  ctx.font = '700 18px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(brandName, textAnchorX, 82);

  ctx.fillStyle = '#0F172A';
  ctx.font = '700 22px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(truncateText(ctx, `${title || 'مشروع بدون اسم'} — ${subtitle}`, 700), textAnchorX, 114);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#475569';
  ctx.font = '500 14px "IBM Plex Sans Arabic", sans-serif';
  const dateStr = new Date().toLocaleDateString('ar-DZ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  ctx.fillText(`تاريخ التصدير: ${dateStr}`, MARGIN_X + 20, 96);
  ctx.restore();

  return 168;
}

function drawFurnitureBlueprintSymbol(
  ctx: CanvasRenderingContext2D,
  item: FurnitureItem,
  scale: number,
  cx: number,
  cy: number
) {
  const fw = Math.max(4, item.width * scale);
  const fd = Math.max(4, item.depth * scale);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-item.rotation);

  ctx.fillStyle = item.primaryColor;
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 1.25;

  const isCircle =
    item.type === 'plant_olive' ||
    item.type === 'floor_lamp' ||
    item.type === 'ottoman' ||
    item.type === 'dining_round' ||
    item.type === 'vacuum_robot' ||
    item.type === 'chandelier' ||
    item.type === 'air_purifier' ||
    item.type === 'bean_bag' ||
    item.type === 'brass_tea_table' ||
    item.type === 'water_tank_pump' ||
    item.type === 'courtyard_fountain' ||
    item.type === 'maida_low_table' ||
    item.type === 'tabouna_bread_oven';

  if (isCircle) {
    const rad = Math.min(fw, fd) / 2;
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (
      item.type === 'plant_olive' ||
      item.type === 'chandelier' ||
      item.type === 'vacuum_robot' ||
      item.type === 'courtyard_fountain' ||
      item.type === 'brass_tea_table' ||
      item.type === 'maida_low_table'
    ) {
      ctx.fillStyle = item.accentColor;
      ctx.beginPath();
      ctx.arc(0, 0, rad * 0.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.type === 'tabouna_bread_oven') {
      ctx.strokeStyle = '#EA580C';
      ctx.beginPath();
      ctx.arc(0, 0, rad * 0.56, 0, Math.PI * 2);
      ctx.stroke();
    } else if (item.type === 'bean_bag' || item.type === 'water_tank_pump') {
      ctx.strokeStyle = 'rgba(15,23,42,0.4)';
      ctx.beginPath();
      ctx.arc(0, 0, rad * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (item.type === 'potager_curved') {
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(-fw / 2, -fd / 2);
    ctx.lineTo(fw / 2, -fd / 2);
    ctx.lineTo(fw / 2, fd * 0.25);
    ctx.quadraticCurveTo(0, fd * 0.65, -fw / 2, fd * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(15,23,42,0.45)';
    ctx.strokeRect(-fw * 0.18, -fd * 0.34, fw * 0.36, fd * 0.44);
  } else if (item.type === 'potager_corner') {
    const leg = Math.min(fw, fd) * 0.44;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(-fw / 2, -fd / 2);
    ctx.lineTo(fw / 2, -fd / 2);
    ctx.lineTo(fw / 2, -fd / 2 + leg);
    ctx.lineTo(-fw / 2 + leg, -fd / 2 + leg);
    ctx.lineTo(-fw / 2 + leg, fd / 2);
    ctx.lineTo(-fw / 2, fd / 2);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(15,23,42,0.45)';
    ctx.strokeRect(fw * 0.05, -fd / 2 + leg * 0.18, fw * 0.3, leg * 0.64);
  } else {
    ctx.globalAlpha = item.type === 'rug' ? 0.38 : item.type === 'kitchen_wall_cupboard_dz' ? 0.65 : 0.88;
    if (item.type === 'kitchen_wall_cupboard_dz') ctx.setLineDash([4, 3]);
    ctx.fillRect(-fw / 2, -fd / 2, fw, fd);
    ctx.globalAlpha = 1;
    ctx.strokeRect(-fw / 2, -fd / 2, fw, fd);
    ctx.setLineDash([]);

    ctx.strokeStyle = 'rgba(15,23,42,0.4)';
    ctx.lineWidth = 1;

    if (
      item.type === 'sofa_3' ||
      item.type === 'sofa_l' ||
      item.type === 'sofa_2' ||
      item.type === 'armchair' ||
      item.type === 'outdoor_lounge' ||
      item.type === 'algerian_sedari' ||
      item.type === 'clic_clac_sofa'
    ) {
      ctx.strokeRect(-fw / 2 + 2, -fd / 2 + 2, Math.max(2, fw - 4), fd * 0.24);
      if (item.type === 'clic_clac_sofa') {
        ctx.beginPath();
        ctx.moveTo(-fw / 2 + 2, fd * 0.08);
        ctx.lineTo(fw / 2 - 2, fd * 0.08);
        ctx.stroke();
      }
    } else if (item.type === 'algerian_salon_u') {
      ctx.strokeRect(-fw / 2 + 2, -fd / 2 + 2, Math.max(2, fw - 4), fd * 0.26);
      ctx.strokeRect(-fw / 2 + 2, -fd / 2 + 2, fw * 0.24, Math.max(2, fd - 4));
      ctx.strokeRect(fw / 2 - fw * 0.24 - 2, -fd / 2 + 2, fw * 0.24, Math.max(2, fd - 4));
    } else if (item.type === 'garage_car') {
      ctx.beginPath();
      ctx.roundRect(-fw * 0.44, -fd * 0.46, fw * 0.88, fd * 0.92, 5);
      ctx.stroke();
      ctx.strokeRect(-fw * 0.34, -fd * 0.16, fw * 0.68, fd * 0.38);
    } else if (item.type === 'laundry_sink_lavoir') {
      ctx.strokeRect(-fw * 0.38, -fd * 0.32, fw * 0.76, fd * 0.64);
      ctx.beginPath();
      ctx.arc(0, 0, Math.min(fw, fd) * 0.12, 0, Math.PI * 2);
      ctx.stroke();
    } else if (item.type === 'storage_rack') {
      ctx.beginPath();
      ctx.moveTo(-fw / 2, -fd / 2);
      ctx.lineTo(fw / 2, fd / 2);
      ctx.moveTo(fw / 2, -fd / 2);
      ctx.lineTo(-fw / 2, fd / 2);
      ctx.stroke();
    } else if (item.type === 'ac_armoire') {
      ctx.strokeRect(-fw * 0.38, -fd * 0.32, fw * 0.76, fd * 0.42);
      ctx.beginPath();
      ctx.arc(0, fd * 0.2, Math.min(fw, fd) * 0.16, 0, Math.PI * 2);
      ctx.stroke();
    } else if (item.type === 'chaudiere_boiler') {
      ctx.beginPath();
      ctx.arc(0, 0, Math.min(fw, fd) * 0.22, 0, Math.PI * 2);
      ctx.stroke();
    } else if (item.type === 'wall_mirror_arch') {
      ctx.beginPath();
      ctx.moveTo(-fw * 0.3, fd * 0.2);
      ctx.lineTo(fw * 0.2, -fd * 0.25);
      ctx.stroke();
    } else if (
      item.type === 'bed_double' ||
      item.type === 'bed_single' ||
      item.type === 'bunk_bed' ||
      item.type === 'underbed_storage_bed' ||
      item.type === 'matrah_traditional_bed'
    ) {
      ctx.fillStyle = '#FFFFFF';
      if (item.type === 'bed_double' || item.type === 'underbed_storage_bed') {
        ctx.fillRect(-fw * 0.4, -fd * 0.42, fw * 0.36, fd * 0.18);
        ctx.fillRect(fw * 0.04, -fd * 0.42, fw * 0.36, fd * 0.18);
        ctx.strokeRect(-fw * 0.4, -fd * 0.42, fw * 0.36, fd * 0.18);
        ctx.strokeRect(fw * 0.04, -fd * 0.42, fw * 0.36, fd * 0.18);
      } else {
        ctx.fillRect(-fw * 0.32, -fd * 0.42, fw * 0.64, fd * 0.18);
        ctx.strokeRect(-fw * 0.32, -fd * 0.42, fw * 0.64, fd * 0.18);
      }
      ctx.beginPath();
      ctx.moveTo(-fw / 2, -fd * 0.08);
      ctx.lineTo(fw / 2, -fd * 0.08);
      ctx.stroke();
    } else if (item.type === 'stove' || item.type === 'gas_oven_5burner') {
      const r = Math.min(fw, fd) * 0.14;
      const burners: [number, number][] = [
        [-fw * 0.24, -fd * 0.22],
        [fw * 0.24, -fd * 0.22],
        [-fw * 0.24, fd * 0.22],
        [fw * 0.24, fd * 0.22],
      ];
      if (item.type === 'gas_oven_5burner') burners.push([0, 0]);
      burners.forEach(([bx, bz]) => {
        ctx.beginPath();
        ctx.arc(bx, bz, r, 0, Math.PI * 2);
        ctx.stroke();
      });
    } else if (item.type === 'washer' || item.type === 'dryer') {
      ctx.beginPath();
      ctx.arc(0, 0, Math.min(fw, fd) * 0.28, 0, Math.PI * 2);
      ctx.stroke();
    } else if (item.type === 'bathtub' || item.type === 'jacuzzi') {
      ctx.beginPath();
      ctx.roundRect(-fw * 0.42, -fd * 0.38, fw * 0.84, fd * 0.76, 6);
      ctx.stroke();
    } else if (
      item.type === 'kitchen_counter' ||
      item.type === 'couscous_prep_counter' ||
      item.type === 'potager_straight'
    ) {
      ctx.strokeRect(fw * 0.05, -fd * 0.3, fw * 0.28, fd * 0.6);
      ctx.beginPath();
      ctx.arc(fw * 0.19, 0, Math.min(fw, fd) * 0.08, 0, Math.PI * 2);
      ctx.stroke();
    } else if (item.type === 'dish_rack_counter_dz') {
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo((fw / 9) * i, -fd * 0.32);
        ctx.lineTo((fw / 9) * i, fd * 0.32);
        ctx.stroke();
      }
    } else if (item.type === 'kitchen_wall_cupboard_dz') {
      ctx.beginPath();
      ctx.moveTo(0, -fd / 2);
      ctx.lineTo(0, fd / 2);
      ctx.stroke();
    } else if (item.type === 'toilet_arabic') {
      ctx.strokeRect(-fw * 0.34, -fd * 0.32, fw * 0.22, fd * 0.64);
      ctx.strokeRect(fw * 0.12, -fd * 0.32, fw * 0.22, fd * 0.64);
      ctx.beginPath();
      ctx.arc(0, -fd * 0.16, Math.min(fw, fd) * 0.14, 0, Math.PI * 2);
      ctx.stroke();
    } else if (item.type === 'toilet_anglaise') {
      ctx.strokeRect(-fw * 0.36, -fd * 0.42, fw * 0.72, fd * 0.24);
      ctx.beginPath();
      ctx.ellipse(0, fd * 0.12, fw * 0.28, fd * 0.28, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (item.type === 'shower_standard') {
      ctx.strokeRect(-fw * 0.42, -fd * 0.42, fw * 0.84, fd * 0.84);
      ctx.beginPath();
      ctx.arc(0, 0, Math.min(fw, fd) * 0.1, 0, Math.PI * 2);
      ctx.stroke();
    } else if (item.type === 'shower_italian') {
      ctx.strokeRect(-fw * 0.34, fd * 0.28, fw * 0.68, Math.max(2, fd * 0.08));
      ctx.beginPath();
      ctx.moveTo(-fw / 2, -fd / 2);
      ctx.lineTo(fw / 2, -fd / 2);
      ctx.stroke();
    } else if (item.type === 'shower_arabic_hammam') {
      ctx.strokeRect(-fw * 0.44, -fd * 0.4, fw * 0.34, fd * 0.8);
      ctx.beginPath();
      ctx.arc(fw * 0.2, fd * 0.1, Math.min(fw, fd) * 0.16, 0, Math.PI * 2);
      ctx.stroke();
    } else if (item.type === 'sewing_machine_table') {
      ctx.strokeRect(-fw * 0.28, -fd * 0.2, fw * 0.56, fd * 0.28);
    } else if (item.type === 'double_vanity') {
      ctx.beginPath();
      ctx.arc(-fw * 0.25, 0, Math.min(fw * 0.16, fd * 0.28), 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(fw * 0.25, 0, Math.min(fw * 0.16, fd * 0.28), 0, Math.PI * 2);
      ctx.stroke();
    } else if (item.type === 'ablution_station' || item.type === 'turkish_hammam_bench') {
      ctx.strokeRect(-fw * 0.42, -fd * 0.38, fw * 0.42, fd * 0.76);
      ctx.beginPath();
      ctx.arc(fw * 0.22, 0, Math.min(fw * 0.14, fd * 0.26), 0, Math.PI * 2);
      ctx.stroke();
    } else if (item.type === 'fireplace_modern' || item.type === 'gas_heater_algerian') {
      ctx.fillStyle = '#EA580C';
      ctx.fillRect(-fw * 0.34, -fd * 0.12, fw * 0.68, fd * 0.35);
    } else if (item.type === 'prayer_corner') {
      ctx.strokeRect(-fw * 0.42, -fd * 0.38, fw * 0.56, fd * 0.76);
    } else if (item.type === 'islamic_screen' || item.type === 'privacy_partition') {
      ctx.beginPath();
      for (let i = -3; i <= 3; i++) {
        ctx.moveTo((fw / 8) * i, -fd / 2);
        ctx.lineTo((fw / 8) * i, fd / 2);
      }
      ctx.stroke();
    } else if (item.type === 'ac_split') {
      ctx.beginPath();
      ctx.moveTo(-fw * 0.42, fd * 0.2);
      ctx.lineTo(fw * 0.42, fd * 0.2);
      ctx.stroke();
    } else if (item.type === 'piano') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-fw * 0.45, fd * 0.15, fw * 0.9, fd * 0.22);
      ctx.strokeRect(-fw * 0.45, fd * 0.15, fw * 0.9, fd * 0.22);
    }
  }

  ctx.restore();
}

function drawBlueprintPage(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement | null,
  options: PdfExportOptions,
  metrics: ReturnType<typeof computeFloorPlanMetrics>,
  totalPerimeterM: number,
  grossWallLengthM: number,
  netWallAreaSqm: number
) {
  const { title, brandName, floorPlan } = options;
  const unitFactorArea = floorPlan.unit === 'ft' ? 10.7639 : 1;
  const unitFactorLen = floorPlan.unit === 'ft' ? 3.28084 : 1;
  const areaLabel = floorPlan.unit === 'ft' ? 'ft²' : 'م²';
  const lenLabel = floorPlan.unit === 'ft' ? 'ft' : 'm';

  // ── 1. Architectural Cartouche Header ──
  ctx.save();
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(MARGIN_X, 52, CONTENT_W, 132);

  // Accent gold/blue architectural stripe on top edge
  ctx.fillStyle = '#2563EB';
  ctx.fillRect(MARGIN_X, 52, CONTENT_W, 6);

  const logoCenterX = PAGE_W - MARGIN_X - 66;
  const logoCenterY = 120;
  if (logo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(logoCenterX, logoCenterY, 42, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.clip();
    ctx.drawImage(logo, logoCenterX - 42, logoCenterY - 42, 84, 84);
    ctx.restore();

    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(logoCenterX, logoCenterY, 43, 0, Math.PI * 2);
    ctx.stroke();
  }

  const headerTextX = logo ? PAGE_W - MARGIN_X - 126 : PAGE_W - MARGIN_X - 28;
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#93C5FD';
  ctx.font = '600 16px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(brandName, headerTextX, 88);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 28px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(truncateText(ctx, title || 'مشروع تصميم معماري', 680), headerTextX, 124);

  ctx.fillStyle = '#CBD5E1';
  ctx.font = '400 14px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText('مخطط معماري ثنائي الأبعاد وتقرير القياسات الهندسية وقائمة الأثاث', headerTextX, 158);

  // Left side metadata badges
  const dateStr = new Date().toLocaleDateString('ar-DZ', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  ctx.textAlign = 'left';
  ctx.fillStyle = '#E2E8F0';
  ctx.font = '500 14px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(`التاريخ: ${dateStr}`, MARGIN_X + 24, 96);
  ctx.fillText(
    `الوحدة: ${floorPlan.unit === 'ft' ? 'القدم (ft)' : 'المتر (m)'}  |  ارتفاع الجدران: ${(floorPlan.wallHeight * unitFactorLen).toFixed(2)} ${lenLabel}`,
    MARGIN_X + 24,
    126
  );
  ctx.fillStyle = '#93C5FD';
  ctx.fillText(
    `الفتحات: ${floorPlan.openings.filter((o) => o.type === 'door').length} أبواب · ${floorPlan.openings.filter((o) => o.type === 'window').length} نوافذ`,
    MARGIN_X + 24,
    156
  );
  ctx.restore();

  // ── 2. 5 Summary KPI Cards ──
  const kpis = [
    {
      label: 'إجمالي المساحة',
      value: `${(metrics.totalAreaSqm * unitFactorArea).toFixed(1)} ${areaLabel}`,
      accent: '#2563EB',
    },
    {
      label: 'عدد الغرف',
      value: `${floorPlan.rooms.length} غرف`,
      accent: '#0F172A',
    },
    {
      label: 'مجموع المحيط',
      value: `${(totalPerimeterM * unitFactorLen).toFixed(1)} ${lenLabel}`,
      accent: '#0F172A',
    },
    {
      label: 'أطوال الجدران',
      value: `${(grossWallLengthM * unitFactorLen).toFixed(1)} ${lenLabel}`,
      accent: '#0F172A',
    },
    {
      label: 'صافي مساحة الطلاء',
      value: `${(netWallAreaSqm * unitFactorArea).toFixed(1)} ${areaLabel}`,
      accent: '#D97706',
    },
  ];

  const cardGap = 14;
  const cardW = (CONTENT_W - cardGap * 4) / 5;
  const cardY = 204;
  const cardH = 86;

  kpis.forEach((kpi, idx) => {
    // RTL ordering: first KPI on right
    const cx = PAGE_W - MARGIN_X - cardW - idx * (cardW + cardGap);
    ctx.save();
    ctx.fillStyle = '#F8FAFC';
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.5;
    ctx.fillRect(cx, cardY, cardW, cardH);
    ctx.strokeRect(cx, cardY, cardW, cardH);

    ctx.fillStyle = kpi.accent;
    ctx.fillRect(cx, cardY, cardW, 4);

    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#64748B';
    ctx.font = '600 13px "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText(kpi.label, cx + cardW / 2, cardY + 30);

    ctx.direction = 'ltr';
    ctx.fillStyle = kpi.accent;
    ctx.font = '700 20px "IBM Plex Mono", "IBM Plex Sans Arabic", monospace';
    ctx.fillText(kpi.value, cx + cardW / 2, cardY + 60);
    ctx.restore();
  });

  // ── 3. Main 2D Architectural Blueprint Box ──
  const bpX = MARGIN_X;
  const bpY = 312;
  const bpW = CONTENT_W;
  const bpH = 1230;

  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2;
  ctx.fillRect(bpX, bpY, bpW, bpH);
  ctx.strokeRect(bpX, bpY, bpW, bpH);

  // Blueprint internal title strip
  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(bpX + 1, bpY + 1, bpW - 2, 42);
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bpX, bpY + 43);
  ctx.lineTo(bpX + bpW, bpY + 43);
  ctx.stroke();

  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 16px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText('المخطط الهندسي ثنائي الأبعاد (2D Floor Plan)', bpX + bpW - 18, bpY + 22);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#475569';
  ctx.font = '500 13px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(
    `قطع الأثاث والأجهزة: ${floorPlan.furniture.length} قطعة`,
    bpX + 18,
    bpY + 22
  );

  // Compute world bounds
  let minX = -5;
  let maxX = 5;
  let minZ = -4;
  let maxZ = 4;

  const xs: number[] = [];
  const zs: number[] = [];
  floorPlan.rooms.forEach((r) => {
    xs.push(r.x, r.x + r.width);
    zs.push(r.z, r.z + r.depth);
  });
  floorPlan.walls.forEach((w) => {
    xs.push(w.x1, w.x2);
    zs.push(w.z1, w.z2);
  });
  floorPlan.furniture.forEach((f) => {
    const r = Math.max(f.width, f.depth) / 2;
    xs.push(f.x - r, f.x + r);
    zs.push(f.z - r, f.z + r);
  });

  if (xs.length > 0 && zs.length > 0) {
    minX = Math.min(...xs);
    maxX = Math.max(...xs);
    minZ = Math.min(...zs);
    maxZ = Math.max(...zs);
  }

  const worldPad = 1.0;
  const worldW = Math.max(4, maxX - minX + worldPad * 2);
  const worldH = Math.max(4, maxZ - minZ + worldPad * 2);
  const drawAreaY = bpY + 44;
  const drawAreaH = bpH - 44;
  const scale = Math.min((bpW - 72) / worldW, (drawAreaH - 72) / worldH);
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;

  const toSX = (wx: number) => bpX + bpW / 2 + (wx - centerX) * scale;
  const toSY = (wz: number) => drawAreaY + drawAreaH / 2 + (wz - centerZ) * scale;

  // Clip inside blueprint draw area
  ctx.save();
  ctx.beginPath();
  ctx.rect(bpX + 2, drawAreaY + 2, bpW - 4, drawAreaH - 4);
  ctx.clip();

  // Grid
  const viewLeftW = centerX - bpW / (2 * scale);
  const viewRightW = centerX + bpW / (2 * scale);
  const viewTopW = centerZ - drawAreaH / (2 * scale);
  const viewBotW = centerZ + drawAreaH / (2 * scale);

  if (scale >= 24) {
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = Math.floor(viewLeftW * 2) / 2; gx <= viewRightW; gx += 0.5) {
      const sx = toSX(gx);
      ctx.moveTo(sx, drawAreaY);
      ctx.lineTo(sx, bpY + bpH);
    }
    for (let gz = Math.floor(viewTopW * 2) / 2; gz <= viewBotW; gz += 0.5) {
      const sy = toSY(gz);
      ctx.moveTo(bpX, sy);
      ctx.lineTo(bpX + bpW, sy);
    }
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(15, 23, 42, 0.085)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let gx = Math.floor(viewLeftW); gx <= viewRightW; gx += 1) {
    const sx = toSX(gx);
    ctx.moveTo(sx, drawAreaY);
    ctx.lineTo(sx, bpY + bpH);
  }
  for (let gz = Math.floor(viewTopW); gz <= viewBotW; gz += 1) {
    const sy = toSY(gz);
    ctx.moveTo(bpX, sy);
    ctx.lineTo(bpX + bpW, sy);
  }
  ctx.stroke();

  // Rooms
  floorPlan.rooms.forEach((room) => {
    const rx = toSX(room.x);
    const rz = toSY(room.z);
    const rw = room.width * scale;
    const rd = room.depth * scale;
    const styleDef = FLOOR_STYLES.find((f) => f.id === room.floorStyle);

    ctx.save();
    ctx.fillStyle = styleDef ? `${styleDef.previewColor}32` : 'rgba(197,155,109,0.18)';
    ctx.fillRect(rx, rz, rw, rd);

    ctx.strokeStyle = 'rgba(15, 23, 42, 0.16)';
    ctx.lineWidth = 1;
    ctx.strokeRect(rx, rz, rw, rd);

    // Room name & dimensions centered
    const cx = rx + rw / 2;
    const cy = rz + rd / 2;
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const titleFontPx = Math.max(11, Math.min(16, Math.round(scale * 0.28)));
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.font = `700 ${titleFontPx}px "IBM Plex Sans Arabic", sans-serif`;
    ctx.fillText(truncateText(ctx, room.name, Math.max(40, rw - 12)), cx, cy - 10);

    const subFontPx = Math.max(10, Math.min(13, Math.round(scale * 0.22)));
    ctx.direction = 'ltr';
    ctx.fillStyle = 'rgba(51, 65, 85, 0.9)';
    ctx.font = `600 ${subFontPx}px "IBM Plex Mono", monospace`;
    const areaSqm = room.width * room.depth;
    ctx.fillText(
      `${formatLen(room.width, floorPlan.unit)} × ${formatLen(room.depth, floorPlan.unit)} (${formatArea(areaSqm, floorPlan.unit)})`,
      cx,
      cy + 10
    );
    ctx.restore();
  });

  // Furniture CAD footprints
  floorPlan.furniture.forEach((item) => {
    drawFurnitureBlueprintSymbol(ctx, item, scale, toSX(item.x), toSY(item.z));
  });

  // Walls
  floorPlan.walls.forEach((wall) => {
    const x1 = toSX(wall.x1);
    const y1 = toSY(wall.z1);
    const x2 = toSX(wall.x2);
    const y2 = toSY(wall.z2);
    const thickPx = Math.max(5, (wall.thickness || 0.16) * scale);

    ctx.save();
    ctx.lineCap = 'square';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = thickPx + 2.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.strokeStyle = wall.color || '#F5F2EB';
    ctx.lineWidth = Math.max(2, thickPx - 2);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  });

  // Openings (Doors, Windows, Arches)
  floorPlan.openings.forEach((op) => {
    const wall = floorPlan.walls.find((w) => w.id === op.wallId);
    if (!wall) return;
    const dx = wall.x2 - wall.x1;
    const dz = wall.z2 - wall.z1;
    const wallLen = Math.hypot(dx, dz);
    if (wallLen < 0.1) return;
    const angle = Math.atan2(dz, dx);
    const cx = wall.x1 + dx * op.offsetRatio;
    const cz = wall.z1 + dz * op.offsetRatio;
    const sx = toSX(cx);
    const sy = toSY(cz);
    const opPx = op.width * scale;
    const thickPx = Math.max(6, (wall.thickness || 0.16) * scale);

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(angle);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-opPx / 2, -thickPx / 2 - 2, opPx, thickPx + 4);

    if (op.type === 'door') {
      const swingDir = op.swing === 'out' ? -1 : 1;
      ctx.fillStyle = '#8C6239';
      ctx.fillRect(-opPx / 2, -thickPx / 2, 4, thickPx);
      ctx.fillRect(opPx / 2 - 4, -thickPx / 2, 4, thickPx);

      ctx.strokeStyle = '#8C6239';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-opPx / 2 + 2, 0);
      ctx.lineTo(-opPx / 2 + 2, swingDir * opPx);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(71, 85, 105, 0.72)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      if (swingDir > 0) {
        ctx.arc(-opPx / 2 + 2, 0, opPx, 0, Math.PI / 2, false);
      } else {
        ctx.arc(-opPx / 2 + 2, 0, opPx, -Math.PI / 2, 0, false);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (op.type === 'window') {
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 2;
      ctx.strokeRect(-opPx / 2, -thickPx / 2, opPx, thickPx);
      ctx.beginPath();
      ctx.moveTo(-opPx / 2, 0);
      ctx.lineTo(opPx / 2, 0);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(-opPx / 2, -thickPx / 2, opPx, thickPx);
      ctx.setLineDash([]);
    }
    ctx.restore();
  });

  // Wall Length Dimension Callouts along walls >= 1.2m
  floorPlan.walls.forEach((wall) => {
    const dx = wall.x2 - wall.x1;
    const dz = wall.z2 - wall.z1;
    const len = Math.hypot(dx, dz);
    if (len < 1.2) return;
    const mx = toSX((wall.x1 + wall.x2) / 2);
    const my = toSY((wall.z1 + wall.z2) / 2);
    // Offset perpendicular slightly
    const nx = -dz / len;
    const nz = dx / len;
    const ox = mx + nx * 15;
    const oy = my + nz * 15;

    ctx.save();
    ctx.direction = 'ltr';
    ctx.font = '600 10px "IBM Plex Mono", monospace';
    const label = formatLen(len, floorPlan.unit);
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.fillRect(ox - tw / 2 - 4, oy - 8, tw + 8, 16);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(ox - tw / 2 - 4, oy - 8, tw + 8, 16);
    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, ox, oy);
    ctx.restore();
  });

  // Architectural Graphic Scale Bar at bottom-left of blueprint
  const scaleMeters = floorPlan.unit === 'ft' ? 3.048 : 2; // 2m or 10ft
  const barPx = scaleMeters * scale;
  const barX = bpX + 24;
  const barY = bpY + bpH - 26;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillRect(barX - 10, barY - 26, barPx + 24, 38);
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(barX, barY);
  ctx.lineTo(barX + barPx, barY);
  ctx.moveTo(barX, barY - 6);
  ctx.lineTo(barX, barY + 4);
  ctx.moveTo(barX + barPx / 2, barY - 4);
  ctx.lineTo(barX + barPx / 2, barY + 2);
  ctx.moveTo(barX + barPx, barY - 6);
  ctx.lineTo(barX + barPx, barY + 4);
  ctx.stroke();

  ctx.direction = 'ltr';
  ctx.fillStyle = '#0F172A';
  ctx.font = '600 11px "IBM Plex Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('0', barX - 2, barY - 12);
  ctx.textAlign = 'center';
  ctx.fillText(floorPlan.unit === 'ft' ? '5 ft' : '1 m', barX + barPx / 2, barY - 12);
  ctx.textAlign = 'right';
  ctx.fillText(floorPlan.unit === 'ft' ? '10 ft' : '2 m', barX + barPx + 4, barY - 12);
  ctx.restore();

  ctx.restore(); // end clip
  ctx.restore(); // end blueprint box

  // ── 4. Blueprint Legend Strip ──
  const legY = 1564;
  const legH = 104;
  ctx.save();
  ctx.fillStyle = '#F8FAFC';
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.5;
  ctx.fillRect(MARGIN_X, legY, CONTENT_W, legH);
  ctx.strokeRect(MARGIN_X, legY, CONTENT_W, legH);

  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 15px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText('مفتاح رموز المخطط المعماري (CAD Legend)', PAGE_W - MARGIN_X - 20, legY + 26);

  const legendItems = [
    { kind: 'wall', label: 'جدار حامل / فاصل' },
    { kind: 'door', label: 'باب مع اتجاه الفتح' },
    { kind: 'window', label: 'نافذة زجاجية' },
    { kind: 'furn', label: 'أثاث وتجهيزات منزلية' },
  ];

  const colW = (CONTENT_W - 40) / 4;
  legendItems.forEach((li, idx) => {
    const lx = PAGE_W - MARGIN_X - 20 - idx * colW;
    const ly = legY + 68;
    // Draw small symbol left of text anchor or right before text
    const symX = lx - 28;
    ctx.save();
    if (li.kind === 'wall') {
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(symX - 18, ly - 5, 36, 10);
      ctx.fillStyle = '#F5F2EB';
      ctx.fillRect(symX - 16, ly - 3, 32, 6);
    } else if (li.kind === 'door') {
      ctx.strokeStyle = '#8C6239';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(symX - 12, ly + 8);
      ctx.lineTo(symX - 12, ly - 10);
      ctx.stroke();
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.arc(symX - 12, ly + 8, 18, -Math.PI / 2, 0, false);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (li.kind === 'window') {
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 2;
      ctx.strokeRect(symX - 18, ly - 5, 36, 10);
      ctx.beginPath();
      ctx.moveTo(symX - 18, ly);
      ctx.lineTo(symX + 18, ly);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#CBD5E1';
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1.2;
      ctx.fillRect(symX - 16, ly - 9, 32, 18);
      ctx.strokeRect(symX - 16, ly - 9, 32, 18);
    }
    ctx.restore();

    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#334155';
    ctx.font = '500 14px "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText(li.label, lx - 58, ly);
  });

  ctx.restore();
}

function drawSectionHeading(
  ctx: CanvasRenderingContext2D,
  y: number,
  title: string,
  badgeText: string
): number {
  ctx.save();
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(MARGIN_X, y, CONTENT_W, 44);
  ctx.fillStyle = '#2563EB';
  ctx.fillRect(PAGE_W - MARGIN_X - 8, y, 8, 44);

  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 17px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(title, PAGE_W - MARGIN_X - 24, y + 22);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#93C5FD';
  ctx.font = '600 14px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(badgeText, MARGIN_X + 20, y + 22);
  ctx.restore();

  return y + 52;
}

interface TableColumn {
  label: string;
  width: number;
  align?: 'right' | 'center' | 'left';
  ltr?: boolean;
}

function drawTableHeader(
  ctx: CanvasRenderingContext2D,
  y: number,
  cols: TableColumn[]
): number {
  const rowH = 42;
  ctx.save();
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(MARGIN_X, y, CONTENT_W, rowH);
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1;
  ctx.strokeRect(MARGIN_X, y, CONTENT_W, rowH);

  let cursorRight = PAGE_W - MARGIN_X;
  cols.forEach((col, i) => {
    const cellLeft = cursorRight - col.width;
    if (i > 0) {
      ctx.beginPath();
      ctx.moveTo(cursorRight, y);
      ctx.lineTo(cursorRight, y + rowH);
      ctx.stroke();
    }

    ctx.direction = 'rtl';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0F172A';
    ctx.font = '700 14px "IBM Plex Sans Arabic", sans-serif';
    if (col.align === 'center') {
      ctx.textAlign = 'center';
      ctx.fillText(col.label, cellLeft + col.width / 2, y + rowH / 2);
    } else {
      ctx.textAlign = 'right';
      ctx.fillText(col.label, cursorRight - 14, y + rowH / 2);
    }

    cursorRight = cellLeft;
  });
  ctx.restore();

  return y + rowH;
}

function drawTableRow(
  ctx: CanvasRenderingContext2D,
  y: number,
  rowIndex: number,
  cols: TableColumn[],
  values: string[]
): number {
  const rowH = 42;
  ctx.save();
  ctx.fillStyle = rowIndex % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
  ctx.fillRect(MARGIN_X, y, CONTENT_W, rowH);
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  ctx.strokeRect(MARGIN_X, y, CONTENT_W, rowH);

  let cursorRight = PAGE_W - MARGIN_X;
  cols.forEach((col, i) => {
    const cellLeft = cursorRight - col.width;
    if (i > 0) {
      ctx.beginPath();
      ctx.moveTo(cursorRight, y);
      ctx.lineTo(cursorRight, y + rowH);
      ctx.stroke();
    }

    const val = values[i] ?? '';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = i === 0 ? '#64748B' : '#0F172A';
    ctx.font = col.ltr
      ? '600 13px "IBM Plex Mono", "IBM Plex Sans Arabic", monospace'
      : '500 14px "IBM Plex Sans Arabic", sans-serif';

    ctx.direction = col.ltr ? 'ltr' : 'rtl';
    if (col.align === 'center') {
      ctx.textAlign = 'center';
      ctx.fillText(truncateText(ctx, val, col.width - 16), cellLeft + col.width / 2, y + rowH / 2);
    } else {
      ctx.textAlign = 'right';
      ctx.fillText(truncateText(ctx, val, col.width - 24), cursorRight - 14, y + rowH / 2);
    }

    cursorRight = cellLeft;
  });
  ctx.restore();

  return y + rowH;
}

function drawPageFooter(
  ctx: CanvasRenderingContext2D,
  brandName: string,
  title: string,
  pageNum: number,
  totalPages: number
) {
  ctx.save();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(MARGIN_X, FOOTER_Y - 16);
  ctx.lineTo(PAGE_W - MARGIN_X, FOOTER_Y - 16);
  ctx.stroke();

  ctx.direction = 'rtl';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#64748B';
  ctx.font = '500 13px "IBM Plex Sans Arabic", sans-serif';

  ctx.textAlign = 'right';
  ctx.fillText(
    `${brandName} — ${truncateText(ctx, title || 'مشروع تصميم معماري', 480)}`,
    PAGE_W - MARGIN_X,
    FOOTER_Y + 6
  );

  ctx.textAlign = 'left';
  ctx.fillStyle = '#0F172A';
  ctx.font = '600 13px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(`صفحة ${pageNum} من ${totalPages}`, MARGIN_X, FOOTER_Y + 6);
  ctx.restore();
}

export async function exportFloorPlanToPdf(options: PdfExportOptions): Promise<void> {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.ready;
    } catch {
      // ignore font loading timeout
    }
  }

  const logo = await loadLogoImage(BRAND_LOGO_URL);
  const { floorPlan, brandName, title } = options;
  const metrics = computeFloorPlanMetrics(floorPlan);

  const unitFactorArea = floorPlan.unit === 'ft' ? 10.7639 : 1;
  const unitFactorLen = floorPlan.unit === 'ft' ? 3.28084 : 1;

  const totalPerimeterM = floorPlan.rooms.reduce(
    (sum, r) => sum + 2 * (Math.max(0, r.width) + Math.max(0, r.depth)),
    0
  );
  const grossWallLengthM = floorPlan.walls.reduce(
    (sum, w) => sum + Math.hypot(w.x2 - w.x1, w.z2 - w.z1),
    0
  );
  const grossWallAreaSqm = floorPlan.walls.reduce(
    (sum, w) => sum + Math.hypot(w.x2 - w.x1, w.z2 - w.z1) * (w.height || floorPlan.wallHeight),
    0
  );
  const openingsAreaSqm = floorPlan.openings.reduce(
    (sum, op) => sum + Math.max(0, op.width * op.height),
    0
  );
  const netWallAreaSqm = Math.max(0, grossWallAreaSqm - openingsAreaSqm);

  const pages: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }[] = [];

  // ── Page 1: Cartouche + KPIs + Full 2D Architectural Blueprint ──
  const p1 = createPageCanvas();
  drawBlueprintPage(
    p1.ctx,
    logo,
    options,
    metrics,
    totalPerimeterM,
    grossWallLengthM,
    netWallAreaSqm
  );
  pages.push(p1);

  // ── Page 2+: Detailed Measurements & Furniture Inventory Tables ──
  let curPage = createPageCanvas();
  pages.push(curPage);
  let cursorY = drawContinuationHeader(
    curPage.ctx,
    logo,
    brandName,
    title,
    'تقرير القياسات وقائمة الأثاث'
  );

  const ensureSpace = (neededHeight: number) => {
    if (cursorY + neededHeight > BODY_BOTTOM_LIMIT) {
      curPage = createPageCanvas();
      pages.push(curPage);
      cursorY = drawContinuationHeader(
        curPage.ctx,
        logo,
        brandName,
        title,
        'تابع التقرير الهندسي وقائمة الأثاث'
      );
      return true;
    }
    return false;
  };

  // Section 1: Room Measurements Table
  const roomCols: TableColumn[] = [
    { label: '#', width: 56, align: 'center', ltr: true },
    { label: 'اسم الغرفة / الفضاء', width: 320, align: 'right' },
    { label: 'الأبعاد (عرض × طول)', width: 240, align: 'center', ltr: true },
    { label: 'المساحة', width: 150, align: 'center', ltr: true },
    { label: 'المحيط', width: 150, align: 'center', ltr: true },
    { label: 'خامة الأرضية', width: 212, align: 'right' },
  ];

  cursorY = drawSectionHeading(
    curPage.ctx,
    cursorY,
    '1. تفاصيل الغرف والقياسات وخامات الأرضيات',
    `الإجمالي: ${floorPlan.rooms.length} غرف (${formatArea(metrics.totalAreaSqm, floorPlan.unit)})`
  );

  if (floorPlan.rooms.length === 0) {
    curPage.ctx.save();
    curPage.ctx.direction = 'rtl';
    curPage.ctx.textAlign = 'right';
    curPage.ctx.fillStyle = '#64748B';
    curPage.ctx.font = '500 15px "IBM Plex Sans Arabic", sans-serif';
    curPage.ctx.fillText('لا توجد غرف مسجلة في هذا المخطط حالياً.', PAGE_W - MARGIN_X - 16, cursorY + 24);
    curPage.ctx.restore();
    cursorY += 54;
  } else {
    cursorY = drawTableHeader(curPage.ctx, cursorY, roomCols);
    floorPlan.rooms.forEach((room, idx) => {
      const flipped = ensureSpace(44);
      if (flipped) {
        cursorY = drawSectionHeading(
          curPage.ctx,
          cursorY,
          '1. تفاصيل الغرف والقياسات وخامات الأرضيات (تابع)',
          `غرف: ${floorPlan.rooms.length}`
        );
        cursorY = drawTableHeader(curPage.ctx, cursorY, roomCols);
      }
      const w = Math.max(0, room.width);
      const d = Math.max(0, room.depth);
      const areaSqm = w * d;
      const perimM = 2 * (w + d);
      const styleMeta = FLOOR_STYLES.find((fs) => fs.id === room.floorStyle);
      cursorY = drawTableRow(curPage.ctx, cursorY, idx, roomCols, [
        String(idx + 1),
        room.name || `غرفة ${idx + 1}`,
        `${formatLen(w, floorPlan.unit)} × ${formatLen(d, floorPlan.unit)}`,
        formatArea(areaSqm, floorPlan.unit),
        formatLen(perimM, floorPlan.unit),
        styleMeta?.label || room.floorStyle,
      ]);
    });

    // Summary footer row for rooms
    ensureSpace(48);
    curPage.ctx.save();
    curPage.ctx.fillStyle = '#EFF6FF';
    curPage.ctx.strokeStyle = '#93C5FD';
    curPage.ctx.lineWidth = 1.2;
    curPage.ctx.fillRect(MARGIN_X, cursorY, CONTENT_W, 42);
    curPage.ctx.strokeRect(MARGIN_X, cursorY, CONTENT_W, 42);
    curPage.ctx.direction = 'rtl';
    curPage.ctx.textAlign = 'right';
    curPage.ctx.textBaseline = 'middle';
    curPage.ctx.fillStyle = '#1E3A8A';
    curPage.ctx.font = '700 14px "IBM Plex Sans Arabic", sans-serif';
    curPage.ctx.fillText(
      `المجموع الهندسي: المساحة ${(metrics.totalAreaSqm * unitFactorArea).toFixed(2)} ${floorPlan.unit === 'ft' ? 'ft²' : 'م²'}  |  محيط الغرف ${(totalPerimeterM * unitFactorLen).toFixed(2)} ${floorPlan.unit === 'ft' ? 'ft' : 'm'}  |  أطوال الجدران ${(grossWallLengthM * unitFactorLen).toFixed(2)} ${floorPlan.unit === 'ft' ? 'ft' : 'm'}  |  صافي مساحة الطلاء ${(netWallAreaSqm * unitFactorArea).toFixed(2)} ${floorPlan.unit === 'ft' ? 'ft²' : 'م²'}`,
      PAGE_W - MARGIN_X - 18,
      cursorY + 21
    );
    curPage.ctx.restore();
    cursorY += 66;
  }

  // Section 2: Furniture & Appliances Table (grouped by item type + name + dimensions)
  const furnCols: TableColumn[] = [
    { label: '#', width: 56, align: 'center', ltr: true },
    { label: 'القطعة / الجهاز / الأداة', width: 372, align: 'right' },
    { label: 'الفئة', width: 220, align: 'right' },
    { label: 'الأبعاد (عرض × عمق × ارتفاع)', width: 340, align: 'center', ltr: true },
    { label: 'الكمية', width: 140, align: 'center', ltr: true },
  ];

  interface GroupedFurn {
    name: string;
    categoryLabel: string;
    width: number;
    depth: number;
    height: number;
    count: number;
  }

  const groupedMap = new Map<string, GroupedFurn>();
  floorPlan.furniture.forEach((item) => {
    const key = `${item.type}__${item.name}__${item.width.toFixed(2)}__${item.depth.toFixed(2)}__${item.height.toFixed(2)}`;
    const existing = groupedMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      groupedMap.set(key, {
        name: item.name,
        categoryLabel: CATEGORY_LABEL_MAP[item.category] || item.category,
        width: item.width,
        depth: item.depth,
        height: item.height,
        count: 1,
      });
    }
  });
  const groupedFurn = Array.from(groupedMap.values());

  ensureSpace(120);
  cursorY = drawSectionHeading(
    curPage.ctx,
    cursorY,
    '2. قائمة الأثاث والأجهزة والأدوات المستخدمة',
    `إجمالي القطع: ${floorPlan.furniture.length} قطعة (${groupedFurn.length} أصناف)`
  );

  if (groupedFurn.length === 0) {
    curPage.ctx.save();
    curPage.ctx.direction = 'rtl';
    curPage.ctx.textAlign = 'right';
    curPage.ctx.fillStyle = '#64748B';
    curPage.ctx.font = '500 15px "IBM Plex Sans Arabic", sans-serif';
    curPage.ctx.fillText('لا توجد قطع أثاث مضافة إلى هذا المخطط حالياً.', PAGE_W - MARGIN_X - 16, cursorY + 24);
    curPage.ctx.restore();
    cursorY += 54;
  } else {
    cursorY = drawTableHeader(curPage.ctx, cursorY, furnCols);
    groupedFurn.forEach((item, idx) => {
      const flipped = ensureSpace(44);
      if (flipped) {
        cursorY = drawSectionHeading(
          curPage.ctx,
          cursorY,
          '2. قائمة الأثاث والأجهزة والأدوات المستخدمة (تابع)',
          `إجمالي القطع: ${floorPlan.furniture.length}`
        );
        cursorY = drawTableHeader(curPage.ctx, cursorY, furnCols);
      }

      const dimStr =
        floorPlan.unit === 'ft'
          ? `${(item.width * 3.28084).toFixed(1)} × ${(item.depth * 3.28084).toFixed(1)} × ${(item.height * 3.28084).toFixed(1)} ft`
          : `${item.width.toFixed(2)} × ${item.depth.toFixed(2)} × ${item.height.toFixed(2)} m`;

      cursorY = drawTableRow(curPage.ctx, cursorY, idx, furnCols, [
        String(idx + 1),
        item.name,
        item.categoryLabel,
        dimStr,
        String(item.count),
      ]);
    });
  }

  // Stamp exact page numbers onto every page
  pages.forEach((p, idx) => {
    drawPageFooter(p.ctx, brandName, title, idx + 1, pages.length);
  });

  // Assemble A4 Portrait PDF
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  pages.forEach((p, idx) => {
    if (idx > 0) doc.addPage();
    const imgData = p.canvas.toDataURL('image/jpeg', 0.94);
    doc.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  });

  const safeName =
    (title || 'bachir-5d-plan')
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, '_') || 'bachir-5d-plan';

  doc.save(`${safeName}_2D_Plan.pdf`);
}
