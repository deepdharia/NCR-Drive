import type { Point } from '../core/math';
import type { HumanVariant } from '../people/HumanoidView';
import type { ShopItem } from '../systems/Neighborhood';

/** Shared data for the Parks & Shopping milestone. Geometry, shops, activities
 * and map places all read from here, so a label or position changes in one place.
 * Storefront names are data-driven: `brand` is the requested name, `fictional`
 * is the alternative. Signage uses `shopLabel()`; set USE_FICTIONAL_NAMES to
 * swap every sign without rebuilding geometry. No logos or product photos are
 * used — signage is original typography via signTexture. */
export const USE_FICTIONAL_NAMES = false;
export type ShopKind = 'fashion' | 'streetwear' | 'flowers' | 'sweets' | 'bakery' | 'cafe';
export type PlaceCategory = 'park' | 'shopping' | 'food' | 'flowers' | 'activity' | 'viewpoint';
export interface ClusterShop {
  id: string; cluster: string; kind: ShopKind;
  brand: string; fictional: string; hindi: string;
  /** Shop centre. The frontage faces `frontYaw`; the counter sits 2 m in front. */
  position: Point; frontYaw: number; width: number; depth: number; height: number;
  counter: Point; item?: ShopItem; price: number; blurb: string; goodsJob?: string;
}
export interface ClusterSeat { id: string; cluster: string; x: number; z: number; yaw: number; }
export interface ClusterPlace { id: string; name: string; category: PlaceCategory; arrival: Point; blurb: string; }
export interface GoodsJobDef { id: string; name: string; pickupShop: string; dropoffShop: string; dropoff: Point; reward: number; brief: string; }
export interface PopulationSpec {
  variants: HumanVariant[];
  vendors: { position: Point; shop: number }[];
  shopTargets: Point[];
  walkerSpawns: Point[];
  seats: { id: string; x: number; z: number; yaw: number }[];
  leaveTarget: (shop: number) => Point;
}
export interface Cluster {
  id: string; name: string; arrival: Point;
  shops: ClusterShop[]; seats: ClusterSeat[];
  board?: Point; circuit?: Point[];
  photo?: Point; photoYaw?: number;
  parking: { x: number; z: number; yaw: number; w: number; d: number };
  signs: { x: number; z: number; yaw: number; text: string }[];
  population: PopulationSpec;
  place: ClusterPlace;
}

const facing = (x: number, z: number, yaw: number, depth: number): Point => ({ x: x + Math.sin(yaw) * (depth / 2 + 2), z: z + Math.cos(yaw) * (depth / 2 + 2) });
export function shopLabel(shop: ClusterShop): string { return USE_FICTIONAL_NAMES ? shop.fictional : shop.brand; }

const GARDEN_VARIANTS: HumanVariant[] = [
 { shirt: 0xe8e2d2, trousers: 0x9a8a6a, shoes: 0x4a3220, skin: 0x8f5f3e, hair: 0x1a1512, scale: 1, accessory: 'none', phase: 0 },
 { shirt: 0xd8cdb4, trousers: 0x3a3f4a, shoes: 0x2e2620, skin: 0xa67a52, hair: 0x9a9a9a, scale: 1, accessory: 'none', phase: 0.3 },
 { shirt: 0x7a3a3a, trousers: 0x2e3d52, shoes: 0x1f1c1a, skin: 0xb08a68, hair: 0x1f1a16, scale: 1.02, accessory: 'cap', phase: 0.9 },
 { shirt: 0x4a6b4a, trousers: 0x8a7a58, shoes: 0x4a3220, skin: 0x8a5a3b, hair: 0x14100d, scale: 0.98, accessory: 'bag', phase: 1.3 },
 { shirt: 0xc97a7a, trousers: 0x4a4a4a, shoes: 0x2e2620, skin: 0xc09a78, hair: 0x2a201a, scale: 1, accessory: 'none', phase: 0.2 },
];
const GURGAON_VARIANTS: HumanVariant[] = [
 { shirt: 0x2e2e38, trousers: 0x1f1c1a, shoes: 0x1f1c1a, skin: 0x9a6b4a, hair: 0x0f0d0b, scale: 1, accessory: 'none', phase: 0 },
 { shirt: 0xe4e0d4, trousers: 0x2e3442, shoes: 0x2e2620, skin: 0xb08a68, hair: 0x201a14, scale: 1, accessory: 'none', phase: 0.4 },
 { shirt: 0x4a6b8a, trousers: 0x33383f, shoes: 0x352e29, skin: 0x8f5f3e, hair: 0x1a1512, scale: 1.01, accessory: 'bag', phase: 0.8 },
 { shirt: 0x8a5a3a, trousers: 0x4a4a4a, shoes: 0x2e2620, skin: 0xc09a78, hair: 0x2a201a, scale: 0.99, accessory: 'none', phase: 1.2 },
 { shirt: 0x6b4a7a, trousers: 0x2e2e38, shoes: 0x1f1c1a, skin: 0xb08a68, hair: 0x241c16, scale: 1.02, accessory: 'cap', phase: 1.6 },
 { shirt: 0xc9a03a, trousers: 0x2c3240, shoes: 0x352e29, skin: 0x9a6b4a, hair: 0x1f1a16, scale: 1, accessory: 'none', phase: 0.6 },
 { shirt: 0xd8cdb4, trousers: 0x5a4632, shoes: 0x4a3220, skin: 0x8f5f3e, hair: 0x9a9a9a, scale: 1, accessory: 'none', phase: 1.1 },
];
const NOIDA_VARIANTS: HumanVariant[] = [
 { shirt: 0xe8e2d2, trousers: 0x9a8a6a, shoes: 0x4a3220, skin: 0x8f5f3e, hair: 0x1a1512, scale: 1, accessory: 'none', phase: 0 },
 { shirt: 0xd8cdb4, trousers: 0x3a3f4a, shoes: 0x2e2620, skin: 0xa67a52, hair: 0x201a14, scale: 1, accessory: 'none', phase: 0.5 },
 { shirt: 0x2e4a6e, trousers: 0xa08a68, shoes: 0x4a3220, skin: 0x7a4e30, hair: 0x0f0d0b, scale: 0.97, accessory: 'bag', phase: 0.9 },
 { shirt: 0xc97a7a, trousers: 0x4a4a4a, shoes: 0x2e2620, skin: 0xc09a78, hair: 0x2a201a, scale: 1, accessory: 'none', phase: 1.4 },
 { shirt: 0x4a6b4a, trousers: 0x8a7a58, shoes: 0x4a3220, skin: 0x8a5a3b, hair: 0x14100d, scale: 0.98, accessory: 'cap', phase: 0.2 },
 { shirt: 0x7a3a3a, trousers: 0x2e3d52, shoes: 0x1f1c1a, skin: 0xb08a68, hair: 0x1f1a16, scale: 1.02, accessory: 'none', phase: 1.8 },
 { shirt: 0xe4e0d4, trousers: 0x5a4632, shoes: 0x4a3220, skin: 0x8f5f3e, hair: 0x1a1512, scale: 0.99, accessory: 'bag', phase: 0.7 },
];
const YAMUNA_VARIANTS: HumanVariant[] = [
 { shirt: 0x4a6b8a, trousers: 0x33383f, shoes: 0x352e29, skin: 0x8f5f3e, hair: 0x1a1512, scale: 1, accessory: 'cap', phase: 0.3 },
 { shirt: 0xc97a7a, trousers: 0x4a4a4a, shoes: 0x2e2620, skin: 0xc09a78, hair: 0x2a201a, scale: 1, accessory: 'none', phase: 1.1 },
];

const gardenFlowers: ClusterShop = { id: 'garden-flowers', cluster: 'garden-stop', kind: 'flowers', brand: 'Highway Blooms', fictional: 'Highway Blooms', hindi: 'हाईवे ब्लूम्स', position: { x: -1391, z: 1194 }, frontYaw: -1.22, width: 12, depth: 8, height: 4.5, counter: facing(-1391, 1194, -1.22, 8), item: 'flowers', price: 120, blurb: 'Fresh bouquets and gift boxes, wrapped to travel. Fictional game currency only.', goodsJob: 'flower-order' };
const gardenSweets: ClusterShop = { id: 'garden-sweets', cluster: 'garden-stop', kind: 'sweets', brand: 'Halwai Corner', fictional: 'Halwai Corner', hindi: 'हलवाई कॉर्नर', position: { x: -1386, z: 1216 }, frontYaw: -2.05, width: 12, depth: 8, height: 4.5, counter: facing(-1386, 1216, -2.05, 8), item: 'sweets', price: 90, blurb: 'Hot jalebi, laddoo trays and takeaway boxes. Fictional game currency only.' };
const gurgaonSouled: ClusterShop = { id: 'gurgaon-souled', cluster: 'gurgaon-boulevard', kind: 'streetwear', brand: 'The Souled Store', fictional: 'Soul Street', hindi: 'द सोल्ड स्टोर', position: { x: -1720, z: 2005 }, frontYaw: 0, width: 24, depth: 10, height: 5.5, counter: facing(-1720, 2005, 0, 10), price: 0, blurb: 'Graphic tees and streetwear. Browsing only — wardrobe changes arrive in a later update.' };
const gurgaonHM: ClusterShop = { id: 'gurgaon-hm', cluster: 'gurgaon-boulevard', kind: 'fashion', brand: 'H&M', fictional: 'AURA Fashion', hindi: 'एच एंड एम', position: { x: -1680, z: 2005 }, frontYaw: 0, width: 24, depth: 10, height: 5.5, counter: facing(-1680, 2005, 0, 10), price: 0, blurb: 'Contemporary fashion, mannequins and racks. Browsing only — wardrobe changes arrive in a later update.' };
const gurgaonZara: ClusterShop = { id: 'gurgaon-zara', cluster: 'gurgaon-boulevard', kind: 'fashion', brand: 'Zara', fictional: 'ZINE', hindi: 'ज़ारा', position: { x: -1640, z: 2005 }, frontYaw: 0, width: 24, depth: 10, height: 5.5, counter: facing(-1640, 2005, 0, 10), price: 0, blurb: 'Sharp tailoring and seasonal edits. Browsing only — wardrobe changes arrive in a later update.' };
const gurgaonFNP: ClusterShop = { id: 'gurgaon-fnp', cluster: 'gurgaon-boulevard', kind: 'flowers', brand: 'FNP', fictional: 'Bloom & Gift Co.', hindi: 'एफएनपी', position: { x: -1600, z: 2005 }, frontYaw: 0, width: 24, depth: 10, height: 5.5, counter: facing(-1600, 2005, 0, 10), item: 'flowers', price: 150, blurb: 'Bouquets, gift boxes and wrapping counter. Fictional game currency only.', goodsJob: 'flower-order' };
const gurgaonCafe: ClusterShop = { id: 'gurgaon-cafe', cluster: 'gurgaon-boulevard', kind: 'cafe', brand: 'Brew & Crumb', fictional: 'Brew & Crumb', hindi: 'ब्रू एंड क्रंब', position: { x: -1565, z: 2005 }, frontYaw: 0, width: 24, depth: 10, height: 5.5, counter: facing(-1565, 2005, 0, 10), item: 'cake', price: 140, blurb: 'Cakes, bakes and a collection counter. Fictional game currency only.' };
const noidaSweets: ClusterShop = { id: 'noida-sweets', cluster: 'noida-park', kind: 'sweets', brand: 'Aggarwal Sweets', fictional: 'Sharma Sweets', hindi: 'अग्रवाल स्वीट्स', position: { x: 2010, z: 1180 }, frontYaw: Math.PI, width: 16, depth: 8, height: 4.5, counter: facing(2010, 1180, Math.PI, 8), item: 'sweets', price: 90, blurb: 'Glass display counter, fresh trays and takeaway boxes. Fictional game currency only.' };
const noidaBakery: ClusterShop = { id: 'noida-bakery', cluster: 'noida-park', kind: 'bakery', brand: 'Crumb & Co.', fictional: 'Crumb & Co.', hindi: 'क्रंब एंड कंपनी', position: { x: 2050, z: 1180 }, frontYaw: Math.PI, width: 16, depth: 8, height: 4.5, counter: facing(2050, 1180, Math.PI, 8), item: 'cake', price: 130, blurb: 'Cake display, menu and collection counter. Fictional game currency only.', goodsJob: 'cake-order' };
const noidaWear: ClusterShop = { id: 'noida-wear', cluster: 'noida-park', kind: 'fashion', brand: 'Campus Wear', fictional: 'Campus Wear', hindi: 'कैंपस वियर', position: { x: 2090, z: 1180 }, frontYaw: Math.PI, width: 16, depth: 8, height: 4.5, counter: facing(2090, 1180, Math.PI, 8), price: 0, blurb: 'Casual clothing and everyday fits. Browsing only — wardrobe changes arrive in a later update.' };

export const CLUSTERS: Cluster[] = [
 {
  id: 'garden-stop', name: 'Garden Stop · Corridor', arrival: { x: -1400, z: 1250 },
  shops: [gardenFlowers, gardenSweets],
  seats: [
   { id: 'garden-bench-n', cluster: 'garden-stop', x: -1415, z: 1189, yaw: 0 },
   { id: 'garden-bench-e', cluster: 'garden-stop', x: -1400, z: 1204, yaw: -Math.PI / 2 },
   { id: 'garden-bench-s', cluster: 'garden-stop', x: -1415, z: 1219, yaw: Math.PI },
  ],
  parking: { x: -1470, z: 1210, yaw: -2.398, w: 22, d: 12 },
  signs: [
   { x: -1353.6, z: 1201.4, yaw: -0.71, text: 'GARDEN STOP → 100 m' },
   { x: -1430, z: 1230, yaw: -0.71, text: 'GARDEN STOP · PARKING' },
  ],
  population: {
   variants: GARDEN_VARIANTS,
   vendors: [{ position: { x: -1396.6, z: 1196.1 }, shop: 0 }, { position: { x: -1391.3, z: 1213.2 }, shop: 1 }],
   shopTargets: [{ x: -1398.5, z: 1196.8 }, { x: -1393.1, z: 1212.3 }],
   walkerSpawns: [{ x: -1415, z: 1189 }, { x: -1400, z: 1204 }, { x: -1415, z: 1219 }],
   seats: [
    { id: 'garden-bench-n', x: -1415, z: 1189, yaw: 0 },
    { id: 'garden-bench-e', x: -1400, z: 1204, yaw: -Math.PI / 2 },
    { id: 'garden-bench-s', x: -1415, z: 1219, yaw: Math.PI },
   ],
   leaveTarget: () => ({ x: -1444, z: 1202 }),
  },
  place: { id: 'garden-stop', name: 'Garden Stop · Corridor', category: 'flowers', arrival: { x: -1400, z: 1250 }, blurb: 'Roadside garden, flowers and sweets off NH-48 near Rajokri.' },
 },
 {
  id: 'gurgaon-boulevard', name: 'Gurugram Shopping Boulevard', arrival: { x: -1775, z: 2075 },
  shops: [gurgaonSouled, gurgaonHM, gurgaonZara, gurgaonFNP, gurgaonCafe],
  seats: [
   { id: 'plaza-bench-w', cluster: 'gurgaon-boulevard', x: -1715, z: 2030, yaw: 0 },
   { id: 'plaza-bench-c', cluster: 'gurgaon-boulevard', x: -1675, z: 2030, yaw: 0 },
   { id: 'plaza-bench-e', cluster: 'gurgaon-boulevard', x: -1635, z: 2030, yaw: 0 },
  ],
  parking: { x: -1830, z: 2030, yaw: 0, w: 93, d: 30 },
  signs: [
   { x: -1765, z: 2090, yaw: 0, text: 'GURGAON SHOPPING →' },
   { x: -1700, z: 2030, yaw: 0, text: 'PLAZA · SHOPS' },
  ],
  population: {
   variants: GURGAON_VARIANTS,
   vendors: [{ position: { x: -1600, z: 2012 }, shop: 3 }, { position: { x: -1565, z: 2012 }, shop: 4 }],
   shopTargets: [{ x: -1720, z: 2012 }, { x: -1680, z: 2012 }, { x: -1640, z: 2012 }, { x: -1600, z: 2012 }, { x: -1565, z: 2012 }],
   walkerSpawns: [{ x: -1715, z: 2030 }, { x: -1675, z: 2030 }, { x: -1635, z: 2030 }],
   seats: [
    { id: 'plaza-bench-w', x: -1715, z: 2030, yaw: 0 },
    { id: 'plaza-bench-c', x: -1675, z: 2030, yaw: 0 },
    { id: 'plaza-bench-e', x: -1635, z: 2030, yaw: 0 },
   ],
   leaveTarget: () => ({ x: -1775, z: 2075 }),
  },
  place: { id: 'gurgaon-boulevard', name: 'Gurugram Shopping Boulevard', category: 'shopping', arrival: { x: -1775, z: 2075 }, blurb: 'Fashion, flowers and café on a planted plaza east of MG Road, Gurugram.' },
 },
 {
  id: 'noida-park', name: 'Noida Sector Park & Market', arrival: { x: 2050, z: 1125 },
  shops: [noidaSweets, noidaBakery, noidaWear],
  seats: [
   { id: 'park-bench-a', cluster: 'noida-park', x: 2045, z: 1280, yaw: Math.PI },
   { id: 'park-bench-b', cluster: 'noida-park', x: 2130, z: 1243, yaw: 0 },
   { id: 'park-bench-c', cluster: 'noida-park', x: 2140, z: 1230, yaw: -Math.PI / 2 },
  ],
  board: { x: 1960, z: 1210 },
  circuit: [{ x: 1975, z: 1230 }, { x: 2085, z: 1217 }, { x: 2150, z: 1230 }, { x: 2085, z: 1243 }],
  parking: { x: 2030, z: 1330, yaw: 0, w: 80, d: 12 },
  signs: [
   { x: 1870, z: 1170, yaw: 0, text: 'SECTOR PARK →' },
   { x: 2050, z: 1170, yaw: 0, text: 'PARK · SHOPS' },
  ],
  population: {
   variants: NOIDA_VARIANTS,
   vendors: [{ position: { x: 2010, z: 1174 }, shop: 0 }, { position: { x: 2050, z: 1174 }, shop: 1 }],
   shopTargets: [{ x: 2010, z: 1170 }, { x: 2050, z: 1170 }, { x: 2090, z: 1170 }],
   walkerSpawns: [{ x: 2045, z: 1280 }, { x: 2130, z: 1243 }, { x: 2140, z: 1230 }],
   seats: [
    { id: 'park-bench-a', x: 2045, z: 1280, yaw: Math.PI },
    { id: 'park-bench-b', x: 2130, z: 1243, yaw: 0 },
    { id: 'park-bench-c', x: 2140, z: 1230, yaw: -Math.PI / 2 },
   ],
   leaveTarget: () => ({ x: 1960, z: 1210 }),
  },
  place: { id: 'noida-park', name: 'Noida Sector Park & Market', category: 'park', arrival: { x: 2050, z: 1125 }, blurb: 'Park loop, fountain, sweets, bakery and casual clothing.' },
 },
 {
  id: 'yamuna-view', name: 'Yamuna Viewpoint', arrival: { x: 1125, z: -550 },
  shops: [],
  seats: [
   { id: 'view-bench', cluster: 'yamuna-view', x: 1355, z: -545, yaw: -Math.PI / 2 },
  ],
  photo: { x: 1358, z: -550 }, photoYaw: Math.PI / 2,
  parking: { x: 1300, z: -550, yaw: 0, w: 25, d: 30 },
  signs: [
   { x: 1320, z: -600, yaw: 0, text: 'YAMUNA VIEWPOINT →' },
  ],
  population: {
   variants: YAMUNA_VARIANTS,
   vendors: [],
   shopTargets: [{ x: 1355, z: -545 }],
   walkerSpawns: [{ x: 1355, z: -545 }, { x: 1353, z: -539 }],
   seats: [{ id: 'view-bench', x: 1355, z: -545, yaw: -Math.PI / 2 }],
   leaveTarget: () => ({ x: 1125, z: -550 }),
  },
  place: { id: 'yamuna-view', name: 'Yamuna Viewpoint', category: 'viewpoint', arrival: { x: 1125, z: -550 }, blurb: 'Railed viewpoint over the Yamuna with a photo stop.' },
 },
];

export const CLUSTER_PLACES: ClusterPlace[] = CLUSTERS.map(c => c.place);
export const CLUSTER_SHOPS: ClusterShop[] = CLUSTERS.flatMap(c => c.shops);
export const CLUSTER_SEATS: ClusterSeat[] = CLUSTERS.flatMap(c => c.seats);
export function clusterById(id: string): Cluster | undefined { return CLUSTERS.find(c => c.id === id); }
export function shopById(id: string): ClusterShop | undefined { return CLUSTER_SHOPS.find(s => s.id === id); }

export const GOODS_JOBS: GoodsJobDef[] = [
 { id: 'flower-order', name: 'Flower Order · Garden → Gurugram', pickupShop: 'garden-flowers', dropoffShop: 'gurgaon-fnp', dropoff: gurgaonFNP.counter, reward: 400, brief: 'Collect the prepared bouquet at Highway Blooms (Garden Stop) and hand it over at FNP, Gurugram. ₹400 on confirmed handover. No timer.' },
 { id: 'cake-order', name: 'Cake Order · Noida → Garden', pickupShop: 'noida-bakery', dropoffShop: 'garden-sweets', dropoff: gardenSweets.counter, reward: 500, brief: 'Collect the prepared cake at Crumb & Co. (Noida) and hand it over at Halwai Corner (Garden Stop). ₹500 on confirmed handover. No timer.' },
];
export function goodsJobById(id: string): GoodsJobDef | undefined { return GOODS_JOBS.find(j => j.id === id); }

export const PLACE_CATEGORY_COLORS: Record<PlaceCategory, string> = {
 park: '#7ec98a', shopping: '#c99ae0', food: '#f0a35e', flowers: '#f08ac0', activity: '#6ec8e0', viewpoint: '#f0d35e',
};
