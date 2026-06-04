// Ana menü sahnesi — Phaser Graphics ile çizilmiş placeholder UI
import Phaser from 'phaser';
import { SaveSystem } from '@/systems/SaveSystem';

export class MainMenuScene extends Phaser.Scene {
  private saveSystem!: SaveSystem;

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create(): void {
    this.saveSystem = new SaveSystem();
    const { width, height } = this.scale;
    const cx = width / 2;

    this.cizArkaplan(width, height);
    this.cizBaslik(cx);
    this.menuButonlariOlustur(cx, height);
  }

  private cizArkaplan(w: number, h: number): void {
    // Koyu degrade arka plan (Graphics ile)
    const gfx = this.add.graphics();
    gfx.fillGradientStyle(0x0a0a1f, 0x0a0a1f, 0x0d1f3c, 0x0d1f3c, 1);
    gfx.fillRect(0, 0, w, h);

    // Dekoratif izometrik çizgiler
    gfx.lineStyle(1, 0x1a2a4a, 0.4);
    for (let i = -h; i < w + h; i += 40) {
      gfx.lineBetween(i, 0, i + h, h);
      gfx.lineBetween(i, 0, i - h, h);
    }
    gfx.strokePath();
  }

  private cizBaslik(cx: number): void {
    // Logo placeholder (grafiker gelince sprite olur)
    const gfx = this.add.graphics();
    // Altıgen amblem
    gfx.lineStyle(3, 0x44aaff, 1);
    gfx.fillStyle(0x0d2040, 1);
    const r = 50;
    const cx2 = cx;
    const cy2 = 100;
    const noktalar: number[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      noktalar.push(cx2 + r * Math.cos(a), cy2 + r * Math.sin(a));
    }
    // moveTo/lineTo ile altıgen — fillPoints Vector2[] bekliyor
    gfx.beginPath();
    for (let pi = 0; pi < 12; pi += 2) {
      if (pi === 0) gfx.moveTo(noktalar[pi], noktalar[pi + 1]);
      else gfx.lineTo(noktalar[pi], noktalar[pi + 1]);
    }
    gfx.closePath();
    gfx.fillPath();
    gfx.strokePath();

    this.add.text(cx, 100, 'S', {
      fontSize: '36px',
      fontStyle: 'bold',
      color: '#44aaff',
    }).setOrigin(0.5);

    this.add.text(cx, 170, 'SURVIVAL BASE', {
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#ffffff',
      letterSpacing: 4,
    }).setOrigin(0.5);

    this.add.text(cx, 205, 'HAYATİ KAL · İNŞA ET · SEFER YAP', {
      fontSize: '12px',
      color: '#6688aa',
      letterSpacing: 2,
    }).setOrigin(0.5);
  }

  private menuButonlariOlustur(cx: number, height: number): void {
    const butonlar = [
      { etiket: 'OYUNA BAŞLA', sahne: 'UsScene', renk: 0x1a6aff },
      { etiket: 'SEFER (DEMO)', sahne: 'ExpeditionScene', renk: 0x226622 },
      { etiket: 'KAYDI SİL', sahne: null, renk: 0x662222 },
    ];

    const baslangicY = height / 2 - 30;
    butonlar.forEach(({ etiket, sahne, renk }, i) => {
      const y = baslangicY + i * 70;
      this.butonOlustur(cx, y, etiket, 240, 46, renk, () => {
        if (sahne) {
          this.scene.start(sahne);
        } else {
          this.kaydiSil();
        }
      });
    });

    this.add.text(cx, height - 30, 'v0.1.0 — Taslak', {
      fontSize: '11px',
      color: '#334455',
    }).setOrigin(0.5);
  }

  private butonOlustur(
    x: number, y: number,
    etiket: string,
    genislik: number, yukseklik: number,
    renk: number,
    tikla: () => void,
  ): void {
    const gfx = this.add.graphics();
    // Normal görünüm
    const cizButon = (hover: boolean) => {
      gfx.clear();
      gfx.fillStyle(hover ? renk : 0x0d1f3c, 1);
      gfx.lineStyle(2, renk, 1);
      gfx.fillRoundedRect(x - genislik / 2, y - yukseklik / 2, genislik, yukseklik, 4);
      gfx.strokeRoundedRect(x - genislik / 2, y - yukseklik / 2, genislik, yukseklik, 4);
    };
    cizButon(false);

    const metin = this.add.text(x, y, etiket, {
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ffffff',
      letterSpacing: 2,
    }).setOrigin(0.5);

    // Etkileşim bölgesi için görünmez dikdörtgen
    const alan = this.add.rectangle(x, y, genislik, yukseklik)
      .setInteractive({ useHandCursor: true });

    alan.on('pointerover', () => { cizButon(true); metin.setColor('#ffffff'); });
    alan.on('pointerout', () => { cizButon(false); });
    alan.on('pointerdown', () => tikla());
  }

  private async kaydiSil(): Promise<void> {
    await this.saveSystem.sil();
    // Küçük bir bildirim göster
    const { width, height } = this.scale;
    const bildirim = this.add.text(width / 2, height - 70, 'Kayıt silindi!', {
      fontSize: '14px', color: '#ff4444',
    }).setOrigin(0.5);
    this.time.delayedCall(2000, () => bildirim.destroy());
  }
}
