// Üretim sistemi — binalar zamanla malzeme üretir, offline üretim dahil
import {
  BINA_TANIMLARI,
  OFFLINE_URETIM,
  MalzemeTuru,
  ELEMAN,
} from '@/config/balance';
import { BinaKayit } from './SaveSystem';
import { InventorySystem } from './InventorySystem';

export class ProductionSystem {
  /**
   * Oyun yüklendiğinde çağrılır.
   * Geçen süreye göre offline üretimi hesaplar ve envantere ekler.
   */
  offlineUretimiHesapla(
    binalar: BinaKayit[],
    sonGorulme: number,
    envanter: InventorySystem,
  ): Record<MalzemeTuru, number> {
    const gecenMs = Date.now() - sonGorulme;
    const gecenSn = Math.min(gecenMs / 1000, OFFLINE_URETIM.maksCatchupSaniye);
    const kazanilan: Record<MalzemeTuru, number> = {
      hurda: 0,
      biyokutle: 0,
      kristal: 0,
    };

    for (const bina of binalar) {
      const tanim = BINA_TANIMLARI[bina.id];
      if (!tanim) continue;
      const carpan = this.elamanCarpani(bina.atanenElemanlar);
      for (const [tur, miktar] of Object.entries(tanim.uretim) as [MalzemeTuru, number][]) {
        const uretilen = miktar * carpan * Math.pow(tanim.yukselmeKatsayisi, bina.seviye - 1) * gecenSn;
        const eklenen = envanter.ekle(tur, uretilen);
        kazanilan[tur] += eklenen;
      }
    }

    return kazanilan;
  }

  /**
   * Oyun döngüsünde her frame sonunda çağrılır (aktif üretim).
   */
  guncelle(
    binalar: BinaKayit[],
    envanter: InventorySystem,
    delta: number, // ms
  ): void {
    const gecenSn = delta / 1000;
    for (const bina of binalar) {
      const tanim = BINA_TANIMLARI[bina.id];
      if (!tanim) continue;
      const carpan = this.elamanCarpani(bina.atanenElemanlar);
      for (const [tur, miktar] of Object.entries(tanim.uretim) as [MalzemeTuru, number][]) {
        const uretilen = miktar * carpan * Math.pow(tanim.yukselmeKatsayisi, bina.seviye - 1) * gecenSn;
        envanter.ekle(tur, uretilen);
      }
    }
  }

  private elamanCarpani(elemanSayisi: number): number {
    return 1 + elemanSayisi * ELEMAN.uretimArtisi;
  }
}
