import React, { useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Crown,
  Download,
  Eye,
  ImagePlus,
  Layers,
  Loader2,
  Lock,
  RefreshCw,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { computeFloorPlanMetrics, createBlankFloorPlan } from '../data/catalog';
import { FloorPlanData, SketchUnderlayConfig } from '../types/planner';
import { downloadProjectToDevice } from '../utils/projectFileIo';
import { TemplateBlueprintPreview } from './TemplateBlueprintPreview';

interface SketchToPlanModalProps {
  isOpen: boolean;
  brandName: string;
  isUserProActive: boolean;
  currentPlan?: FloorPlanData;
  onClose: () => void;
  onOpenProUpgrade: () => void;
  onApplySketchPlan: (payload: {
    title: string;
    floorPlan: FloorPlanData;
    underlay?: SketchUnderlayConfig | null;
  }) => void;
}

interface CompressedImageResult {
  dataUrl: string;
  base64: string;
  mimeType: string;
  aspectRatio: number;
  fileName: string;
}

async function compressSketchImage(file: File): Promise<CompressedImageResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة ملف الصورة.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('صيغة الصورة غير مدعومة.'));
      img.onload = () => {
        const maxSide = 1440;
        const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
        const targetW = Math.max(1, Math.round((img.width || 800) * scale));
        const targetH = Math.max(1, Math.round((img.height || 600) * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('تعذر معالجة الصورة في المتصفح.'));
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);

        const mimeType = 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, 0.86);
        const base64 = dataUrl.split(',')[1] || '';
        resolve({
          dataUrl,
          base64,
          mimeType,
          aspectRatio: targetW / targetH,
          fileName: file.name,
        });
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

export const SketchToPlanModal: React.FC<SketchToPlanModalProps> = ({
  isOpen,
  brandName,
  isUserProActive,
  currentPlan,
  onClose,
  onOpenProUpgrade,
  onApplySketchPlan,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [imageData, setImageData] = useState<CompressedImageResult | null>(null);
  const [projectTitle, setProjectTitle] = useState('');
  const [approxWidthM, setApproxWidthM] = useState<string>('');
  const [approxDepthM, setApproxDepthM] = useState<string>('');
  const [wallHeight, setWallHeight] = useState<number>(2.85);
  const [includeFurniture, setIncludeFurniture] = useState(true);
  const [attachUnderlay, setAttachUnderlay] = useState(true);

  const [converting, setConverting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<{
    title: string;
    notes: string;
    floorPlan: FloorPlanData;
  } | null>(null);

  if (!isOpen) return null;

  const handleSelectFile = async (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('يرجى اختيار ملف صورة صالح (JPG, PNG, WEBP).');
      return;
    }
    setErrorMsg(null);
    setResult(null);
    try {
      const compressed = await compressSketchImage(file);
      setImageData(compressed);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر قراءة الصورة.');
    }
  };

  const computeUnderlayForPlan = (plan?: FloorPlanData): SketchUnderlayConfig | null => {
    if (!imageData) return null;
    const wNum = Number(approxWidthM);
    const dNum = Number(approxDepthM);

    let widthM = Number.isFinite(wNum) && wNum >= 3 ? wNum : 12;
    let depthM = Number.isFinite(dNum) && dNum >= 3 ? dNum : Number((widthM / (imageData.aspectRatio || 1.33)).toFixed(2));

    if (plan && (plan.rooms.length > 0 || plan.walls.length > 0) && !(wNum >= 3 && dNum >= 3)) {
      const xs: number[] = [];
      const zs: number[] = [];
      plan.rooms.forEach((r) => {
        xs.push(r.x, r.x + r.width);
        zs.push(r.z, r.z + r.depth);
      });
      plan.walls.forEach((w) => {
        xs.push(w.x1, w.x2);
        zs.push(w.z1, w.z2);
      });
      if (xs.length > 0 && zs.length > 0) {
        widthM = Math.max(4, Number((Math.max(...xs) - Math.min(...xs)).toFixed(2)));
        depthM = Math.max(4, Number((Math.max(...zs) - Math.min(...zs)).toFixed(2)));
      }
    }

    return {
      dataUrl: imageData.dataUrl,
      widthM,
      depthM,
      opacity: 0.42,
      visible: true,
    };
  };

  const handleConvertSketch = async () => {
    if (!imageData) {
      setErrorMsg('يرجى رفع صورة الورقة المرسومة أولاً.');
      return;
    }
    setConverting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/sketch-to-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imageData.base64,
          mimeType: imageData.mimeType,
          approxWidthM: Number(approxWidthM) > 0 ? Number(approxWidthM) : undefined,
          approxDepthM: Number(approxDepthM) > 0 ? Number(approxDepthM) : undefined,
          wallHeight: Number(wallHeight) || 2.85,
          includeFurniture,
          projectTitle: projectTitle.trim() || undefined,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(
          'خدمة التحويل التلقائي بالذكاء الاصطناعي غير متاحة في الاستضافة الساكنة. يمكنك إدراج الصورة كخلفية رسم شفافة للرسم اليدوي مباشرة فوق الورقة.'
        );
      }

      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        title?: string;
        notes?: string;
        floorPlan?: FloorPlanData;
      };

      if (!res.ok || !data.ok || !data.floorPlan) {
        throw new Error(data.error || 'تعذر تحويل صورة الورقة إلى مخطط.');
      }

      setResult({
        title: data.title || projectTitle.trim() || 'مخطط من ورقة مرسومة',
        notes: data.notes || 'تم إنشاء المخطط من الورقة المرسومة بنجاح.',
        floorPlan: data.floorPlan,
      });
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'حدث خطأ أثناء تحويل الورقة. يمكنك استخدام خيار إدراج الصورة كخلفية شفافة للرسم فوقها.'
      );
    } finally {
      setConverting(false);
    }
  };

  const handleOpenGenerated = () => {
    if (!result) return;
    const underlay = attachUnderlay ? computeUnderlayForPlan(result.floorPlan) : null;
    onApplySketchPlan({
      title: result.title,
      floorPlan: result.floorPlan,
      underlay,
    });
    onClose();
  };

  const handleUseUnderlayOnly = () => {
    if (!imageData) return;
    const underlay = computeUnderlayForPlan();
    const basePlan: FloorPlanData = currentPlan
      ? structuredClone(currentPlan)
      : {
          ...createBlankFloorPlan(),
          rooms: [],
          walls: [],
          openings: [],
          furniture: [],
        };

    onApplySketchPlan({
      title: projectTitle.trim() || 'تصميم على ورقة مرسومة',
      floorPlan: basePlan,
      underlay,
    });
    onClose();
  };

  const resultMetrics = result ? computeFloorPlanMetrics(result.floorPlan) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-2.5 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sketch-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[92dvh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#181B20] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <ImagePlus className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                <Crown className="w-3.5 h-3.5 shrink-0" />
                <span>ميزة حصرية لباقة برو (Pro)</span>
              </div>
              <h2
                id="sketch-modal-title"
                className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate"
              >
                تحويل ورقة مرسومة أو صورة إلى تصميم 2D و 3D
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق النافذة"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto studio-scroll p-4 sm:p-6 pb-safe space-y-5">
          {!isUserProActive ? (
            /* Pro Paywall Gate */
            <div className="rounded-2xl border border-amber-300 dark:border-amber-800/80 bg-amber-50/70 dark:bg-amber-950/25 p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <div className="space-y-2 max-w-lg mx-auto">
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  ميزة إدراج وتحويل الورقة المرسومة متاحة في نسخة برو (Pro)
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  صوّر أي مخطط مرسوم بالقلم على الورق بالهاتف أو ارفعه من جهازك، وسيقوم الاستوديو بتحويله فوراً إلى مخطط هندسي 2D ومجسم 3D قابل للتعديل وحساب المساحات والتكلفة، أو إدراجه كخلفية شفافة للرسم المباشر.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-right max-w-2xl mx-auto text-xs">
                <div className="rounded-xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-slate-800 p-3 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white">1. قراءة الورقة بالذكاء</div>
                  <div className="text-slate-500 dark:text-slate-400">استخلاص الغرف والجدران والأبواب والأثاث تلقائياً.</div>
                </div>
                <div className="rounded-xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-slate-800 p-3 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white">2. خلفية تتبع شفافة</div>
                  <div className="text-slate-500 dark:text-slate-400">عرض صورة الورقة تحت المخطط 2D للتدقيق والرسم اليدوي.</div>
                </div>
                <div className="rounded-xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-slate-800 p-3 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white">3. 200 تصميم + مشاريع</div>
                  <div className="text-slate-500 dark:text-slate-400">فتح جميع القوالب الجزائرية الـ 200 بـ 1,000 د.ج/شهر فقط.</div>
                </div>
              </div>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenProUpgrade();
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white transition-colors"
                >
                  <Crown className="w-4 h-4" />
                  <span>اشترك في نسخة برو الآن (1,000 د.ج/شهر)</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  إغلاق
                </button>
              </div>
            </div>
          ) : (
            /* Pro Active Workflow */
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => void handleSelectFile(e.target.files?.[0])}
                className="hidden"
              />

              {!result ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  {/* Image Upload / Camera Preview */}
                  <div className="lg:col-span-6 space-y-3">
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        void handleSelectFile(e.dataTransfer.files?.[0]);
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      className="cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50 dark:bg-slate-900/50 p-4 min-h-[250px] flex flex-col items-center justify-center text-center transition-colors relative overflow-hidden"
                    >
                      {imageData ? (
                        <div className="w-full space-y-2.5">
                          <img
                            src={imageData.dataUrl}
                            alt="معاينة الورقة المرسومة"
                            className="w-full max-h-[280px] object-contain rounded-xl bg-white"
                          />
                          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
                            <span className="truncate max-w-[200px]">{imageData.fileName}</span>
                            <span className="text-blue-600 dark:text-blue-400 font-semibold">
                              اضغط لتغيير الصورة
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 py-6">
                          <div className="w-12 h-12 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                            <Camera className="w-6 h-6" />
                          </div>
                          <div className="space-y-1">
                            <div className="text-sm font-bold text-slate-900 dark:text-white">
                              ارفع صورة المخطط المرسوم على الورق أو التقطها بالكاميرا
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                              لأفضل نتيجة: صوّر الورقة من الأعلى بإضاءة واضحة مع ظهور الجدران وأسماء الغرف والأبعاد إن وجدت.
                            </p>
                          </div>
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 text-white px-4 py-2 text-xs font-semibold">
                            <Upload className="w-3.5 h-3.5" />
                            <span>اختيار صورة من الجهاز</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Settings & Actions */}
                  <div className="lg:col-span-6 space-y-4">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3.5 text-xs">
                      <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                        إعدادات تحويل الورقة إلى تصميم
                      </h3>

                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                          اسم التصميم (اختياري)
                        </label>
                        <input
                          type="text"
                          value={projectTitle}
                          onChange={(e) => setProjectTitle(e.target.value)}
                          placeholder="مثال: مخطط منزل على قطعة 12×10 م"
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                            العرض التقريبي (m)
                          </label>
                          <input
                            type="number"
                            min={3}
                            max={45}
                            step={0.5}
                            value={approxWidthM}
                            onChange={(e) => setApproxWidthM(e.target.value)}
                            placeholder="تلقائي"
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2 font-mono-nums"
                          />
                        </div>
                        <div>
                          <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                            الطول التقريبي (m)
                          </label>
                          <input
                            type="number"
                            min={3}
                            max={45}
                            step={0.5}
                            value={approxDepthM}
                            onChange={(e) => setApproxDepthM(e.target.value)}
                            placeholder="تلقائي"
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2 font-mono-nums"
                          />
                        </div>
                        <div>
                          <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                            ارتفاع الجدار (m)
                          </label>
                          <input
                            type="number"
                            min={2.2}
                            max={4.5}
                            step={0.05}
                            value={wallHeight}
                            onChange={(e) => setWallHeight(Number(e.target.value) || 2.85)}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2 font-mono-nums"
                          />
                        </div>
                      </div>

                      <div className="space-y-2 pt-1">
                        <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={includeFurniture}
                            onChange={(e) => setIncludeFurniture(e.target.checked)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>توزيع الأثاث والأجهزة المناسبة داخل الغرف تلقائياً</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={attachUnderlay}
                            onChange={(e) => setAttachUnderlay(e.target.checked)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>إظهار صورة الورقة كخلفية شفافة تحت مخطط 2D للتدقيق</span>
                        </label>
                      </div>
                    </div>

                    {errorMsg && (
                      <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-300 leading-relaxed">
                        {errorMsg}
                      </div>
                    )}

                    <div className="space-y-2.5">
                      <button
                        type="button"
                        disabled={!imageData || converting}
                        onClick={() => void handleConvertSketch()}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 py-3 px-4 text-xs sm:text-sm font-semibold text-white transition-colors"
                      >
                        {converting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>جارٍ تحليل الورقة وبناء التصميم 2D / 3D...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>تحويل الورقة إلى تصميم 2D و 3D تلقائياً</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={!imageData || converting}
                        onClick={handleUseUnderlayOnly}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 py-2.5 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
                      >
                        <Layers className="w-4 h-4 text-amber-600" />
                        <span>إدراج الصورة كخلفية شفافة فقط (للرسم اليدوي فوقها)</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Conversion Result Side-by-Side Comparison */
                <div className="space-y-4">
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="inline-flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{result.notes}</span>
                    </div>
                    {resultMetrics && (
                      <div className="font-mono-nums font-bold text-emerald-900 dark:text-emerald-200">
                        {resultMetrics.roomCount} غرف · {resultMetrics.totalAreaSqm} م² ·{' '}
                        {result.floorPlan.walls.length} جدار · {result.floorPlan.furniture.length} أثاث
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        الورقة المرسومة الأصلية
                      </div>
                      <div className="aspect-[16/11] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 overflow-hidden flex items-center justify-center p-2">
                        {imageData && (
                          <img
                            src={imageData.dataUrl}
                            alt="الورقة الأصلية"
                            className="max-w-full max-h-full object-contain rounded"
                          />
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-blue-600" />
                        <span>المخطط الهندسي المستخلص (2D جاهز للـ 3D)</span>
                      </div>
                      <div className="aspect-[16/11] rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <TemplateBlueprintPreview floorPlan={result.floorPlan} showRoomLabels />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setResult(null)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>تعديل الأبعاد / إعادة التحليل</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          downloadProjectToDevice({
                            title: result.title,
                            brandName,
                            floorPlanData: result.floorPlan,
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>تنزيل (.json)</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenGenerated}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white transition-colors"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>فتح التصميم في مساحة العمل 2D و 3D</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
