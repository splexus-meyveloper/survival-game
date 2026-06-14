// Silah sistemi — otomatik hedef seçimi ve ateş hızı yönetimi
import { SEFER } from '@/config/balance';

export interface Hedef { x: number; y: number; id: number }

export class WeaponSystem {
  private sonAtis: number = 0;
  private atisSuresi: number; // ms

  constructor(atisSuresi: number = 1000 / SEFER.saldiriHizi) {
    this.atisSuresi = atisSuresi;
  }

  /** En yakın hedefi seçer; menzil dışında null döner */
  hedefSec(oyuncuX: number, oyuncuY: number, hedefler: Hedef[], menzil?: number): Hedef | null {
    let en_yakin: Hedef | null = null;
    let minMesafe = menzil ?? SEFER.otomatikSaldiriMenzili;

    for (const h of hedefler) {
      const dx = h.x - oyuncuX;
      const dy = h.y - oyuncuY;
      const mesafe = Math.sqrt(dx * dx + dy * dy);
      if (mesafe < minMesafe) {
        minMesafe = mesafe;
        en_yakin = h;
      }
    }
    return en_yakin;
  }

  /** Ateş edebilir mi? Edebiliyorsa true döner ve zamanlayıcıyı sıfırlar */
  atesEdebilir(simdi: number): boolean {
    if (simdi - this.sonAtis >= this.atisSuresi) {
      this.sonAtis = simdi;
      return true;
    }
    return false;
  }

  setAtisSuresi(ms: number): void { this.atisSuresi = ms; }
}
