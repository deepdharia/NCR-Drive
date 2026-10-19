// Export the complete NCR Drive world map as a standalone SVG, drawn from
// the game's own road data (WorldRoads). Run: npm run map:export
// Output: ~/workspace/your_files/ncr-drive-complete-map.svg (shared with the user).
import { mkdirSync, writeFileSync } from 'node:fs';
import { roads, ends, destinations, uniqueRoadLength } from '../src/world/WorldRoads.ts';
import { CLUSTER_PLACES, CLUSTER_SHOPS, PLACE_CATEGORY_COLORS } from '../src/world/ClusterData.ts';

// Shop coordinates mirror the `shops` consts in src/systems/Neighborhood.ts.
const SHOPS = [
  { name: 'Neem Chai', x: -164, z: -14 },
  { name: 'Gali Baithak (paan)', x: -190, z: -14 },
  { name: 'Nimbu Corner (juice)', x: -218, z: -14 },
];
const pts: { x: number; z: number }[] = [];
for (const r of roads) pts.push(...ends(r));
for (const d of destinations) pts.push(d);
for (const shop of SHOPS) pts.push(shop);
const xs = pts.map(j => j.x), zs = pts.map(j => j.z);
const minX = Math.min(...xs) - 200, maxX = Math.max(...xs) + 200;
const minZ = Math.min(...zs) - 200, maxZ = Math.max(...zs) + 200;
const W = 1600, H = 1240, MAP_X = 40, MAP_Y = 70, MAP_W = 1520, MAP_H = 1020;
const s = Math.min(MAP_W / (maxX - minX), MAP_H / (maxZ - minZ));
const ox = MAP_X + (MAP_W - (maxX - minX) * s) / 2, oy = MAP_Y + (MAP_H - (maxZ - minZ) * s) / 2;
const X = (x: number) => ox + (x - minX) * s;
const Y = (z: number) => oy + (z - minZ) * s; // +z is south, so larger z draws lower: north stays up.
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const line = (a: { x: number; z: number }, b: { x: number; z: number }, color: string, width: number, extra = '') =>
  `<line x1="${X(a.x).toFixed(1)}" y1="${Y(a.z).toFixed(1)}" x2="${X(b.x).toFixed(1)}" y2="${Y(b.z).toFixed(1)}" stroke="${color}" stroke-width="${width.toFixed(1)}" stroke-linecap="round" ${extra}/>`;
const label = (text: string, x: number, z: number, size: number, color = '#eee3c7', anchor = 'middle', dy = 0) =>
  `<text x="${X(x).toFixed(1)}" y="${(Y(z) + dy).toFixed(1)}" font-family="sans-serif" font-size="${size}" fill="${color}" text-anchor="${anchor}">${esc(text)}</text>`;
const parts: string[] = [];
parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="sans-serif">`);
parts.push(`<rect width="${W}" height="${H}" fill="#12211d"/>`);
parts.push(`<text x="40" y="46" font-size="30" font-weight="700" fill="#f1c369" letter-spacing="2">NCR DRIVE · COMPLETE MAP</text>`);
parts.push(`<text x="1560" y="46" font-size="16" fill="#a4c9af" text-anchor="end">N ↑</text>`);
parts.push(`<rect x="${MAP_X}" y="${MAP_Y}" width="${MAP_W}" height="${MAP_H}" rx="12" fill="#203b35"/>`);
// Yamuna river between its banks (x 1220–1530, z −740…400).
parts.push(`<rect x="${X(1220).toFixed(1)}" y="${Y(-740).toFixed(1)}" width="${((1530 - 1220) * s).toFixed(1)}" height="${((400 - -740) * s).toFixed(1)}" fill="#386977" opacity="0.9"/>`);
parts.push(label('YAMUNA', 1375, -300, 15, '#cfe6ea'));
// Roads: dark casing, then surface. Bridges in tan, Market Lane in gold.
for (const r of roads) { const [a, b] = ends(r); parts.push(line(a, b, '#16281f', Math.max(1.5, r.width * s * 0.45 + 2))); }
for (const r of roads) {
  const [a, b] = ends(r), w = Math.max(1.5, r.width * s * 0.45);
  parts.push(line(a, b, r.id === 'market-lane' ? '#f1c369' : r.bridge ? '#d0c3a0' : '#79867b', r.id === 'market-lane' ? w + 1.5 : w));
}
// Destinations + shops.
for (const d of destinations) {
  parts.push(`<circle cx="${X(d.x).toFixed(1)}" cy="${Y(d.z).toFixed(1)}" r="7" fill="#a4c9af" stroke="#203b35" stroke-width="1.5"/>`);
  parts.push(label(d.name, d.x, d.z, 13, '#d7e8d5', 'middle', -14));
}
for (const shop of SHOPS) {
  parts.push(`<circle cx="${X(shop.x).toFixed(1)}" cy="${Y(shop.z).toFixed(1)}" r="8" fill="#f1c369" stroke="#203b35" stroke-width="1.5"/>`);
}
// Cluster places (Parks & Shopping): category-coloured diamonds at arrivals.
for (const p of CLUSTER_PLACES) {
  const c = PLACE_CATEGORY_COLORS[p.category], s2 = 8;
  parts.push(`<polygon points="${X(p.arrival.x).toFixed(1)},${(Y(p.arrival.z) - s2).toFixed(1)} ${(X(p.arrival.x) + s2).toFixed(1)},${Y(p.arrival.z).toFixed(1)} ${X(p.arrival.x).toFixed(1)},${(Y(p.arrival.z) + s2).toFixed(1)} ${(X(p.arrival.x) - s2).toFixed(1)},${Y(p.arrival.z).toFixed(1)}" fill="${c}" stroke="#203b35" stroke-width="1.5"/>`);
  parts.push(label(p.name, p.arrival.x, p.arrival.z, 12, c, 'middle', -16));
}
// Cluster shops: small gold dots (labels would clutter at this zoom).
for (const shop of CLUSTER_SHOPS) {
  parts.push(`<circle cx="${X(shop.position.x).toFixed(1)}" cy="${Y(shop.position.z).toFixed(1)}" r="4" fill="#f1c369" stroke="#203b35" stroke-width="1"/>`);
}
parts.push(label('MARKET LANE · 250 m', -255, -60, 14, '#f1c369'));
parts.push(label('CONNAUGHT PLACE', 0, -120, 18, '#eee3c7'));
parts.push(label('DELHI', 0, 260, 26, '#eee3c7'));
parts.push(label('GURGAON', -2100, 1800, 26, '#eee3c7'));
parts.push(label('NOIDA', 3200, 120, 26, '#eee3c7'));
// Market Lane detail inset (bottom-right, over the empty south-east corner).
// The main map is too zoomed-out for shop labels; the inset carries them.
{
  const IX = 1060, IY = 700, IW = 460, IH = 330;
  const ix0 = -410, ix1 = -110, iz0 = -45, iz1 = 45;
  const is = Math.min(IW / (ix1 - ix0), IH / (iz1 - iz0));
  const iox = IX + (IW - (ix1 - ix0) * is) / 2, ioy = IY + (IH - (iz1 - iz0) * is) / 2;
  const IXp = (x: number) => iox + (x - ix0) * is, IYp = (z: number) => ioy + (z - iz0) * is;
  parts.push(`<rect x="${IX}" y="${IY}" width="${IW}" height="${IH}" rx="10" fill="#1a322c" stroke="#f1c369" stroke-width="1.5"/>`);
  parts.push(`<text x="${IX + 14}" y="${IY + 26}" font-size="15" font-weight="700" fill="#f1c369">MARKET LANE — DETAIL</text>`);
  for (const r of roads) {
    if (r.id !== 'market-lane') continue;
    const [a, b] = ends(r);
    parts.push(`<line x1="${IXp(a.x).toFixed(1)}" y1="${IYp(a.z).toFixed(1)}" x2="${IXp(b.x).toFixed(1)}" y2="${IYp(b.z).toFixed(1)}" stroke="#f1c369" stroke-width="7" stroke-linecap="round"/>`);
  }
  const INSET_LABELS = ['Neem Chai', 'Gali Baithak', 'Nimbu Corner'];
  SHOPS.forEach((shop, i) => {
    parts.push(`<circle cx="${IXp(shop.x).toFixed(1)}" cy="${IYp(shop.z).toFixed(1)}" r="6" fill="#f1c369" stroke="#1a322c" stroke-width="1.5"/>`);
    const above = i % 2 === 0;
    parts.push(`<text x="${IXp(shop.x).toFixed(1)}" y="${(IYp(shop.z) + (above ? -12 : 30)).toFixed(1)}" font-size="13" fill="#ffe3a5" text-anchor="middle">${INSET_LABELS[i]}</text>`);
  });
  parts.push(`<text x="${IXp(-342).toFixed(1)}" y="${(IYp(4) + 26).toFixed(1)}" font-size="12" fill="#a4c9af" text-anchor="middle">Cold store (west)</text>`);
  parts.push(`<text x="${IXp(-244).toFixed(1)}" y="${(IYp(0) + 26).toFixed(1)}" font-size="12" fill="#a4c9af" text-anchor="middle">Crossing</text>`);
  parts.push(`<text x="${IX + 14}" y="${IY + IH - 12}" font-size="12" fill="#8fae98">CP → east &nbsp;·&nbsp; west end → cold-store bay</text>`.replace(/&nbsp;/g, '&#160;'));
}
// Scale bar: 500 m.
const barW = 500 * s, barX = MAP_X + 30, barY = MAP_Y + MAP_H - 34;
parts.push(`<rect x="${barX}" y="${barY}" width="${barW.toFixed(1)}" height="8" fill="#eee3c7"/><text x="${barX}" y="${barY - 8}" font-size="14" fill="#eee3c7">500 m</text>`);
// Legend + footer.
parts.push(`<text x="40" y="1135" font-size="15" fill="#d7e8d5">— Road &#160;&#160; — Bridge &#160;&#160; — Market Lane &#160;&#160; ● Destination &#160;&#160; ● Shop &#160;&#160; ◆ Parks &amp; Shopping place</text>`);
parts.push(`<text x="40" y="1162" font-size="15" fill="#a4c9af">In game: open DelhiOS (Tab) and click anywhere on this map to drop a waypoint — DelhiNav routes you there. Click again to move it, Clear to drop it.</text>`);
parts.push(`<text x="40" y="1189" font-size="15" fill="#8fae98">Fictional geography, not a surveyed map · Road centreline ${uniqueRoadLength.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} m · No teleport — drive it.</text>`);
parts.push(`</svg>`);
const outPath = new URL('../../your_files/ncr-drive-complete-map.svg', import.meta.url);
mkdirSync(new URL('../../your_files/', import.meta.url), { recursive: true });
writeFileSync(outPath, parts.join('\n'));
console.log(`Wrote ncr-drive-complete-map.svg (${roads.length} roads)`);
