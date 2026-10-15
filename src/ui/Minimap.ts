import type { Point } from '../core/math';
import { COURIER_TARGET } from '../systems/CourierMission';

export class Minimap {
  private context: CanvasRenderingContext2D;
  constructor(canvas: HTMLCanvasElement) {
    canvas.width = canvas.height = 480;
    const context = canvas.getContext('2d'); if (!context) throw new Error('DelhiNav needs Canvas 2D support.');
    this.context = context;
  }
  draw(position: Point, yaw: number, car: Point, delivery: boolean): void {
    const ctx = this.context, scale = 1.75, centre = 240;
    const project = (p: Point): Point => ({ x: centre + p.x * scale, z: centre + p.z * scale });
    ctx.fillStyle = '#203b35'; ctx.fillRect(0, 0, 480, 480);
    ctx.lineWidth = 18; ctx.strokeStyle = '#677770'; ctx.beginPath(); ctx.arc(centre, centre, 44 * scale, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(centre + Math.cos(angle) * 44 * scale, centre + Math.sin(angle) * 44 * scale);
      ctx.lineTo(centre + Math.cos(angle) * 150 * scale, centre + Math.sin(angle) * 150 * scale); ctx.stroke();
    }
    ctx.fillStyle = '#4d7250'; ctx.beginPath(); ctx.arc(centre, centre, 30 * scale, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#7d9b71'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(centre, centre, 18 * scale, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#aeb5a0';
    for (let sector = 0; sector < 6; sector++) for (let block = 0; block < 5; block++) {
      const angle = (sector * 60 + 12 + block * 9) * Math.PI / 180;
      ctx.save(); ctx.translate(centre + Math.cos(angle) * 67 * scale, centre + Math.sin(angle) * 67 * scale); ctx.rotate(angle); ctx.fillRect(-10, -7, 20, 14); ctx.restore();
    }
    ctx.fillStyle = '#c5d2bd'; ctx.font = '15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('CENTRAL PARK', 240, 235);
    ctx.fillStyle = '#e8d8b5'; ctx.font = '16px sans-serif'; ctx.fillText('N', 240, 30);
    const parked = project(car); ctx.fillStyle = '#d3d9c5'; ctx.fillRect(parked.x - 4, parked.z - 7, 8, 14);
    if (delivery) {
      const target = project(COURIER_TARGET); ctx.fillStyle = '#edbc71'; ctx.beginPath(); ctx.arc(target.x, target.z, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e0c995'; ctx.font = '13px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('SHIVAJI', target.x + 13, target.z);
    }
    const player = project(position);
    ctx.save(); ctx.translate(player.x, player.z); ctx.rotate(Math.PI - yaw);
    ctx.shadowColor = '#f1c37d'; ctx.shadowBlur = 12; ctx.fillStyle = '#f4d29c'; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(8, 8); ctx.lineTo(0, 4); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill(); ctx.restore();
  }
}
