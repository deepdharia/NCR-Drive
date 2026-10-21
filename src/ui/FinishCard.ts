import { roadRoute } from '../systems/Navigation';
import { shopById, goodsJobById } from '../world/ClusterData';
import type { FinishRecord, LocalBest } from '../systems/Surprise';

/** The finish card: an original canvas illustration of the actual route
 * (the real road-graph polyline between the two counters), the completed
 * favours, the care score with its explanation, and the earned title.
 * Personal bests are local-device records and are labelled LOCAL.
 * Download is a plain PNG via blob URL — no account, no sharing gate. */
export function drawFinishCard(record: FinishRecord, best?: LocalBest): HTMLCanvasElement {
  const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 600;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Finish card requires Canvas 2D.');
  ctx.fillStyle = '#17352b'; ctx.fillRect(0, 0, 960, 600);
  ctx.strokeStyle = '#c1a46c'; ctx.lineWidth = 4; ctx.strokeRect(14, 14, 932, 572);
  ctx.fillStyle = '#f0dfb9'; ctx.textAlign = 'left';
  ctx.font = '600 25px sans-serif'; ctx.fillText('MAKE THE SURPRISE · FINISH CARD', 48, 70);
  ctx.font = '700 40px sans-serif'; ctx.fillText(record.jobName, 48, 122);
  ctx.font = '24px sans-serif'; ctx.fillStyle = '#dec497';
  ctx.fillText(record.routeLabel, 48, 160);
  if (record.replay) ctx.fillText('Surprise replay — fares already earned stay earned; this card is for mastery.', 48, 192);

  // Route illustration: the actual DelhiNav polyline, normalised to a panel.
  const job = goodsJobById(record.jobId), pickup = job ? shopById(job.pickupShop) : undefined, dropoff = job ? shopById(job.dropoffShop) : undefined;
  const panel = { x: 48, y: 216, w: 500, h: 300 };
  ctx.fillStyle = '#10231c'; ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
  ctx.strokeStyle = '#3d6a55'; ctx.lineWidth = 2; ctx.strokeRect(panel.x, panel.y, panel.w, panel.h);
  if (pickup && dropoff) {
    const route = roadRoute(pickup.counter, dropoff.counter);
    const xs = route.map(p => p.x), zs = route.map(p => p.z);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const scale = Math.min(panel.w - 56, panel.h - 56) / Math.max(maxX - minX, maxZ - minZ, 1);
    const px = (p: { x: number; z: number }) => ({ x: panel.x + 28 + (p.x - minX) * scale, y: panel.y + 28 + (p.z - minZ) * scale });
    ctx.strokeStyle = '#e1b536'; ctx.lineWidth = 4; ctx.beginPath();
    route.forEach((p, i) => { const q = px(p); if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); });
    ctx.stroke();
    for (const [p, label] of [[route[0], 'PICKUP'], [route[route.length - 1], 'HANDOVER']] as const) {
      const q = px(p); ctx.fillStyle = '#f0dfb9'; ctx.beginPath(); ctx.arc(q.x, q.y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.font = '600 17px sans-serif'; ctx.fillText(label, q.x + 12, q.y + 5);
    }
  }
  ctx.font = '20px sans-serif'; ctx.fillStyle = '#dec497';
  ctx.fillText('Original route illustration · NCR Drive', panel.x, panel.y + panel.h + 34);

  // Score panel.
  const sx = 592;
  ctx.font = '600 22px sans-serif'; ctx.fillStyle = '#f0dfb9'; ctx.fillText('DRIVING CARE', sx, 248);
  ctx.font = '700 74px sans-serif'; ctx.fillText(Math.round(record.condition) + '', sx, 322);
  ctx.font = '24px sans-serif'; ctx.fillText('/ 100', sx + 128, 322);
  ctx.fillStyle = '#28483a'; ctx.fillRect(sx, 342, 320, 14);
  ctx.fillStyle = '#e1b536'; ctx.fillRect(sx, 342, 320 * Math.max(0, Math.min(100, record.condition)) / 100, 14);
  ctx.font = 'italic 25px sans-serif'; ctx.fillStyle = '#f0dfb9';
  ctx.fillText('“' + record.title + '”', sx, 396);
  ctx.font = '21px sans-serif'; ctx.fillStyle = '#e8e2d2';
  const lines = [
    record.extra ? `Extra favour carried: ${record.extraLabel} (+₹${record.extraReward})` : 'Extra favour: not carried this run',
    `Base fare ₹${record.base} · Care bonus ₹${record.care}`,
    `Total earned ₹${record.total}`,
    best ? `LOCAL BEST · ${Math.round(best.condition)}/100 · ${best.title}` : 'LOCAL BEST · this run is your first mark',
    'Local bests live on this device only.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, sx, 436 + i * 30));
  ctx.font = '19px sans-serif'; ctx.fillStyle = '#b9c4ae';
  wrap(ctx, record.explanation, 48, 566, 864, 24);
  return canvas;
}
function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
  const words = text.split(' '); let line = '', yy = y;
  for (const word of words) {
    const trial = line ? line + ' ' + word : word;
    if (ctx.measureText(trial).width > maxWidth && line) { ctx.fillText(line, x, yy); line = word; yy += lineHeight; } else line = trial;
  }
  if (line) ctx.fillText(line, x, yy);
}
export function downloadFinishCard(record: FinishRecord, best?: LocalBest): void {
  const canvas = drawFinishCard(record, best);
  canvas.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'ncr-drive-finish-card.png'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, 'image/png');
}
