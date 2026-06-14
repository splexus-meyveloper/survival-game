// Kaynak düğümü — anlık toplanabilir, respawn destekli
import { SEFER, MalzemeTuru, MALZEME_TURLERI } from '@/config/balance';

export class ResourceNode {
  id: number;
  aktif: boolean = false;
  x: number = 0;
  y: number = 0;
  tur!: MalzemeTuru;
  miktar: number = 0;

  constructor(id: number) { this.id = id; }

  baslat(x: number, y: number, tur?: MalzemeTuru): void {
    this.x = x;
    this.y = y;
    this.tur = tur ?? this.rastgeleTur();
    this.miktar = Math.floor(
      SEFER.kaynakDugumu.miktar.min +
      Math.random() * (SEFER.kaynakDugumu.miktar.max - SEFER.kaynakDugumu.miktar.min + 1),
    );
    this.aktif = true;
  }

  private rastgeleTur(): MalzemeTuru {
    // Kristal daha nadir çıksın
    const r = Math.random();
    if (r < 0.45) return 'hurda';
    if (r < 0.80) return 'biyokutle';
    return 'kristal';
  }
}
