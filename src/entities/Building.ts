// Bina entity'si — izometrik üs sahnesinde render için
import { BINA_TANIMLARI } from '@/config/balance';
import { BinaKayit } from '@/systems/SaveSystem';
import { gridToScreen } from '@/iso/isoHelper';

export class Building {
  readonly kayit: BinaKayit;

  constructor(kayit: BinaKayit) {
    this.kayit = kayit;
  }

  get ekranPos() {
    return gridToScreen(this.kayit.col, this.kayit.row);
  }

  get ad(): string {
    return BINA_TANIMLARI[this.kayit.id]?.ad ?? this.kayit.id;
  }

  get seviye(): number { return this.kayit.seviye; }
}
