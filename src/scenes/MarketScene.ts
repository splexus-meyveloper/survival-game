// Market sahnesi — malzeme satış UI (ileride overlay olarak çalışacak)
import Phaser from 'phaser';
import { EconomySystem } from '@/systems/EconomySystem';
import { InventorySystem } from '@/systems/InventorySystem';
import { MALZEME_TURLERI, MalzemeTuru } from '@/config/balance';

interface MarketConfig {
  ekonomi: EconomySystem;
  envanter: InventorySystem;
  kapanisCallback: () => void;
}

export class MarketScene extends Phaser.Scene {
  private cfg!: MarketConfig;

  constructor() {
    super({ key: 'MarketScene' });
  }

  init(data: MarketConfig): void {
    this.cfg = data;
  }

  create(): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    // Arkaplan karartma
    this.add.rectangle(cx, cy, width, height, 0x000000, 0.7);

    // Panel
    const gfx = this.add.graphics();
    gfx.fillStyle(0x0d1f3c, 1);
    gfx.lineStyle(2, 0x2255aa, 1);
    gfx.fillRoundedRect(cx - 200, cy - 200, 400, 400, 10);
    gfx.strokeRoundedRect(cx - 200, cy - 200, 400, 400, 10);

    this.add.text(cx, cy - 175, 'TÜCCAR MARKETI', {
      fontSize: '18px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5);

    this.add.text(cx, cy - 145, `Kredi: ${this.cfg.ekonomi.getKredi()}`, {
      fontSize: '14px', color: '#aaddff',
    }).setOrigin(0.5);

    MALZEME_TURLERI.forEach((tur, i) => {
      const y = cy - 100 + i * 80;
      const fiyat = this.cfg.ekonomi.getFiyat(tur);
      const stok = Math.floor(this.cfg.envanter.getMiktar(tur));

      this.add.text(cx - 160, y, `${tur.toUpperCase()}`, {
        fontSize: '13px', color: '#ffffff',
      });
      this.add.text(cx - 160, y + 18, `Stok: ${stok}  |  Fiyat: ${fiyat}₵/birim`, {
        fontSize: '11px', color: '#8899aa',
      });

      // Sat butonu
      this.satButonu(cx + 60, y + 10, 'Tümünü Sat', () => {
        const basarili = this.cfg.ekonomi.sat(tur as MalzemeTuru, stok, this.cfg.envanter);
        if (basarili) this.scene.restart();
      });
    });

    // Kapat
    this.add.text(cx, cy + 175, '[ KAPAT ]', {
      fontSize: '14px', color: '#6688aa',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.cfg.kapanisCallback();
        this.scene.stop();
      });
  }

  private satButonu(x: number, y: number, etiket: string, tikla: () => void): void {
    const gfx = this.add.graphics();
    const ciz = (h: boolean) => {
      gfx.clear();
      gfx.fillStyle(h ? 0x226622 : 0x113311, 1);
      gfx.lineStyle(1, 0x44aa44, 1);
      gfx.fillRoundedRect(x - 60, y - 14, 120, 28, 4);
      gfx.strokeRoundedRect(x - 60, y - 14, 120, 28, 4);
    };
    ciz(false);
    this.add.text(x, y, etiket, { fontSize: '12px', color: '#ffffff' }).setOrigin(0.5);
    const alan = this.add.rectangle(x, y, 120, 28).setInteractive({ useHandCursor: true });
    alan.on('pointerover', () => ciz(true));
    alan.on('pointerout', () => ciz(false));
    alan.on('pointerdown', () => tikla());
  }
}
