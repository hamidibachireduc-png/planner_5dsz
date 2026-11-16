import { jsPDF } from 'jspdf';
import { formatDzd, formatMillionCentimes } from '../data/algeriaMarketPrices';
import { InvoiceCustomerInfo } from '../types/planner';

export interface InvoicePdfRow {
  section: 'furniture' | 'construction' | 'custom';
  title: string;
  subtitle?: string;
  quantityLabel: string;
  unitPriceDzd: number | null; // null = optional/unpriced
  totalDzd: number | null;
}

export interface InvoicePdfPayload {
  brandName: string;
  projectTitle: string;
  customer: InvoiceCustomerInfo;
  regionLabel: string;
  builtAreaSqm: number;
  furnitureSubtotalDzd: number;
  constructionSubtotalDzd: number;
  customSubtotalDzd: number;
  subtotalBeforeDiscountDzd: number;
  discountDzd: number;
  grandTotalDzd: number;
  rows: InvoicePdfRow[];
}

const PAGE_W = 1240;
const PAGE_H = 1754;
const MARGIN_X = 56;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const BODY_BOTTOM = PAGE_H - 125;

function loadLogo(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const t = window.setTimeout(() => resolve(null), 2500);
    img.onload = () => {
      window.clearTimeout(t);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(t);
      resolve(null);
    };
    img.src = src;
  });
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}...`).width > maxW) {
    out = out.slice(0, -1);
  }
  return `${out}...`;
}

function newSheet(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('تعذر تهيئة لوحة إنشاء الفاتورة');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.strokeRect(28, 28, PAGE_W - 56, PAGE_H - 56);
  return { canvas, ctx };
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  brandName: string,
  pageIndex: number,
  totalPages: number
): void {
  ctx.save();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(MARGIN_X, PAGE_H - 86);
  ctx.lineTo(PAGE_W - MARGIN_X, PAGE_H - 86);
  ctx.stroke();

  ctx.direction = 'rtl';
  ctx.textBaseline = 'middle';
  ctx.font = '500 14px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillStyle = '#475569';
  ctx.textAlign = 'right';
  ctx.fillText(
    `${brandName} · هاتف/واتساب: 0696380965 · BaridiMob RIP: 00799999000468867263`,
    PAGE_W - MARGIN_X,
    PAGE_H - 58
  );

  ctx.textAlign = 'left';
  ctx.fillText(`صفحة ${pageIndex} من ${totalPages}`, MARGIN_X, PAGE_H - 58);
  ctx.restore();
}

function drawInvoiceHeader(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement | null,
  payload: InvoicePdfPayload,
  isContinuation: boolean
): number {
  ctx.save();
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(MARGIN_X, 50, CONTENT_W, isContinuation ? 94 : 136);

  const rightX = PAGE_W - MARGIN_X - 24;
  if (logo) {
    const rad = isContinuation ? 28 : 40;
    const cy = isContinuation ? 97 : 118;
    ctx.save();
    ctx.beginPath();
    ctx.arc(rightX - rad, cy, rad, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(logo, rightX - rad * 2, cy - rad, rad * 2, rad * 2);
    ctx.restore();
  }

  const textRight = logo ? rightX - (isContinuation ? 70 : 98) : rightX;
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#FBBF24';
  ctx.font = '700 16px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(payload.brandName, textRight, isContinuation ? 80 : 86);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = isContinuation
    ? '700 22px "IBM Plex Sans Arabic", sans-serif'
    : '700 28px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(
    isContinuation ? `تابع فاتورة الحسابات — ${payload.projectTitle}` : 'فاتورة الحسابات والمقايسة التقديرية',
    textRight,
    isContinuation ? 114 : 124
  );

  if (!isContinuation) {
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '500 15px "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText(truncate(ctx, `المشروع: ${payload.projectTitle}`, 620), textRight, 158);
  }

  // Left side badge
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 18px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(`رقم: ${payload.customer.invoiceNumber}`, MARGIN_X + 24, isContinuation ? 86 : 92);
  ctx.fillStyle = '#CBD5E1';
  ctx.font = '500 14px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(`التاريخ: ${payload.customer.dateStr}`, MARGIN_X + 24, isContinuation ? 116 : 122);
  if (!isContinuation) {
    ctx.fillText(`المنطقة: ${payload.regionLabel}`, MARGIN_X + 24, 152);
  }
  ctx.restore();

  if (isContinuation) return 172;

  // Customer info strip
  let y = 204;
  ctx.save();
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(MARGIN_X, y, CONTENT_W, 86);
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(MARGIN_X, y, CONTENT_W, 86);

  ctx.direction = 'rtl';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';

  const col1X = PAGE_W - MARGIN_X - 24;
  const col2X = PAGE_W - MARGIN_X - 410;
  const col3X = PAGE_W - MARGIN_X - 770;

  ctx.fillStyle = '#64748B';
  ctx.font = '600 14px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText('العميل / المستفيد', col1X, y + 26);
  ctx.fillText('الهاتف والولاية', col2X, y + 26);
  ctx.fillText('المساحة المشمولة', col3X, y + 26);

  ctx.fillStyle = '#0F172A';
  ctx.font = '700 18px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(truncate(ctx, payload.customer.customerName || 'عميل استوديو التصميم', 340), col1X, y + 58);
  ctx.fillText(
    truncate(
      ctx,
      [payload.customer.customerPhone || '—', payload.customer.wilaya || 'الجزائر'].join(' · '),
      320
    ),
    col2X,
    y + 58
  );
  ctx.fillText(`${payload.builtAreaSqm.toFixed(1)} م²`, col3X, y + 58);
  ctx.restore();

  return y + 108;
}

function drawTableHeader(ctx: CanvasRenderingContext2D, y: number): number {
  ctx.save();
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(MARGIN_X, y, CONTENT_W, 44);
  ctx.direction = 'rtl';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 15px "IBM Plex Sans Arabic", sans-serif';

  ctx.textAlign = 'right';
  ctx.fillText('#', PAGE_W - MARGIN_X - 18, y + 22);
  ctx.fillText('البند / التسمية', PAGE_W - MARGIN_X - 64, y + 22);
  ctx.fillText('الكمية', PAGE_W - MARGIN_X - 620, y + 22);
  ctx.fillText('سعر الوحدة', PAGE_W - MARGIN_X - 790, y + 22);
  ctx.textAlign = 'left';
  ctx.fillText('الإجمالي (د.ج)', MARGIN_X + 20, y + 22);
  ctx.restore();
  return y + 44;
}

export async function exportInvoiceToPdf(payload: InvoicePdfPayload): Promise<void> {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await (document as Document & { fonts: FontFaceSet }).fonts.ready;
    } catch {
      // proceed
    }
  }

  const logo = await loadLogo('/assets/aistudio/image_8fd000e2.png');
  const pages: HTMLCanvasElement[] = [];

  let sheet = newSheet();
  let y = drawInvoiceHeader(sheet.ctx, logo, payload, false);
  y = drawTableHeader(sheet.ctx, y);

  const ensureSpace = (neededHeight: number, withTableHeader = true) => {
    if (y + neededHeight <= BODY_BOTTOM) return;
    pages.push(sheet.canvas);
    sheet = newSheet();
    y = drawInvoiceHeader(sheet.ctx, logo, payload, true);
    if (withTableHeader) {
      y = drawTableHeader(sheet.ctx, y);
    }
  };

  let lastSection: string | null = null;
  const SECTION_NAMES: Record<InvoicePdfRow['section'], string> = {
    furniture: 'أولاً: الأثاث والأجهزة المنزلية المختارة',
    construction: 'ثانياً: تقدير مواد البناء والدهن واليد العاملة (السوق الجزائري)',
    custom: 'ثالثاً: بنود وخدمات إضافية',
  };

  payload.rows.forEach((row, idx) => {
    if (row.section !== lastSection) {
      lastSection = row.section;
      ensureSpace(94, true);
      const ctx = sheet.ctx;
      ctx.save();
      ctx.fillStyle = '#EFF6FF';
      ctx.fillRect(MARGIN_X, y, CONTENT_W, 38);
      ctx.strokeStyle = '#BFDBFE';
      ctx.lineWidth = 1;
      ctx.strokeRect(MARGIN_X, y, CONTENT_W, 38);
      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#1D4ED8';
      ctx.font = '700 15px "IBM Plex Sans Arabic", sans-serif';
      ctx.fillText(SECTION_NAMES[row.section], PAGE_W - MARGIN_X - 18, y + 19);
      ctx.restore();
      y += 38;
    }

    const rowH = row.subtitle ? 52 : 42;
    ensureSpace(rowH, true);

    const ctx = sheet.ctx;
    ctx.save();
    ctx.fillStyle = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
    ctx.fillRect(MARGIN_X, y, CONTENT_W, rowH);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN_X, y + rowH);
    ctx.lineTo(PAGE_W - MARGIN_X, y + rowH);
    ctx.stroke();

    ctx.direction = 'rtl';
    ctx.textBaseline = 'middle';
    const midY = row.subtitle ? y + 19 : y + rowH / 2;

    ctx.textAlign = 'right';
    ctx.fillStyle = '#64748B';
    ctx.font = '600 14px "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText(String(idx + 1), PAGE_W - MARGIN_X - 18, midY);

    ctx.fillStyle = '#0F172A';
    ctx.font = '700 15px "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText(truncate(ctx, row.title, 520), PAGE_W - MARGIN_X - 64, midY);

    if (row.subtitle) {
      ctx.fillStyle = '#64748B';
      ctx.font = '500 12px "IBM Plex Sans Arabic", sans-serif';
      ctx.fillText(truncate(ctx, row.subtitle, 520), PAGE_W - MARGIN_X - 64, y + 38);
    }

    ctx.fillStyle = '#334155';
    ctx.font = '600 14px "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText(truncate(ctx, row.quantityLabel, 140), PAGE_W - MARGIN_X - 620, y + rowH / 2);

    ctx.fillText(
      row.unitPriceDzd !== null ? formatDzd(row.unitPriceDzd) : 'اختياري / غير مسعّر',
      PAGE_W - MARGIN_X - 790,
      y + rowH / 2
    );

    ctx.textAlign = 'left';
    ctx.fillStyle = row.totalDzd !== null ? '#0F172A' : '#94A3B8';
    ctx.font = '700 15px "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText(
      row.totalDzd !== null ? formatDzd(row.totalDzd) : '—',
      MARGIN_X + 20,
      y + rowH / 2
    );
    ctx.restore();
    y += rowH;
  });

  // Totals Summary Block
  y += 22;
  ensureSpace(240, false);

  const ctx = sheet.ctx;
  ctx.save();
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(MARGIN_X, y, CONTENT_W, 200);
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(MARGIN_X, y, CONTENT_W, 200);

  ctx.direction = 'rtl';
  ctx.textBaseline = 'middle';

  // Left half: Grand total highlight
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(MARGIN_X + 20, y + 20, 440, 160);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 14px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText('المبلغ الإجمالي النهائي المستحق', MARGIN_X + 436, y + 52);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 30px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(formatDzd(payload.grandTotalDzd), MARGIN_X + 436, y + 100);

  ctx.fillStyle = '#FBBF24';
  ctx.font = '700 16px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(
    `ما يعادل: ${formatMillionCentimes(payload.grandTotalDzd)}`,
    MARGIN_X + 436,
    y + 144
  );

  // Right half: Subtotals breakdown
  const rLabelX = PAGE_W - MARGIN_X - 24;
  const rValX = MARGIN_X + 490;
  const subLines: [string, string][] = [
    ['مجموع الأثاث والأجهزة المسعّرة:', formatDzd(payload.furnitureSubtotalDzd)],
    ['مجموع أشغال البناء والدهن:', formatDzd(payload.constructionSubtotalDzd)],
    ['بنود وخدمات إضافية:', formatDzd(payload.customSubtotalDzd)],
    [
      payload.customer.discountPct > 0
        ? `تخفيض (${payload.customer.discountPct}%):`
        : 'التخفيض:',
      payload.discountDzd > 0 ? `- ${formatDzd(payload.discountDzd)}` : '0 دج',
    ],
  ];

  subLines.forEach(([lbl, val], i) => {
    const lineY = y + 40 + i * 38;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#475569';
    ctx.font = '600 15px "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText(lbl, rLabelX, lineY);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#0F172A';
    ctx.font = '700 16px "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText(val, rValX, lineY);
  });
  ctx.restore();
  y += 216;

  if (payload.customer.notes.trim()) {
    ensureSpace(70, false);
    const nCtx = sheet.ctx;
    nCtx.save();
    nCtx.direction = 'rtl';
    nCtx.textAlign = 'right';
    nCtx.fillStyle = '#475569';
    nCtx.font = '600 14px "IBM Plex Sans Arabic", sans-serif';
    nCtx.fillText(
      truncate(nCtx, `ملاحظات: ${payload.customer.notes.trim()}`, CONTENT_W - 20),
      PAGE_W - MARGIN_X - 10,
      y + 18
    );
    nCtx.restore();
  }

  pages.push(sheet.canvas);

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();

  pages.forEach((canvas, idx) => {
    const c = canvas.getContext('2d');
    if (c) drawFooter(c, payload.brandName, idx + 1, pages.length);
    if (idx > 0) pdf.addPage();
    const imgData = canvas.toDataURL('image/png', 0.96);
    pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH, undefined, 'FAST');
  });

  const safeName =
    payload.projectTitle
      .trim()
      .replace(/[/\\?%*:|"<>]/g, '-')
      .replace(/\s+/g, '_') || 'invoice';
  pdf.save(`${safeName}_فاتورة.pdf`);
}
