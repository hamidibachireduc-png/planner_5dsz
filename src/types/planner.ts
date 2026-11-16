export type UnitType = 'm' | 'ft';

export type RoomFloorStyle =
  | 'oak'
  | 'walnut'
  | 'marble'
  | 'tile'
  | 'concrete'
  | 'terrazzo'
  | 'carpet';

export type WallFinishColor =
  | '#F5F2EB'
  | '#EAE6DF'
  | '#D6D3CD'
  | '#CBD5E1'
  | '#D1FAE5'
  | '#1E293B'
  | '#B45309';

export interface Room {
  id: string;
  name: string;
  x: number; // left edge in meters
  z: number; // top edge in meters
  width: number; // in meters
  depth: number; // in meters
  floorStyle: RoomFloorStyle;
}

export interface Wall {
  id: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  thickness: number; // meters, e.g. 0.16
  height: number; // meters, e.g. 2.8
  color: string;
}

export type OpeningType = 'door' | 'window' | 'arch';

export interface Opening {
  id: string;
  wallId: string;
  type: OpeningType;
  offsetRatio: number; // 0.1 .. 0.9 along wall length
  width: number; // meters
  height: number; // meters
  sillHeight: number; // meters from floor (0 for door/arch, 0.9 for window)
  swing?: 'in' | 'out';
}

export type FurnitureCategory =
  | 'living'
  | 'bedroom'
  | 'kitchen'
  | 'appliances'
  | 'dining'
  | 'bathroom'
  | 'decor';

export type FurnitureType =
  | 'sofa_3'
  | 'sofa_l'
  | 'sofa_2'
  | 'armchair'
  | 'ottoman'
  | 'coffee_table'
  | 'console_table'
  | 'tv_stand'
  | 'rug'
  | 'bookshelf'
  | 'bed_double'
  | 'bed_single'
  | 'nightstand'
  | 'dresser'
  | 'crib'
  | 'wardrobe'
  | 'kitchen_counter'
  | 'kitchen_island'
  | 'fridge'
  | 'stove'
  | 'dishwasher'
  | 'microwave_oven'
  | 'range_hood'
  | 'coffee_machine'
  | 'washer'
  | 'dryer'
  | 'ac_split'
  | 'water_heater'
  | 'smart_tv_wall'
  | 'vacuum_robot'
  | 'air_purifier'
  | 'dining_set'
  | 'dining_round'
  | 'work_desk'
  | 'gaming_desk'
  | 'meeting_table'
  | 'bathtub'
  | 'vanity'
  | 'toilet'
  | 'bidet'
  | 'shower_cabin'
  | 'towel_warmer'
  | 'jacuzzi'
  | 'plant_olive'
  | 'floor_lamp'
  | 'wall_art'
  | 'chandelier'
  | 'curtain_panel'
  | 'outdoor_lounge'
  | 'piano'
  | 'corner_display_cabinet'
  | 'fireplace_modern'
  | 'bean_bag'
  | 'shoe_cabinet'
  | 'bunk_bed'
  | 'vanity_stool'
  | 'walk_in_closet'
  | 'pantry_cabinet'
  | 'bar_counter'
  | 'water_dispenser'
  | 'buffet_sideboard'
  | 'reading_nook'
  | 'double_vanity'
  | 'laundry_hamper'
  | 'pergola_swing'
  | 'islamic_screen'
  | 'algerian_sedari'
  | 'brass_tea_table'
  | 'privacy_partition'
  | 'hallway_coat_bench'
  | 'prayer_corner'
  | 'underbed_storage_bed'
  | 'sliding_wardrobe_mirror'
  | 'couscous_prep_counter'
  | 'freezer_chest'
  | 'gas_oven_5burner'
  | 'gas_heater_algerian'
  | 'water_tank_pump'
  | 'ablution_station'
  | 'turkish_hammam_bench'
  | 'outdoor_bbq_grill'
  | 'courtyard_fountain';

export interface FurnitureItem {
  id: string;
  catalogId?: string;
  type: FurnitureType;
  name: string;
  category: FurnitureCategory;
  x: number; // center X in meters
  z: number; // center Z in meters
  rotation: number; // radians around Y axis
  width: number; // meters
  depth: number; // meters
  height: number; // meters
  primaryColor: string;
  accentColor: string;
  priceDzd?: number; // optional item price in Algerian Dinar
}

export interface CatalogItemDef {
  catalogId: string;
  type: FurnitureType;
  name: string;
  category: FurnitureCategory;
  width: number;
  depth: number;
  height: number;
  defaultPrimary: string;
  defaultAccent: string;
  defaultPriceDzd?: number;
  styleTag?: string;
}

export interface InvoiceCustomItem {
  id: string;
  label: string;
  quantity: number;
  unit: string;
  unitPriceDzd: number;
}

export interface InvoiceCustomerInfo {
  customerName: string;
  customerPhone: string;
  wilaya: string;
  invoiceNumber: string;
  dateStr: string;
  discountPct: number;
  notes: string;
}

export interface FloorPlanData {
  rooms: Room[];
  walls: Wall[];
  openings: Opening[];
  furniture: FurnitureItem[];
  wallHeight: number;
  unit: UnitType;
}

export interface ProjectRecord {
  id: string;
  ownerId: string;
  title: string;
  description?: string;
  templateKey?: string;
  floorPlanData: FloorPlanData;
  roomCount: number;
  totalAreaSqm: number;
  createdAt?: unknown;
  updatedAt?: unknown;
  updatedAtMs?: number;
}

export interface UserStudioSettings {
  ownerId: string;
  brandName: string;
  preferredUnit: UnitType;
}

export type ViewMode = '2d' | '3d' | 'split';
export type EditorTool = 'select' | 'room' | 'wall' | 'door' | 'window';
export type CameraPreset = 'perspective' | 'isometric' | 'top' | 'walkthrough';
export type LightingMood = 'daylight' | 'golden' | 'evening';

export type ProPlanType = 'monthly' | 'annual';
export type PaymentMethod = 'baridimob' | 'flexy';
export type ContactChannel = 'whatsapp' | 'facebook';
export type ProOrderStatus = 'pending' | 'approved' | 'rejected';

export interface ProSubscriptionOrder {
  id: string;
  ownerId: string;
  customerName: string;
  contactPhone: string;
  contactChannel: ContactChannel;
  planType: ProPlanType;
  paymentMethod: PaymentMethod;
  baseAmountDzd: number;
  surchargeDzd: number;
  totalAmountDzd: number;
  receiptNote: string;
  status: ProOrderStatus;
  createdAtMs?: number;
}

export type UserAccountStatus = 'pending' | 'active' | 'suspended';

export interface UserAccountRecord {
  id: string;
  ownerId: string;
  email: string;
  displayName: string;
  phone: string;
  accountStatus: UserAccountStatus;
  proActive: boolean;
  proPlan: 'free' | 'monthly' | 'annual';
  notes?: string;
  createdAtMs?: number;
  updatedAtMs?: number;
}

export type SelectionTarget =
  | { kind: 'room'; id: string }
  | { kind: 'wall'; id: string }
  | { kind: 'opening'; id: string }
  | { kind: 'furniture'; id: string }
  | null;

export interface SketchUnderlayConfig {
  dataUrl: string;
  widthM: number;
  depthM: number;
  opacity: number;
  visible: boolean;
}

