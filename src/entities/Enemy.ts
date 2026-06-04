// Düşman entity'si (object pool ile kullanılır)
import { DUSMANLAR, DusmanTanimi, MalzemeTuru } from '@/config/balance';

export interface EnemyDrop {
  tur: MalzemeTuru;
  miktar: number;
}

export class Enemy {
  id: number;
  aktif: boolean = false;
  x: number = 0;
  y: number = 0;
  can: number = 0;
  canMax: number = 0;
  hiz: number = 0;
  hasar: number = 0;
  tanim!: DusmanTanimi;

  constructor(id: number) { this.id = id; }

  /** Pool'dan alındığında çağrılır */
  baslat(dusmanId: string, x: number, y: number): void {
    const tanim = DUSMANLAR[dusmanId];
    if (!tanim) return;
    this.tanim = tanim;
    this.x = x;
    this.y = y;
    this.can = tanim.can;
    this.canMax = tanim.can;
    this.hiz = tanim.hiz;
    this.hasar = tanim.hasar;
    this.aktif = true;
  }

  /** Oyuncuya doğru ilerle */
  hedefeSal(hedefX: number, hedefY: number, delta: number): void {
    const dx = hedefX - this.x;
    const dy = hedefY - this.y;
    const uzunluk = Math.sqrt(dx * dx + dy * dy);
    if (uzunluk < 1) return;
    this.x += (dx / uzunluk) * this.hiz * (delta / 1000);
    this.y += (dy / uzunluk) * this.hiz * (delta / 1000);
  }

  hasarAl(miktar: number): void {
    this.can -= miktar;
    if (this.can <= 0) this.oldu();
  }

  private oldu(): void {
    this.aktif = false;
  }

  /** Öldüğünde bırakacağı malzemeleri hesapla */
  dropHesapla(): EnemyDrop[] {
    const drops: EnemyDrop[] = [];
    for (const [tur, aralik] of Object.entries(this.tanim.malzemeDrop) as [MalzemeTuru, { min: number; max: number }][]) {
      const miktar = Math.floor(aralik.min + Math.random() * (aralik.max - aralik.min + 1));
      if (miktar > 0) drops.push({ tur, miktar });
    }
    return drops;
  }
}
