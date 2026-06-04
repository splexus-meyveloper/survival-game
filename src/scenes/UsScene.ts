// Üs sahnesi — izometrik grid + bina yerleştirme (Görev 1 iskeleti)
import Phaser from 'phaser';
import { SaveSystem, OyunDurumu } from '@/systems/SaveSystem';
import { BuildSystem } from '@/systems/BuildSystem';
import { EconomySystem } from '@/systems/EconomySystem';
import { InventorySystem } from '@/systems/InventorySystem';
import { ProductionSystem } from '@/systems/ProductionSystem';
import { ISO_GRID, BINA_TANIMLARI } from '@/config/balance';
import { gridToScreen, screenToGrid, gridEkranBoyutu } from '@/iso/isoHelper';
import { MALZEME_TURLERI, MalzemeTuru } from '@/config/balance';

// İlk inşaat için seçili bina ID'si (arayüz açıldığında değişecek)
const VARSAYILAN_BINA = 'hurda_toplama';

export class UsScene extends Phaser.Scene {
  private saveSystem!: SaveSystem;
  private buildSystem!: BuildSystem;
  private ekonomi!: EconomySystem;
  private envanter!: InventorySystem;
  private uretim!: ProductionSystem;
  private durum!: OyunDurumu;

  // Render
  private gridGfx!: Phaser.GameObjects.Graphics;
  private binaGfx!: Phaser.GameObjects.Graphics;
  private hovGfx!: Phaser.GameObjects.Graphics;  // hover hücresi
  private uiMetinler: Phaser.GameObjects.Text[] = [];
  private kameraOffsetX: number = 0;
  private kameraOffsetY: number = 0;

  // Seçili bina modu
  private seciliBinaId: string = VARSAYILAN_BINA;
  private yerleştirmeModu: boolean = false;
  private hazir: boolean = false;

  constructor() {
    super({ key: 'UsScene' });
  }

  async create(): Promise<void> {
    this.hazir = false;
    this.uiMetinler = [];

    this.saveSystem = new SaveSystem();
    this.buildSystem = new BuildSystem();
    this.ekonomi = new EconomySystem();
    this.envanter = new InventorySystem();
    this.uretim = new ProductionSystem();

    // Kayıttan yükle
    this.durum = await this.saveSystem.yukle();
    this.ekonomi.setKredi(this.durum.kredi);
    this.envanter.yukle(this.durum.envanter);
    this.buildSystem.yukle(this.durum.binalar);

    // Offline üretim
    const kazanilan = this.uretim.offlineUretimiHesapla(
      this.durum.binalar,
      this.durum.sonGorulme,
      this.envanter,
    );
    this.offlineKazanilanGoster(kazanilan);

    // Grid merkezini hesapla
    const boyut = gridEkranBoyutu();
    const { width, height } = this.scale;
    this.kameraOffsetX = (width - boyut.x) / 2;
    this.kameraOffsetY = height / 2 - boyut.y / 4;

    // Grafik katmanları
    this.gridGfx = this.add.graphics();
    this.binaGfx = this.add.graphics();
    this.hovGfx = this.add.graphics();

    this.gridCiz();
    this.binaGfx.setDepth(10);
    this.hovGfx.setDepth(20);

    // UI
    this.uiOlustur();
    this.binaButonlariOlustur();

    // Mouse/dokunma girdisi
    this.input.on('pointermove', this.hoverGuncelle, this);
    this.input.on('pointerdown', this.tiklandi, this);

    // Ana menüye dön butonu
    this.butonEkle(width - 10, 10, '← Menü', () => {
      this.kaydet();
      this.scene.start('MainMenuScene');
    }, 'right');

    // Sefer butonu
    this.butonEkle(width - 10, 50, '⚔ Sefer', () => {
      this.kaydet();
      this.scene.start('ExpeditionScene');
    }, 'right');

    this.hazir = true;
  }

  update(_time: number, delta: number): void {
    if (!this.hazir) return;
    // Aktif üretim
    this.uretim.guncelle(this.buildSystem.getBinalar(), this.envanter, delta);
    // Ekonomi güncelle (fiyat dalgalanması)
    this.ekonomi.guncelle();
    // UI yenile
    this.uiGuncelle();
    // Binaları yeniden çiz (üretim görsel değişimi için ileride animasyon eklenecek)
    this.binaGfx.clear();
    this.binaCiz();
  }

  // --- Grid çizimi ---

  private gridCiz(): void {
    this.gridGfx.clear();
    for (let col = 0; col < ISO_GRID.genislik; col++) {
      for (let row = 0; row < ISO_GRID.yukseklik; row++) {
        const renk = this.tileTonuHesapla(col, row);
        this.izoDortgenCiz(this.gridGfx, col, row, renk, 0.92, 0x1a3a5a);
      }
    }
  }

  private tileTonuHesapla(col: number, row: number): number {
    const tonlar = [0x0c1e3a, 0x0d1f3c, 0x0e2040, 0x0b1d38, 0x0f2144, 0x0d213e];
    return tonlar[(col * 3 + row * 5 + Math.floor(col * row * 0.7)) % tonlar.length];
  }

  private izoDortgenCiz(
    gfx: Phaser.GameObjects.Graphics,
    col: number, row: number,
    dolguRenk: number, dolguAlfa: number,
    konturRenk: number,
  ): void {
    const { x, y } = this.gridToEkran(col, row);
    const hw = ISO_GRID.hucreW / 2;
    const hh = ISO_GRID.hucreH / 2;

    gfx.fillStyle(dolguRenk, dolguAlfa);
    gfx.lineStyle(1, konturRenk, 0.8);
    // fillPoints Vector2[] ister; moveTo/lineTo ile çiz
    gfx.beginPath();
    gfx.moveTo(x, y - hh);
    gfx.lineTo(x + hw, y);
    gfx.lineTo(x, y + hh);
    gfx.lineTo(x - hw, y);
    gfx.closePath();
    gfx.fillPath();
    gfx.strokePath();
  }

  private binaCiz(): void {
    for (const bina of this.buildSystem.getBinalar()) {
      const { x, y } = this.gridToEkran(bina.col, bina.row);
      const renkler: Record<string, number> = {
        hurda_toplama: 0x888800,
        biyokutle_ciftligi: 0x228822,
        kristal_arastirma: 0x224488,
      };
      const renk = renkler[bina.id] ?? 0x555555;

      // Basit izometrik kutu (placeholder — sprite sonra gelecek)
      const hw = ISO_GRID.hucreW / 2;
      const hh = ISO_GRID.hucreH / 2;
      const yukYukseklik = 20 + bina.seviye * 8;

      const izoPoly = (g: Phaser.GameObjects.Graphics, pts: number[][]): void => {
        g.beginPath();
        g.moveTo(pts[0][0], pts[0][1]);
        for (let pi = 1; pi < pts.length; pi++) g.lineTo(pts[pi][0], pts[pi][1]);
        g.closePath();
        g.fillPath();
      };

      // Taban
      this.binaGfx.fillStyle(renk, 1);
      izoPoly(this.binaGfx, [[x, y - hh], [x + hw, y], [x, y + hh], [x - hw, y]]);

      // Sol yüz
      this.binaGfx.fillStyle(renk - 0x333333, 1);
      izoPoly(this.binaGfx, [[x - hw, y], [x, y + hh], [x, y + hh - yukYukseklik], [x - hw, y - yukYukseklik]]);

      // Sağ yüz
      this.binaGfx.fillStyle(renk - 0x111111, 1);
      izoPoly(this.binaGfx, [[x + hw, y], [x, y + hh], [x, y + hh - yukYukseklik], [x + hw, y - yukYukseklik]]);

      // Üst yüz
      this.binaGfx.fillStyle(renk + 0x111111, 1);
      izoPoly(this.binaGfx, [[x, y - hh - yukYukseklik], [x + hw, y - yukYukseklik], [x, y + hh - yukYukseklik], [x - hw, y - yukYukseklik]]);

      // Seviye etiketi
      this.add.text(x, y - hh - yukYukseklik - 10, `Sv${bina.seviye}`, {
        fontSize: '10px', color: '#ffffff',
      }).setOrigin(0.5).setDepth(30);
    }
  }

  // --- Hover ---

  private hoverGuncelle(pointer: Phaser.Input.Pointer): void {
    if (!this.yerleştirmeModu) { this.hovGfx.clear(); return; }
    const { col, row } = this.ekranToGrid(pointer.x, pointer.y);
    this.hovGfx.clear();
    if (col >= 0 && col < ISO_GRID.genislik && row >= 0 && row < ISO_GRID.yukseklik) {
      this.izoDortgenCiz(this.hovGfx, col, row, 0x44aaff, 0.3, 0x44aaff);
    }
  }

  // --- Tıklama ---

  private tiklandi(pointer: Phaser.Input.Pointer): void {
    if (!this.yerleştirmeModu) return;
    const { col, row } = this.ekranToGrid(pointer.x, pointer.y);
    if (col < 0 || col >= ISO_GRID.genislik || row < 0 || row >= ISO_GRID.yukseklik) return;

    const basarili = this.buildSystem.insaEt(this.seciliBinaId, col, row, this.ekonomi);
    if (basarili) {
      this.durum.binalar = this.buildSystem.getBinalar();
      this.kaydet();
      this.bildirim('Bina inşa edildi!', '#44ff88');
    } else {
      this.bildirim('İnşaat başarısız! (Kredi yetersiz veya alan dolu)', '#ff4444');
    }
  }

  // --- UI ---

  private uiOlustur(): void {
    const gfx = this.add.graphics();
    gfx.fillStyle(0x000000, 0.65);
    gfx.fillRoundedRect(8, 8, 200, 130, 6);
    gfx.setDepth(50);

    for (let i = 0; i < 4; i++) {
      const t = this.add.text(14, 14 + i * 26, '', {
        fontSize: '13px', color: '#aaddff',
      }).setDepth(51);
      this.uiMetinler.push(t);
    }
    this.uiGuncelle();
  }

  private uiGuncelle(): void {
    if (this.uiMetinler.length < 4) return;
    const k = this.envanter;
    this.uiMetinler[0].setText(`💰 Kredi: ${this.ekonomi.getKredi()}`);
    this.uiMetinler[1].setText(`🔩 Hurda: ${Math.floor(k.getMiktar('hurda'))}`);
    this.uiMetinler[2].setText(`🌿 Biyokütle: ${Math.floor(k.getMiktar('biyokutle'))}`);
    this.uiMetinler[3].setText(`💎 Kristal: ${Math.floor(k.getMiktar('kristal'))}`);
  }

  private binaButonlariOlustur(): void {
    const { height } = this.scale;
    const binaIdler = Object.keys(BINA_TANIMLARI);
    binaIdler.forEach((id, i) => {
      const tanim = BINA_TANIMLARI[id];
      const etiket = `${tanim.ad}\n${tanim.krediBedeli}₵`;
      this.butonEkle(10 + i * 130, height - 10, etiket, () => {
        this.seciliBinaId = id;
        this.yerleştirmeModu = true;
        this.bildirim(`"${tanim.ad}" seçildi — grid'e tıkla`, '#ffdd44');
      }, 'left-bottom');
    });

    // İptal modu
    this.butonEkle(10 + binaIdler.length * 130, height - 10, 'İPTAL', () => {
      this.yerleştirmeModu = false;
      this.hovGfx.clear();
    }, 'left-bottom');
  }

  // --- Yardımcılar ---

  private gridToEkran(col: number, row: number): { x: number; y: number } {
    const pos = gridToScreen(col, row);
    return { x: pos.x + this.kameraOffsetX, y: pos.y + this.kameraOffsetY };
  }

  private ekranToGrid(sx: number, sy: number): { col: number; row: number } {
    return screenToGrid(sx - this.kameraOffsetX, sy - this.kameraOffsetY);
  }

  private butonEkle(
    x: number, y: number,
    etiket: string,
    tikla: () => void,
    konum: 'left' | 'right' | 'left-bottom' = 'left',
  ): void {
    const gw = 120, gh = 40;
    let ox = 0, oy = 0;
    if (konum === 'right') { ox = gw; oy = 0; }
    if (konum === 'left-bottom') { ox = 0; oy = gh; }

    const gfx = this.add.graphics().setDepth(60);
    const ciz = (hover: boolean) => {
      gfx.clear();
      gfx.fillStyle(hover ? 0x1a4a8a : 0x0d1f3c, 0.9);
      gfx.lineStyle(1, 0x2255aa, 1);
      gfx.fillRoundedRect(x - ox, y - oy, gw, gh, 4);
      gfx.strokeRoundedRect(x - ox, y - oy, gw, gh, 4);
    };
    ciz(false);

    this.add.text(x - ox + gw / 2, y - oy + gh / 2, etiket, {
      fontSize: '11px', color: '#ffffff', align: 'center',
    }).setOrigin(0.5).setDepth(61);

    const alan = this.add.rectangle(x - ox + gw / 2, y - oy + gh / 2, gw, gh)
      .setInteractive({ useHandCursor: true }).setDepth(62);
    alan.on('pointerover', () => ciz(true));
    alan.on('pointerout', () => ciz(false));
    alan.on('pointerdown', () => tikla());
  }

  private bildirim(mesaj: string, renk: string = '#ffffff'): void {
    const { width, height } = this.scale;
    const t = this.add.text(width / 2, height - 150, mesaj, {
      fontSize: '14px', color: renk,
      backgroundColor: '#00000088', padding: { x: 10, y: 6 },
    }).setOrigin(0.5).setDepth(100);
    this.time.delayedCall(2500, () => t.destroy());
  }

  private offlineKazanilanGoster(kazanilan: Record<MalzemeTuru, number>): void {
    const toplamVar = MALZEME_TURLERI.some((t) => kazanilan[t] > 0);
    if (!toplamVar) return;
    const satirlar = MALZEME_TURLERI
      .filter((t) => kazanilan[t] > 0)
      .map((t) => `${t}: +${Math.floor(kazanilan[t])}`);
    this.bildirim(`Offline üretim:\n${satirlar.join('\n')}`, '#aaffaa');
  }

  private kaydet(): void {
    this.durum.kredi = this.ekonomi.getKredi();
    this.durum.envanter = this.envanter.snapshot();
    this.durum.binalar = this.buildSystem.getBinalar();
    void this.saveSystem.kaydet(this.durum);
  }
}
