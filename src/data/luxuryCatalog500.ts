import { CatalogItemDef, FurnitureCategory, FurnitureType } from '../types/planner';

interface ArchetypeBlueprint {
  slug: string;
  type: FurnitureType;
  category: FurnitureCategory;
  baseName: string;
  width: number;
  depth: number;
  height: number;
  basePriceDzd: number;
}

interface LuxuryEdition {
  suffix: string;
  tag: string;
  primary: string;
  accent: string;
  sizeScale: number;
  priceMult: number;
}

const LIVING_EDITIONS: LuxuryEdition[] = [
  { suffix: 'قسنطيني مطرّز بالذهبي', tag: 'طراز قسنطيني فاخر', primary: '#6B1D2F', accent: '#D4AF37', sizeScale: 1.08, priceMult: 1.35 },
  { suffix: 'عاصمي كلاسيك عاجي', tag: 'القصبة والجزائر', primary: '#EAE4D7', accent: '#B8860B', sizeScale: 1.04, priceMult: 1.25 },
  { suffix: 'وهراني مخمل أزرق ملكي', tag: 'طراز وهراني', primary: '#1E3A5F', accent: '#D4AF37', sizeScale: 1.06, priceMult: 1.3 },
  { suffix: 'تلمساني أندلسي زمردي', tag: 'طراز تلمساني', primary: '#14532D', accent: '#C9A227', sizeScale: 1.05, priceMult: 1.32 },
  { suffix: 'قبائلي خشب أرز منحوت', tag: 'حرفية جرجرة', primary: '#7C4A27', accent: '#B45309', sizeScale: 1.0, priceMult: 1.2 },
  { suffix: 'صحراوي واحاتي دافئ', tag: 'أصيل الجنوب', primary: '#9A3412', accent: '#F59E0B', sizeScale: 1.1, priceMult: 1.18 },
  { suffix: 'مودرن إيطالي رمادي فحمي', tag: 'تصميم معاصر', primary: '#334155', accent: '#CBD5E1', sizeScale: 1.0, priceMult: 1.15 },
];

const BEDROOM_EDITIONS: LuxuryEdition[] = [
  { suffix: 'ملكي مخمل بيج وذهبي', tag: 'جناح فندقي', primary: '#E7DFD1', accent: '#C9A227', sizeScale: 1.06, priceMult: 1.35 },
  { suffix: 'تركواز عاصمي معاصر', tag: 'تصميم راقٍ', primary: '#1E4E5F', accent: '#E2E8F0', sizeScale: 1.02, priceMult: 1.2 },
  { suffix: 'جوز أمريكي مع حواف نحاسية', tag: 'خشب طبيعي', primary: '#5C3A21', accent: '#D4AF37', sizeScale: 1.05, priceMult: 1.3 },
  { suffix: 'أبيض لؤلؤي ناعم', tag: 'إشراقة عصرية', primary: '#F8FAFC', accent: '#94A3B8', sizeScale: 0.98, priceMult: 1.1 },
  { suffix: 'أنثراسيت دخاني فاخر', tag: 'مودرن فيلا', primary: '#1E293B', accent: '#C2956E', sizeScale: 1.04, priceMult: 1.25 },
  { suffix: 'كشميري وردي هادئ', tag: 'غرف أنيقة', primary: '#C8A2A6', accent: '#7C5A3C', sizeScale: 1.0, priceMult: 1.15 },
];

const KITCHEN_EDITIONS: LuxuryEdition[] = [
  { suffix: 'رخام كلكتا وأبيض لامع', tag: 'مطابخ إكويبي', primary: '#F1F5F9', accent: '#D4AF37', sizeScale: 1.05, priceMult: 1.3 },
  { suffix: 'أسود مطفي وتفاصيل ذهبية', tag: 'فخامة حيدرة', primary: '#18181B', accent: '#C9A227', sizeScale: 1.06, priceMult: 1.38 },
  { suffix: 'خشب بلوط ورخام غري', tag: 'دافئ معاصر', primary: '#8C6239', accent: '#CBD5E1', sizeScale: 1.02, priceMult: 1.22 },
  { suffix: 'أخضر زيتوني وكروم', tag: 'موضة عالمية', primary: '#3F4E4F', accent: '#E2E8F0', sizeScale: 1.0, priceMult: 1.18 },
  { suffix: 'كحلي نيفي ورخام أبيض', tag: 'تصميم فيلات', primary: '#1E3A8A', accent: '#F8FAFC', sizeScale: 1.04, priceMult: 1.26 },
  { suffix: 'شامبان ساتيني وستانلس', tag: 'أجهزة برو', primary: '#D6CFC2', accent: '#334155', sizeScale: 1.0, priceMult: 1.2 },
];

const APPLIANCE_EDITIONS: LuxuryEdition[] = [
  { suffix: 'سلسلة إنفرتر الاقتصادية A++', tag: 'اقتصاد طاقة', primary: '#F8FAFC', accent: '#2563EB', sizeScale: 0.96, priceMult: 0.92 },
  { suffix: 'إصدار تروبيكال برو (مقاوم للحر)', tag: 'مناخ الجزائر', primary: '#E2E8F0', accent: '#0F172A', sizeScale: 1.02, priceMult: 1.12 },
  { suffix: 'إصدار إينوكس فضي فاخر', tag: 'ستانلس ستيل', primary: '#CBD5E1', accent: '#475569', sizeScale: 1.05, priceMult: 1.2 },
  { suffix: 'إصدار زجاج أسود سمارت Wi-Fi', tag: 'منزل ذكي', primary: '#0F172A', accent: '#38BDF8', sizeScale: 1.06, priceMult: 1.32 },
  { suffix: 'إصدار عائلي سعة كبرى XXL', tag: 'للعائلات الكبيرة', primary: '#334155', accent: '#94A3B8', sizeScale: 1.12, priceMult: 1.4 },
];

const DINING_EDITIONS: LuxuryEdition[] = [
  { suffix: 'رخام أونيكس وأرجل ذهبية', tag: 'ضيافة فخمة', primary: '#EAE6DF', accent: '#D4AF37', sizeScale: 1.08, priceMult: 1.38 },
  { suffix: 'خشب زان أوروبي 8 مقاعد', tag: 'طعام عائلي', primary: '#7C5A3C', accent: '#E7E2D8', sizeScale: 1.12, priceMult: 1.28 },
  { suffix: 'جوز داكن ومخمل زمردي', tag: 'كلاسيك حديث', primary: '#5C3A21', accent: '#14532D', sizeScale: 1.04, priceMult: 1.24 },
  { suffix: 'زجاج مدخن وفولاذ أسود', tag: 'استوديو مهندس', primary: '#1E293B', accent: '#64748B', sizeScale: 1.0, priceMult: 1.15 },
  { suffix: 'بلوط طبيعي فاتح اسكندنافي', tag: 'تصميم هادئ', primary: '#C59B6D', accent: '#F8FAFC', sizeScale: 0.98, priceMult: 1.08 },
];

const BATHROOM_EDITIONS: LuxuryEdition[] = [
  { suffix: 'رخام كرارا وإطار ذهبي مصقول', tag: 'جناح سبا', primary: '#F8FAFC', accent: '#D4AF37', sizeScale: 1.06, priceMult: 1.35 },
  { suffix: 'رخام أسود نيرو ماركينا', tag: 'فخامة مودرن', primary: '#1E293B', accent: '#C9A227', sizeScale: 1.05, priceMult: 1.32 },
  { suffix: 'أندلسي تقليدي بلمسة دافئة', tag: 'حمام جزائري', primary: '#DFD5C5', accent: '#78350F', sizeScale: 1.04, priceMult: 1.22 },
  { suffix: 'سيراميك أبيض ناصع وكروم', tag: 'تجهيز عملي', primary: '#FFFFFF', accent: '#94A3B8', sizeScale: 0.98, priceMult: 0.95 },
  { suffix: 'خشب تيك مقاوم للرطوبة', tag: 'لمسة طبيعية', primary: '#8C6239', accent: '#E2E8F0', sizeScale: 1.02, priceMult: 1.18 },
];

const DECOR_EDITIONS: LuxuryEdition[] = [
  { suffix: 'كريستال بوهيمي ونحاس مذهب', tag: 'قصور وفيلات', primary: '#D4AF37', accent: '#FEF3C7', sizeScale: 1.08, priceMult: 1.45 },
  { suffix: 'أرابيسك وزليج تلمساني', tag: 'تراث جزائري', primary: '#1E3A8A', accent: '#D4AF37', sizeScale: 1.04, priceMult: 1.28 },
  { suffix: 'قسنطيني نحاس مطروق يدوياً', tag: 'صناعة تقليدية', primary: '#B45309', accent: '#FEF08A', sizeScale: 1.0, priceMult: 1.22 },
  { suffix: 'راتان وحدائق متوسطية', tag: 'فضاءات خارجية', primary: '#9C734B', accent: '#4D7C4F', sizeScale: 1.06, priceMult: 1.18 },
  { suffix: 'أسود معماري بإنارة دافئة', tag: 'ديكور مودرن', primary: '#18181B', accent: '#F59E0B', sizeScale: 1.0, priceMult: 1.12 },
];

const LIVING_BLUEPRINTS: ArchetypeBlueprint[] = [
  { slug: 'sedari_royal', type: 'algerian_sedari', category: 'living', baseName: 'سدّاري جزائري ملكي', width: 2.8, depth: 0.9, height: 0.8, basePriceDzd: 165000 },
  { slug: 'sedari_u_grand', type: 'algerian_salon_u', category: 'living', baseName: 'صالة سداري U-Shape كامل للضياف', width: 3.5, depth: 2.4, height: 0.82, basePriceDzd: 265000 },
  { slug: 'sedari_corner', type: 'sofa_l', category: 'living', baseName: 'صالون زاوية فخم (L)', width: 3.1, depth: 2.1, height: 0.84, basePriceDzd: 210000 },
  { slug: 'clic_clac_salon', type: 'clic_clac_sofa', category: 'living', baseName: 'كنبة سرير كليك كلاك للهول', width: 2.1, depth: 1.08, height: 0.82, basePriceDzd: 78000 },
  { slug: 'sofa3_grand', type: 'sofa_3', category: 'living', baseName: 'فوتوي ثلاثي فاخر للصالة', width: 2.35, depth: 0.98, height: 0.85, basePriceDzd: 98000 },
  { slug: 'sofa2_duo', type: 'sofa_2', category: 'living', baseName: 'فوتوي ضيافة ثنائي', width: 1.75, depth: 0.9, height: 0.82, basePriceDzd: 72000 },
  { slug: 'berger_chair', type: 'armchair', category: 'living', baseName: 'فوتوي برجر استقبال', width: 0.9, depth: 0.9, height: 0.88, basePriceDzd: 42000 },
  { slug: 'pouf_lux', type: 'ottoman', category: 'living', baseName: 'بوف دائري مبطن (Pouf)', width: 0.7, depth: 0.7, height: 0.44, basePriceDzd: 18500 },
  { slug: 'tea_maida', type: 'brass_tea_table', category: 'living', baseName: 'مايدة شاي وصينية نحاسية', width: 0.9, depth: 0.9, height: 0.48, basePriceDzd: 36000 },
  { slug: 'coffee_marble', type: 'coffee_table', category: 'living', baseName: 'طابلة وسط صالون رخامية', width: 1.35, depth: 0.8, height: 0.42, basePriceDzd: 54000 },
  { slug: 'entry_console', type: 'console_table', category: 'living', baseName: 'كونسول هول بمرآة مزخرفة', width: 1.4, depth: 0.42, height: 1.8, basePriceDzd: 64000 },
  { slug: 'tv_wall_unit', type: 'tv_stand', category: 'living', baseName: 'موبل تيفي وديكور صالون', width: 2.1, depth: 0.48, height: 1.45, basePriceDzd: 88000 },
  { slug: 'rug_artisan', type: 'rug', category: 'living', baseName: 'زربية صالون فاخرة', width: 3.0, depth: 2.1, height: 0.03, basePriceDzd: 48000 },
  { slug: 'vitrine_glass', type: 'corner_display_cabinet', category: 'living', baseName: 'فيترينة عرض الكريستال والتحف', width: 1.05, depth: 0.48, height: 2.0, basePriceDzd: 76000 },
  { slug: 'fireplace_lux', type: 'fireplace_modern', category: 'living', baseName: 'شوميني صالون ديكوري رخامي', width: 1.7, depth: 0.48, height: 1.18, basePriceDzd: 115000 },
  { slug: 'privacy_mashrabiya', type: 'privacy_partition', category: 'living', baseName: 'حاجز خصوصية سدة وهول', width: 1.9, depth: 0.14, height: 2.15, basePriceDzd: 45000 },
  { slug: 'hall_bench', type: 'hallway_coat_bench', category: 'living', baseName: 'بورت مونتو وبورت شوسير للهول', width: 1.35, depth: 0.44, height: 1.88, basePriceDzd: 58000 },
];

const BEDROOM_BLUEPRINTS: ArchetypeBlueprint[] = [
  { slug: 'bed_king', type: 'bed_double', category: 'bedroom', baseName: 'سرير كينغ سايز فندقي', width: 2.0, depth: 2.2, height: 1.25, basePriceDzd: 125000 },
  { slug: 'bed_storage', type: 'underbed_storage_bed', category: 'bedroom', baseName: 'سرير كوفر بصندوق تخزين', width: 1.8, depth: 2.1, height: 1.15, basePriceDzd: 108000 },
  { slug: 'bed_single_teen', type: 'bed_single', category: 'bedroom', baseName: 'سرير شبابي مفرد منجد', width: 1.15, depth: 2.05, height: 1.0, basePriceDzd: 52000 },
  { slug: 'bed_bunk_kids', type: 'bunk_bed', category: 'bedroom', baseName: 'سرير أطفال طابقين عملي', width: 1.2, depth: 2.05, height: 1.8, basePriceDzd: 86000 },
  { slug: 'bed_crib_baby', type: 'crib', category: 'bedroom', baseName: 'سرير بيبي وأطفال خشبي', width: 1.4, depth: 0.8, height: 0.98, basePriceDzd: 44000 },
  { slug: 'nightstand_lux', type: 'nightstand', category: 'bedroom', baseName: 'طابلة دو نوي بدرجين', width: 0.58, depth: 0.46, height: 0.56, basePriceDzd: 19500 },
  { slug: 'dresser_mirror', type: 'dresser', category: 'bedroom', baseName: 'كوافوز غرفة نوم بمرآة واسعة', width: 1.4, depth: 0.48, height: 1.7, basePriceDzd: 68000 },
  { slug: 'vanity_led', type: 'vanity_stool', category: 'bedroom', baseName: 'كوافوز تزيين هوليود بإضاءة', width: 1.2, depth: 0.55, height: 1.48, basePriceDzd: 62000 },
  { slug: 'wardrobe_6door', type: 'wardrobe', category: 'bedroom', baseName: 'مارييو / بلاكار ملابس واسع', width: 2.2, depth: 0.64, height: 2.25, basePriceDzd: 135000 },
  { slug: 'sliding_closet', type: 'sliding_wardrobe_mirror', category: 'bedroom', baseName: 'بلاكار كوليسون بمرآة', width: 2.4, depth: 0.65, height: 2.3, basePriceDzd: 148000 },
  { slug: 'dressing_room', type: 'walk_in_closet', category: 'bedroom', baseName: 'دريسينغ زاوية متكامل', width: 2.4, depth: 1.7, height: 2.25, basePriceDzd: 220000 },
  { slug: 'prayer_nook', type: 'prayer_corner', category: 'bedroom', baseName: 'محراب وركن صلاة منزلي هادئ', width: 1.25, depth: 0.95, height: 0.8, basePriceDzd: 28000 },
];

const KITCHEN_BLUEPRINTS: ArchetypeBlueprint[] = [
  { slug: 'k_counter_luxe', type: 'kitchen_counter', category: 'kitchen', baseName: 'كوزينة إكويبي كاملة', width: 2.8, depth: 0.65, height: 0.92, basePriceDzd: 285000 },
  { slug: 'k_island_marble', type: 'kitchen_island', category: 'kitchen', baseName: 'إيلو كوزينة وسطي رخامي', width: 2.2, depth: 1.0, height: 0.92, basePriceDzd: 145000 },
  { slug: 'k_fridge_double', type: 'fridge', category: 'kitchen', baseName: 'فريجيدير ببابين Side-by-Side', width: 0.95, depth: 0.74, height: 1.88, basePriceDzd: 195000 },
  { slug: 'k_cooker_5b', type: 'gas_oven_5burner', category: 'kitchen', baseName: 'كويزينيير عائلية 5 شعلات', width: 0.92, depth: 0.66, height: 0.9, basePriceDzd: 89000 },
  { slug: 'k_oven_built', type: 'stove', category: 'kitchen', baseName: 'بلاك دو كويسون وفرن كاستري', width: 0.85, depth: 0.64, height: 0.9, basePriceDzd: 78000 },
  { slug: 'k_dish_14', type: 'dishwasher', category: 'kitchen', baseName: 'لاف فيسيل ذكية 14 غطاء', width: 0.62, depth: 0.62, height: 0.85, basePriceDzd: 94000 },
  { slug: 'k_tower_micro', type: 'microwave_oven', category: 'kitchen', baseName: 'كولون كوزينة بفرن وميكرو أوند', width: 0.66, depth: 0.62, height: 2.1, basePriceDzd: 125000 },
  { slug: 'k_hood_deco', type: 'range_hood', category: 'kitchen', baseName: 'لا هوت كوزينة ديكورية', width: 0.92, depth: 0.52, height: 0.9, basePriceDzd: 42000 },
  { slug: 'k_coffee_bar', type: 'coffee_machine', category: 'kitchen', baseName: 'بار إسبريسو وماشينة قهوة', width: 0.95, depth: 0.58, height: 1.28, basePriceDzd: 55000 },
  { slug: 'k_pantry_tall', type: 'pantry_cabinet', category: 'kitchen', baseName: 'بلاكار مؤونة طويل متعدد الأدراج', width: 0.95, depth: 0.62, height: 2.15, basePriceDzd: 79000 },
  { slug: 'k_bar_stools', type: 'bar_counter', category: 'kitchen', baseName: 'كاونتر بار فطور مع طابوري', width: 1.9, depth: 0.78, height: 1.06, basePriceDzd: 92000 },
  { slug: 'k_prep_table', type: 'couscous_prep_counter', category: 'kitchen', baseName: 'طابلة عجن وقصعة رخامية', width: 1.5, depth: 0.72, height: 0.88, basePriceDzd: 66000 },
  { slug: 'k_freezer_deep', type: 'freezer_chest', category: 'kitchen', baseName: 'كونجيلاتور أفقي عميق 450 لتر', width: 1.35, depth: 0.7, height: 0.88, basePriceDzd: 88000 },
  { slug: 'k_rack_storage', type: 'storage_rack', category: 'kitchen', baseName: 'إيطاجير تخزين للمؤونة والكراج', width: 1.25, depth: 0.46, height: 1.95, basePriceDzd: 28000 },
];

const APPLIANCE_BLUEPRINTS: ArchetypeBlueprint[] = [
  { slug: 'ac_12k', type: 'ac_split', category: 'appliances', baseName: 'كليماتيزور سبليت 12000 BTU', width: 0.95, depth: 0.25, height: 0.32, basePriceDzd: 78000 },
  { slug: 'ac_18k', type: 'ac_split', category: 'appliances', baseName: 'كليماتيزور سبليت 18000 BTU', width: 1.08, depth: 0.28, height: 0.34, basePriceDzd: 108000 },
  { slug: 'ac_24k', type: 'ac_split', category: 'appliances', baseName: 'كليماتيزور سبليت 24000 BTU للصالة', width: 1.18, depth: 0.3, height: 0.36, basePriceDzd: 138000 },
  { slug: 'ac_arm_48k', type: 'ac_armoire', category: 'appliances', baseName: 'كليماتيزور أرموار عمودي 48000 BTU', width: 0.58, depth: 0.42, height: 1.88, basePriceDzd: 215000 },
  { slug: 'washer_9k', type: 'washer', category: 'appliances', baseName: 'ماشينا لافي أوتوماتيك 9 كغ', width: 0.62, depth: 0.62, height: 0.85, basePriceDzd: 92000 },
  { slug: 'washer_12k', type: 'washer', category: 'appliances', baseName: 'ماشينا لافي عائلية 12 كغ', width: 0.66, depth: 0.66, height: 0.88, basePriceDzd: 124000 },
  { slug: 'dryer_hp', type: 'dryer', category: 'appliances', baseName: 'سيش لانج حراري 9 كغ', width: 0.62, depth: 0.62, height: 0.85, basePriceDzd: 112000 },
  { slug: 'tv_55', type: 'smart_tv_wall', category: 'appliances', baseName: 'تلفاز بلازما سمارت 55 بوصة', width: 1.25, depth: 0.12, height: 0.74, basePriceDzd: 84000 },
  { slug: 'tv_75', type: 'smart_tv_wall', category: 'appliances', baseName: 'تلفاز QLED سينما 75 بوصة', width: 1.68, depth: 0.14, height: 0.98, basePriceDzd: 175000 },
  { slug: 'tv_85', type: 'smart_tv_wall', category: 'appliances', baseName: 'شاشة عملاقة OLED 85 بوصة', width: 1.9, depth: 0.14, height: 1.1, basePriceDzd: 280000 },
  { slug: 'heater_water', type: 'water_heater', category: 'appliances', baseName: 'شوفو / شوف بان رقمي آمن', width: 0.46, depth: 0.42, height: 0.88, basePriceDzd: 42000 },
  { slug: 'chaudiere_24kw', type: 'chaudiere_boiler', category: 'appliances', baseName: 'شوديير تدفئة مركزية 24kW', width: 0.52, depth: 0.36, height: 0.84, basePriceDzd: 155000 },
  { slug: 'gas_radiator', type: 'gas_heater_algerian', category: 'appliances', baseName: 'شوفاج غاز سيراميك بمؤشر CO', width: 0.8, depth: 0.28, height: 0.68, basePriceDzd: 46000 },
  { slug: 'tank_1000', type: 'water_tank_pump', category: 'appliances', baseName: 'سيتيرنة ماء 1000 لتر وموتور صامت', width: 1.05, depth: 1.05, height: 1.45, basePriceDzd: 49000 },
  { slug: 'tank_2000', type: 'water_tank_pump', category: 'appliances', baseName: 'سيتيرنة ماء 2000 لتر وموتور للفيلات', width: 1.35, depth: 1.35, height: 1.65, basePriceDzd: 78000 },
  { slug: 'water_cooler', type: 'water_dispenser', category: 'appliances', baseName: 'فونتان مياه بارد وساخن رقمي', width: 0.36, depth: 0.38, height: 1.08, basePriceDzd: 36000 },
  { slug: 'robo_vac', type: 'vacuum_robot', category: 'appliances', baseName: 'أسبيراتور روبو ذكي بتفريغ ذاتي', width: 0.44, depth: 0.5, height: 0.38, basePriceDzd: 68000 },
  { slug: 'air_pure', type: 'air_purifier', category: 'appliances', baseName: 'جهاز تنقية وتعقيم الهواء HEPA', width: 0.4, depth: 0.4, height: 0.74, basePriceDzd: 44000 },
];

const DINING_BLUEPRINTS: ArchetypeBlueprint[] = [
  { slug: 'dining_6', type: 'dining_set', category: 'dining', baseName: 'طابلة مونجي فاخرة 6 كراسي', width: 1.9, depth: 1.4, height: 0.76, basePriceDzd: 115000 },
  { slug: 'dining_8_10', type: 'meeting_table', category: 'dining', baseName: 'مائدة استقبال عائلية 8–10 كراسي', width: 2.6, depth: 1.45, height: 0.76, basePriceDzd: 185000 },
  { slug: 'dining_circle', type: 'dining_round', category: 'dining', baseName: 'طابلة طعام دائرية بقرص دوار', width: 1.6, depth: 1.6, height: 0.76, basePriceDzd: 128000 },
  { slug: 'buffet_luxe', type: 'buffet_sideboard', category: 'dining', baseName: 'بوفي صالون ضيافة بمرآة', width: 1.85, depth: 0.5, height: 0.88, basePriceDzd: 96000 },
  { slug: 'desk_exec', type: 'work_desk', category: 'dining', baseName: 'مكتب عمل وتنفيذي فخم', width: 1.6, depth: 0.8, height: 0.76, basePriceDzd: 78000 },
  { slug: 'desk_arch', type: 'gaming_desk', category: 'dining', baseName: 'مكتب هندسة وتصميم بشاشتين', width: 1.75, depth: 0.88, height: 0.76, basePriceDzd: 89000 },
  { slug: 'library_nook', type: 'reading_nook', category: 'dining', baseName: 'ركن مطالعة بمكتبة فاخرة', width: 1.6, depth: 0.9, height: 1.95, basePriceDzd: 84000 },
  { slug: 'bookshelf_wide', type: 'bookshelf', category: 'dining', baseName: 'إيطاجير ومكتبة كتب منزلية', width: 1.4, depth: 0.4, height: 2.0, basePriceDzd: 58000 },
];

const BATHROOM_BLUEPRINTS: ArchetypeBlueprint[] = [
  { slug: 'jacuzzi_lux', type: 'jacuzzi', category: 'bathroom', baseName: 'جاكوزي مساج زاوية لشخصين', width: 1.65, depth: 1.65, height: 0.68, basePriceDzd: 240000 },
  { slug: 'tub_freestand', type: 'bathtub', category: 'bathroom', baseName: 'بانيوار استحمام إيلو قائم', width: 1.75, depth: 0.82, height: 0.62, basePriceDzd: 135000 },
  { slug: 'vanity_single', type: 'vanity', category: 'bathroom', baseName: 'موبيليي لافابو الحمام بمرآة LED', width: 1.05, depth: 0.52, height: 1.8, basePriceDzd: 68000 },
  { slug: 'vanity_double', type: 'double_vanity', category: 'bathroom', baseName: 'لافابو حمام مزدوج للأجنحة', width: 1.65, depth: 0.55, height: 1.8, basePriceDzd: 118000 },
  { slug: 'shower_walkin', type: 'shower_cabin', category: 'bathroom', baseName: 'كابينة دوش زجاج مقسى 8 مم', width: 1.1, depth: 1.1, height: 2.15, basePriceDzd: 85000 },
  { slug: 'wc_wallhung', type: 'toilet', category: 'bathroom', baseName: 'تواليت معلق بخزان مخفي (Suspendu)', width: 0.44, depth: 0.64, height: 0.78, basePriceDzd: 48000 },
  { slug: 'bidet_pro', type: 'bidet', category: 'bathroom', baseName: 'بيديه سيراميك صحي فاخر', width: 0.42, depth: 0.58, height: 0.42, basePriceDzd: 32000 },
  { slug: 'lavoir_balcon', type: 'laundry_sink_lavoir', category: 'bathroom', baseName: 'لافوار غسيل للبالكون والغسيل', width: 0.88, depth: 0.62, height: 0.86, basePriceDzd: 24000 },
  { slug: 'hammam_bench', type: 'turkish_hammam_bench', category: 'bathroom', baseName: 'حمام تقليدي بمقعد رخام مدفأ', width: 1.6, depth: 0.92, height: 0.65, basePriceDzd: 110000 },
  { slug: 'wudu_station', type: 'ablution_station', category: 'bathroom', baseName: 'مغسل وضوء منزلي مريح بالمقعد', width: 0.78, depth: 0.56, height: 0.74, basePriceDzd: 42000 },
  { slug: 'towel_radiator', type: 'towel_warmer', category: 'bathroom', baseName: 'سيش سيرفيات ديكوري', width: 0.62, depth: 0.14, height: 1.25, basePriceDzd: 29000 },
  { slug: 'laundry_unit', type: 'laundry_hamper', category: 'bathroom', baseName: 'بلكار غسيل ومنظفات للحمام', width: 0.9, depth: 0.46, height: 0.95, basePriceDzd: 36000 },
];

const DECOR_BLUEPRINTS: ArchetypeBlueprint[] = [
  { slug: 'chand_palace', type: 'chandelier', category: 'decor', baseName: 'لوستر وثريا قصر متعددة الطبقات', width: 1.0, depth: 1.0, height: 0.65, basePriceDzd: 95000 },
  { slug: 'fountain_patio', type: 'courtyard_fountain', category: 'decor', baseName: 'نافورة وسط الدار تقليدية', width: 1.4, depth: 1.4, height: 1.0, basePriceDzd: 145000 },
  { slug: 'mirror_arch_hall', type: 'wall_mirror_arch', category: 'decor', baseName: 'مرآة مقوسة عصرية للهول والصالون', width: 0.98, depth: 0.1, height: 1.9, basePriceDzd: 38000 },
  { slug: 'screen_arabesque', type: 'islamic_screen', category: 'decor', baseName: 'فاصل أرابيسك ومشربية ديكور', width: 1.5, depth: 0.12, height: 2.2, basePriceDzd: 52000 },
  { slug: 'pergola_garden', type: 'pergola_swing', category: 'decor', baseName: 'بيرغولا وأرجوحة جاردان عائلية', width: 2.1, depth: 1.4, height: 2.15, basePriceDzd: 135000 },
  { slug: 'terrace_lounge', type: 'outdoor_lounge', category: 'decor', baseName: 'صالون جاردان وتيراس خارجي', width: 2.4, depth: 1.6, height: 0.8, basePriceDzd: 148000 },
  { slug: 'bbq_stone', type: 'outdoor_bbq_grill', category: 'decor', baseName: 'شواية حجرية فخمة للسطح والحوش', width: 1.45, depth: 0.75, height: 1.9, basePriceDzd: 78000 },
  { slug: 'curtain_royal', type: 'curtain_panel', category: 'decor', baseName: 'ريدوات وستائر صالون مزدوجة', width: 2.4, depth: 0.2, height: 2.6, basePriceDzd: 44000 },
  { slug: 'floor_lamp_lux', type: 'floor_lamp', category: 'decor', baseName: 'أباجور أرضي ديكوري طويل', width: 0.48, depth: 0.48, height: 1.78, basePriceDzd: 26000 },
  { slug: 'art_calligraphy', type: 'wall_art', category: 'decor', baseName: 'تابلو خط عربي وفن جداري مذهب', width: 1.25, depth: 0.08, height: 0.88, basePriceDzd: 24000 },
  { slug: 'olive_tree_pot', type: 'plant_olive', category: 'decor', baseName: 'شجرة زيتون ديكورية بإناء فخاري', width: 0.7, depth: 0.7, height: 1.75, basePriceDzd: 21000 },
  { slug: 'piano_grand', type: 'piano', category: 'decor', baseName: 'بيانو ديكوري راقٍ للصالون', width: 1.55, depth: 0.68, height: 1.1, basePriceDzd: 290000 },
];

function expandBlueprints(
  blueprints: ArchetypeBlueprint[],
  editions: LuxuryEdition[],
  prefix: string
): CatalogItemDef[] {
  const list: CatalogItemDef[] = [];
  for (let bIdx = 0; bIdx < blueprints.length; bIdx += 1) {
    const bp = blueprints[bIdx];
    for (let eIdx = 0; eIdx < editions.length; eIdx += 1) {
      const ed = editions[eIdx];
      const roundDim = (val: number, min: number) =>
        Math.max(min, Number((val * ed.sizeScale).toFixed(2)));
      const priceDzd = Math.round((bp.basePriceDzd * ed.priceMult) / 500) * 500;
      list.push({
        catalogId: `${prefix}_${bp.slug}_ed${eIdx + 1}`,
        type: bp.type,
        name: `${bp.baseName} — ${ed.suffix}`,
        category: bp.category,
        width: roundDim(bp.width, 0.35),
        depth: roundDim(bp.depth, 0.08),
        height: roundDim(bp.height, 0.03),
        defaultPrimary: ed.primary,
        defaultAccent: ed.accent,
        defaultPriceDzd: priceDzd,
        styleTag: ed.tag,
      });
    }
  }
  return list;
}

export const LUXURY_ALGERIAN_CATALOG_ITEMS: CatalogItemDef[] = [
  ...expandBlueprints(LIVING_BLUEPRINTS, LIVING_EDITIONS, 'dz_liv'),
  ...expandBlueprints(BEDROOM_BLUEPRINTS, BEDROOM_EDITIONS, 'dz_bed'),
  ...expandBlueprints(KITCHEN_BLUEPRINTS, KITCHEN_EDITIONS, 'dz_kit'),
  ...expandBlueprints(APPLIANCE_BLUEPRINTS, APPLIANCE_EDITIONS, 'dz_app'),
  ...expandBlueprints(DINING_BLUEPRINTS, DINING_EDITIONS, 'dz_din'),
  ...expandBlueprints(BATHROOM_BLUEPRINTS, BATHROOM_EDITIONS, 'dz_bath'),
  ...expandBlueprints(DECOR_BLUEPRINTS, DECOR_EDITIONS, 'dz_dec'),
];
// Total added items = 105 + 72 + 78 + 80 + 40 + 55 + 55 = 485 luxury items (+ 82 base items = 567 total catalog designs)
