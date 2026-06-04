// Kaynak düğümü — sefer haritasında toplanabilir malzeme noktası
import { SEFER, MalzemeTuru, MALZEME_TURLERI } from '@/config/balance';

export class ResourceNode {
  id: number;
  aktif: boolean = false;
  x: number = 0;
  y: number = 0;
  tur!: MalzemeTuru;
  miktar: number = 0;
  hasatSuresi: number = SEFER.kaynakDugumu.hasat_suresi;
  hasatIlerlemesi: number = 0; // sn cinsinden

  constructor(id: number) { this.id = id; }

  baslat(x: number, y: number, tur?: MalzemeTuru): void {
    this.x = x;
    this.y = y;
    this.tur = tur ?? this.rastgeleTur();
    this.miktar = Math.floor(
      SEFER.kaynakDugumu.miktar.min +
      Math.random() * (SEFER.kaynakDugumu.miktar.max - SEFER.kaynakDugumu.miktar.min),
    );
    this.hasatIlerlemesi = 0;
    this.aktif = true;
  }

  /** Oyuncu yakınsa çağrılır; tamamlandığında miktar döner, yoksa 0 */
  hasat(delta: number): number {
    this.hasatIlerlemesi += delta / 1000;
    if (this.hasatIlerlemesi >= this.hasatSuresi) {
      this.aktif = false;
      return this.miktar;
    }
    return 0;
  }

  private rastgeleTur(): MalzemeTuru {
    return MALZEME_TURLERI[Math.floor(Math.random() * MALZEME_TURLERI.length)];
  }
}
