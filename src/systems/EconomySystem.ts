// Ekonomi sistemi — bot tüccar, fiyat simülasyonu, kredi yönetimi
import { EKONOMI, MalzemeTuru, MALZEME_TURLERI } from '@/config/balance';
import { InventorySystem } from './InventorySystem';

export class EconomySystem {
  private kredi: number = 0;
  private guncelFiyatlar: Record<MalzemeTuru, number>;
  private sonFiyatGuncelleme: number = 0;

  constructor(baslangicKredi: number = 0) {
    this.kredi = baslangicKredi;
    this.guncelFiyatlar = { ...EKONOMI.tabanFiyatlar };
    this.fiyatlariGuncelle();
  }

  /** Fiyatları rastgele dalgalandır */
  fiyatlariGuncelle(): void {
    for (const tur of MALZEME_TURLERI) {
      const taban = EKONOMI.tabanFiyatlar[tur];
      const katsayi =
        EKONOMI.dalgalanmaMin +
        Math.random() * (EKONOMI.dalgalanmaMax - EKONOMI.dalgalanmaMin);
      this.guncelFiyatlar[tur] = Math.round(taban * katsayi * 10) / 10;
    }
    this.sonFiyatGuncelleme = Date.now();
  }

  /** Oyun döngüsünde çağrılır — gerekirse fiyat günceller */
  guncelle(): void {
    if (Date.now() - this.sonFiyatGuncelleme >= EKONOMI.fiyatGuncellemeSuresi) {
      this.fiyatlariGuncelle();
    }
  }

  /** Malzeme sat; başarılıysa true döner */
  sat(tur: MalzemeTuru, miktar: number, envanter: InventorySystem): boolean {
    if (!envanter.cikar(tur, miktar)) return false;
    this.kredi += this.guncelFiyatlar[tur] * miktar;
    return true;
  }

  /** Kredi harca */
  harca(miktar: number): boolean {
    if (this.kredi < miktar) return false;
    this.kredi -= miktar;
    return true;
  }

  getKredi(): number { return Math.floor(this.kredi); }
  setKredi(k: number): void { this.kredi = k; }
  getFiyat(tur: MalzemeTuru): number { return this.guncelFiyatlar[tur]; }
  getFiyatlar(): Record<MalzemeTuru, number> { return { ...this.guncelFiyatlar }; }
}
