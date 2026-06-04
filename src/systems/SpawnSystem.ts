// Düşman dalga yönetimi — SpawnSystem (sefer sahnesinde kullanılır)
import { SEFER, DUSMANLAR } from '@/config/balance';

export interface SpawnTalep {
  dusmanId: string;
  x: number;
  y: number;
}

export class SpawnSystem {
  private dalga: number = 0;
  private sonDalga: number = 0;
  private baslangic: number = 0;

  baslat(): void {
    this.baslangic = Date.now();
    this.sonDalga = Date.now();
    this.dalga = 0;
  }

  /** Her frame çağrılır; yeni dalga gelecekse SpawnTalep listesi döner */
  guncelle(haritaGenislik: number, haritaYukseklik: number): SpawnTalep[] {
    const simdi = Date.now();
    const gecen = simdi - this.baslangic;

    // İlk dalga gecikmesi
    if (this.dalga === 0 && gecen < SEFER.dalga.ilkDalgaSuresi) return [];
    // Dalga arası bekleme
    if (this.dalga > 0 && simdi - this.sonDalga < SEFER.dalga.dalgaAraliği) return [];

    this.dalga++;
    this.sonDalga = simdi;
    return this.dalgaOlustur(haritaGenislik, haritaYukseklik);
  }

  getDalga(): number { return this.dalga; }

  private dalgaOlustur(w: number, h: number): SpawnTalep[] {
    const sayi = SEFER.dalga.baslangicDüşmanSayisi + (this.dalga - 1) * SEFER.dalga.dalgaBasinaEkDüşman;
    const talepler: SpawnTalep[] = [];
    const dusmanIdler = Object.keys(DUSMANLAR);

    for (let i = 0; i < sayi; i++) {
      // Harita kenarından rastgele konuma doğur
      const kenar = Math.floor(Math.random() * 4);
      let x = 0, y = 0;
      if (kenar === 0) { x = Math.random() * w; y = 0; }
      else if (kenar === 1) { x = w; y = Math.random() * h; }
      else if (kenar === 2) { x = Math.random() * w; y = h; }
      else { x = 0; y = Math.random() * h; }

      // Düşman ağırlıklı seçim (dalga ilerledikçe güçlüler artar)
      const indeks = Math.min(
        Math.floor(Math.random() * Math.min(this.dalga, dusmanIdler.length)),
        dusmanIdler.length - 1,
      );
      talepler.push({ dusmanId: dusmanIdler[indeks], x, y });
    }
    return talepler;
  }
}
