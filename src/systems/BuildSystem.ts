// Bina yerleştirme ve yükseltme sistemi
import { BINA_TANIMLARI, MalzemeTuru } from '@/config/balance';
import { BinaKayit } from './SaveSystem';
import { InventorySystem } from './InventorySystem';
import { EconomySystem } from './EconomySystem';
import { gecerliHucre } from '@/iso/isoHelper';

export class BuildSystem {
  private binalar: BinaKayit[] = [];
  // İşgal edilen grid hücreleri seti (col,row string key)
  private dolugrid = new Set<string>();

  yukle(kayitlar: BinaKayit[]): void {
    this.binalar = kayitlar;
    this.dolugrid.clear();
    for (const b of kayitlar) {
      this.isaretleHucreler(b);
    }
  }

  getBinalar(): BinaKayit[] { return this.binalar; }

  /** Para ile bina inşa et */
  insaEt(
    binaId: string,
    col: number,
    row: number,
    ekonomi: EconomySystem,
  ): boolean {
    const tanim = BINA_TANIMLARI[binaId];
    if (!tanim) return false;
    if (!this.yerUygunMu(col, row, tanim.gridBoyutu.w, tanim.gridBoyutu.h)) return false;
    if (!ekonomi.harca(tanim.krediBedeli)) return false;

    const yeni: BinaKayit = { id: binaId, seviye: 1, col, row, atanenElemanlar: 0 };
    this.binalar.push(yeni);
    this.isaretleHucreler(yeni);
    return true;
  }

  /** Malzeme ile bina inşa et (alternatif) */
  insaEtMalzeme(
    binaId: string,
    col: number,
    row: number,
    envanter: InventorySystem,
  ): boolean {
    const tanim = BINA_TANIMLARI[binaId];
    if (!tanim) return false;
    if (!this.yerUygunMu(col, row, tanim.gridBoyutu.w, tanim.gridBoyutu.h)) return false;
    // Önce maliyet kontrolü
    for (const [tur, miktar] of Object.entries(tanim.maliyet) as [MalzemeTuru, number][]) {
      if (envanter.getMiktar(tur) < miktar) return false;
    }
    // Çıkar
    for (const [tur, miktar] of Object.entries(tanim.maliyet) as [MalzemeTuru, number][]) {
      envanter.cikar(tur, miktar);
    }
    const yeni: BinaKayit = { id: binaId, seviye: 1, col, row, atanenElemanlar: 0 };
    this.binalar.push(yeni);
    this.isaretleHucreler(yeni);
    return true;
  }

  yukselt(col: number, row: number, ekonomi: EconomySystem): boolean {
    const bina = this.binaGetir(col, row);
    if (!bina) return false;
    const tanim = BINA_TANIMLARI[bina.id];
    const maliyet = Math.round(tanim.krediBedeli * Math.pow(1.8, bina.seviye));
    if (!ekonomi.harca(maliyet)) return false;
    bina.seviye++;
    return true;
  }

  binaGetir(col: number, row: number): BinaKayit | undefined {
    return this.binalar.find((b) => b.col === col && b.row === row);
  }

  private yerUygunMu(col: number, row: number, w: number, h: number): boolean {
    for (let dc = 0; dc < w; dc++) {
      for (let dr = 0; dr < h; dr++) {
        if (!gecerliHucre(col + dc, row + dr)) return false;
        if (this.dolugrid.has(`${col + dc},${row + dr}`)) return false;
      }
    }
    return true;
  }

  private isaretleHucreler(bina: BinaKayit): void {
    const tanim = BINA_TANIMLARI[bina.id];
    if (!tanim) return;
    for (let dc = 0; dc < tanim.gridBoyutu.w; dc++) {
      for (let dr = 0; dr < tanim.gridBoyutu.h; dr++) {
        this.dolugrid.add(`${bina.col + dc},${bina.row + dr}`);
      }
    }
  }
}
