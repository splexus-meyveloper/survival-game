// Envanter yönetimi — malzeme ekleme/çıkarma, limit kontrolü
import { MalzemeTuru, MALZEME_TURLERI } from '@/config/balance';

export class InventorySystem {
  private miktar: Record<MalzemeTuru, number>;
  private kapasite: Record<MalzemeTuru, number>;

  constructor(
    baslangicMiktar?: Partial<Record<MalzemeTuru, number>>,
    baslangicKapasite: number = 9999,
  ) {
    this.miktar = {} as Record<MalzemeTuru, number>;
    this.kapasite = {} as Record<MalzemeTuru, number>;
    for (const tur of MALZEME_TURLERI) {
      this.miktar[tur] = baslangicMiktar?.[tur] ?? 0;
      this.kapasite[tur] = baslangicKapasite;
    }
  }

  ekle(tur: MalzemeTuru, miktar: number): number {
    const bos = this.kapasite[tur] - this.miktar[tur];
    const eklenen = Math.min(miktar, bos);
    this.miktar[tur] += eklenen;
    return eklenen; // gerçekte eklenen miktar (taştıysa daha az)
  }

  cikar(tur: MalzemeTuru, miktar: number): boolean {
    if (this.miktar[tur] < miktar) return false;
    this.miktar[tur] -= miktar;
    return true;
  }

  getMiktar(tur: MalzemeTuru): number {
    return this.miktar[tur];
  }

  setKapasite(tur: MalzemeTuru, yeniKapasite: number): void {
    this.kapasite[tur] = yeniKapasite;
  }

  /** Tüm envanteri snapshot olarak döner (kayıt için) */
  snapshot(): Record<MalzemeTuru, number> {
    return { ...this.miktar };
  }

  /** Kayıttan yükle */
  yukle(veri: Record<MalzemeTuru, number>): void {
    for (const tur of MALZEME_TURLERI) {
      this.miktar[tur] = veri[tur] ?? 0;
    }
  }
}
