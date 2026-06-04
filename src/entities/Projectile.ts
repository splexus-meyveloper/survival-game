// Mermi entity'si (object pool ile kullanılır)
import { SEFER } from '@/config/balance';

export class Projectile {
  id: number;
  aktif: boolean = false;
  x: number = 0;
  y: number = 0;
  vx: number = 0;
  vy: number = 0;
  hasar: number = SEFER.basarBasarHasari;
  hiz: number = 400; // piksel/sn
  hedefId: number = -1;

  constructor(id: number) { this.id = id; }

  baslat(x: number, y: number, hedefX: number, hedefY: number, hedefId: number): void {
    this.x = x;
    this.y = y;
    this.hedefId = hedefId;
    this.aktif = true;
    const dx = hedefX - x;
    const dy = hedefY - y;
    const uzunluk = Math.sqrt(dx * dx + dy * dy) || 1;
    this.vx = (dx / uzunluk) * this.hiz;
    this.vy = (dy / uzunluk) * this.hiz;
  }

  guncelle(delta: number): void {
    this.x += this.vx * (delta / 1000);
    this.y += this.vy * (delta / 1000);
  }

  /** Hedefle çarpışma kontrolü */
  carpisti(hedefX: number, hedefY: number, yaricap: number = 20): boolean {
    const dx = this.x - hedefX;
    const dy = this.y - hedefY;
    return dx * dx + dy * dy <= yaricap * yaricap;
  }
}
