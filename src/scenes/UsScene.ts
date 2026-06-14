// Üs sahnesi — izometrik grid + bina yerleştirme + karakter geliştirme
import Phaser from 'phaser';
import { SaveSystem, OyunDurumu } from '@/systems/SaveSystem';
import { BuildSystem } from '@/systems/BuildSystem';
import { EconomySystem } from '@/systems/EconomySystem';
import { InventorySystem } from '@/systems/InventorySystem';
import { ProductionSystem } from '@/systems/ProductionSystem';
import {
  ISO_GRID, BINA_TANIMLARI,
  MALZEME_TURLERI, MalzemeTuru,
  KARAKTER_YUKSELTMELERI, TEMEL_MAX_YUKSELTME,
} from '@/config/balance';
import { gridToScreen, screenToGrid, gridEkranBoyutu } from '@/iso/isoHelper';

const VARSAYILAN_BINA = 'hurda_toplama';

export class UsScene extends Phaser.Scene {
  private saveSystem!: SaveSystem;
  private buildSystem!: BuildSystem;
  private ekonomi!: EconomySystem;
  private envanter!: InventorySystem;
  private uretim!: ProductionSystem;
  private durum!: OyunDurumu;

  private gridGfx!: Phaser.GameObjects.Graphics;
  private binaGfx!: Phaser.GameObjects.Graphics;
  private hovGfx!: Phaser.GameObjects.Graphics;
  private uiMetinler: Phaser.GameObjects.Text[] = [];
  private kameraOffsetX: number = 0;
  private kameraOffsetY: number = 0;

  private seciliBinaId: string = VARSAYILAN_BINA;
  private yerleştirmeModu: boolean = false;
  private hazir: boolean = false;

  // Geliştirme paneli
  private gelistirmePaneli: Phaser.GameObjects.Container | null = null;

  constructor() {
    super({ key: 'UsScene' });
  }

  async create(): Promise<void> {
    this.hazir = false;
    this.uiMetinler = [];
    this.gelistirmePaneli = null;

    this.saveSystem = new SaveSystem();
    this.buildSystem = new BuildSystem();
    this.ekonomi = new EconomySystem();
    this.envanter = new InventorySystem();
    this.uretim = new ProductionSystem();

    this.durum = await this.saveSystem.yukle();
    this.ekonomi.setKredi(this.durum.kredi);
    this.envanter.yukle(this.durum.envanter);
    this.buildSystem.yukle(this.durum.binalar);

    const kazanilan = this.uretim.offlineUretimiHesapla(
      this.durum.binalar,
      this.durum.sonGorulme,
      this.envanter,
    );
    this.offlineKazanilanGoster(kazanilan);

    const boyut = gridEkranBoyutu();
    const { width, height } = this.scale;
    this.kameraOffsetX = (width - boyut.x) / 2;
    this.kameraOffsetY = height / 2 - boyut.y / 4;

    this.gridGfx = this.add.graphics();
    this.binaGfx = this.add.graphics();
    this.hovGfx = this.add.graphics();

    this.gridCiz();
    this.binaGfx.setDepth(10);
    this.hovGfx.setDepth(20);

    this.uiOlustur();
    this.binaButonlariOlustur();

    this.input.on('pointermove', this.hoverGuncelle, this);
    this.input.on('pointerdown', this.tiklandi, this);

    // Sağ üst butonlar
    this.butonEkle(width - 10, 10,  '← Menü', () => { this.kaydet(); this.scene.start('MainMenuScene'); }, 'right');
    this.butonEkle(width - 10, 58,  '⚔ Sefer', () => { this.kaydet(); this.scene.start('ExpeditionScene'); }, 'right');
    this.butonEkle(width - 10, 106, '⚡ Geliştir', () => this.gelistirmePaneliniAc(), 'right');

    this.hazir = true;
  }

  update(_time: number, delta: number): void {
    if (!this.hazir) return;
    this.uretim.guncelle(this.buildSystem.getBinalar(), this.envanter, delta);
    this.ekonomi.guncelle();
    this.uiGuncelle();
    this.binaGfx.clear();
    this.binaCiz();
  }

  // ─── Grid ────────────────────────────────────────────────────────────────

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
    gfx.beginPath();
    gfx.moveTo(x,      y - hh);
    gfx.lineTo(x + hw, y);
    gfx.lineTo(x,      y + hh);
    gfx.lineTo(x - hw, y);
    gfx.closePath();
    gfx.fillPath();
    gfx.strokePath();
  }

  private binaCiz(): void {
    for (const bina of this.buildSystem.getBinalar()) {
      const { x, y } = this.gridToEkran(bina.col, bina.row);
      const renkler: Record<string, number> = {
        hurda_toplama:      0x888800,
        biyokutle_ciftligi: 0x228822,
        kristal_arastirma:  0x224488,
        gelistirme_merkezi: 0x882288,
      };
      const renk = renkler[bina.id] ?? 0x555555;
      const hw = ISO_GRID.hucreW / 2;
      const hh = ISO_GRID.hucreH / 2;
      const yuk = 20 + bina.seviye * 8;

      const poly = (g: Phaser.GameObjects.Graphics, pts: number[][]): void => {
        g.beginPath();
        g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
        g.closePath();
        g.fillPath();
      };

      this.binaGfx.fillStyle(renk, 1);
      poly(this.binaGfx, [[x, y - hh], [x + hw, y], [x, y + hh], [x - hw, y]]);

      this.binaGfx.fillStyle(Math.max(0, renk - 0x333333), 1);
      poly(this.binaGfx, [[x - hw, y], [x, y + hh], [x, y + hh - yuk], [x - hw, y - yuk]]);

      this.binaGfx.fillStyle(Math.max(0, renk - 0x111111), 1);
      poly(this.binaGfx, [[x + hw, y], [x, y + hh], [x, y + hh - yuk], [x + hw, y - yuk]]);

      this.binaGfx.fillStyle(Math.min(0xffffff, renk + 0x111111), 1);
      poly(this.binaGfx, [[x, y - hh - yuk], [x + hw, y - yuk], [x, y + hh - yuk], [x - hw, y - yuk]]);

      this.add.text(x, y - hh - yuk - 10, `Sv${bina.seviye}`, {
        fontSize: '10px', color: '#ffffff',
      }).setOrigin(0.5).setDepth(30);
    }
  }

  // ─── Hover / Tıklama ─────────────────────────────────────────────────────

  private hoverGuncelle(pointer: Phaser.Input.Pointer): void {
    if (!this.yerleştirmeModu) { this.hovGfx.clear(); return; }
    const { col, row } = this.ekranToGrid(pointer.x, pointer.y);
    this.hovGfx.clear();
    if (col >= 0 && col < ISO_GRID.genislik && row >= 0 && row < ISO_GRID.yukseklik) {
      this.izoDortgenCiz(this.hovGfx, col, row, 0x44aaff, 0.3, 0x44aaff);
    }
  }

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

  // ─── UI ──────────────────────────────────────────────────────────────────

  private uiOlustur(): void {
    const gfx = this.add.graphics();
    gfx.fillStyle(0x000000, 0.65);
    gfx.fillRoundedRect(8, 8, 210, 140, 6);
    gfx.setDepth(50);

    for (let i = 0; i < 5; i++) {
      const t = this.add.text(14, 14 + i * 25, '', {
        fontSize: '13px', color: '#aaddff',
      }).setDepth(51);
      this.uiMetinler.push(t);
    }
    this.uiGuncelle();
  }

  private uiGuncelle(): void {
    if (this.uiMetinler.length < 5) return;
    const k = this.envanter;
    this.uiMetinler[0].setText(`💰 Kredi: ${this.ekonomi.getKredi()}`);
    this.uiMetinler[1].setText(`🔩 Hurda: ${Math.floor(k.getMiktar('hurda'))}`);
    this.uiMetinler[2].setText(`🌿 Biyokütle: ${Math.floor(k.getMiktar('biyokutle'))}`);
    this.uiMetinler[3].setText(`💎 Kristal: ${Math.floor(k.getMiktar('kristal'))}`);
    this.uiMetinler[4].setText(`☠ Öldürme: ${this.durum.toplamOldurme ?? 0}`);
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

    this.butonEkle(10 + binaIdler.length * 130, height - 10, 'İPTAL', () => {
      this.yerleştirmeModu = false;
      this.hovGfx.clear();
    }, 'left-bottom');
  }

  // ─── Karakter Geliştirme Paneli ──────────────────────────────────────────

  private gelistirmePaneliniAc(): void {
    if (this.gelistirmePaneli) {
      this.gelistirmePaneliniKapat();
      return;
    }

    const hasGelistirmeMerkezi = this.buildSystem.getBinalar()
      .some((b) => b.id === 'gelistirme_merkezi');
    const gelisimMerkeziSeviye = this.buildSystem.getBinalar()
      .find((b) => b.id === 'gelistirme_merkezi')?.seviye ?? 0;

    const panelW = 320;
    const { width, height } = this.scale;
    const panelX = width - panelW - 10;
    const panelY = 10;

    const yukseltmeler = Object.values(KARAKTER_YUKSELTMELERI);
    const satirYukseklik = 72;
    const panelH = 48 + yukseltmeler.length * satirYukseklik + 16;

    const container = this.add.container(panelX, panelY).setDepth(200);

    const bg = this.add.graphics();
    bg.fillStyle(0x050e1a, 0.97);
    bg.lineStyle(2, 0x5522aa, 1);
    bg.fillRoundedRect(0, 0, panelW, Math.min(panelH, height - 20), 8);
    bg.strokeRoundedRect(0, 0, panelW, Math.min(panelH, height - 20), 8);
    container.add(bg);

    container.add(
      this.add.text(panelW / 2, 12, '⚡ Karakter Geliştirme', {
        fontSize: '14px', fontStyle: 'bold', color: '#cc88ff',
      }).setOrigin(0.5, 0),
    );

    if (!hasGelistirmeMerkezi) {
      container.add(
        this.add.text(panelW / 2, 36, '⚠ Geliştirme Merkezi inşa et\nüst seviye yükseltmeleri aç!', {
          fontSize: '11px', color: '#ffaa44', align: 'center',
        }).setOrigin(0.5, 0),
      );
    }

    yukseltmeler.forEach((yukseltme, i) => {
      const mevcutSeviye = this.durum.karakterGelisim?.[yukseltme.id] ?? 0;
      const maksErisim = hasGelistirmeMerkezi
        ? yukseltme.maksSeviyet
        : Math.min(yukseltme.maksSeviyet, TEMEL_MAX_YUKSELTME);
      const maksimumda = mevcutSeviye >= yukseltme.maksSeviyet;
      const kilitli    = mevcutSeviye >= maksErisim && !maksimumda;

      const y = 44 + i * satirYukseklik;

      // Satır arka plan
      const satirBg = this.add.graphics();
      satirBg.fillStyle(mevcutSeviye > 0 ? 0x0d2840 : 0x0a1020, 0.9);
      satirBg.fillRoundedRect(8, y, panelW - 16, satirYukseklik - 6, 4);
      container.add(satirBg);

      // İkon + isim
      container.add(
        this.add.text(16, y + 6, `${yukseltme.icon} ${yukseltme.ad}`, {
          fontSize: '12px', fontStyle: 'bold', color: '#ffffff',
        }),
      );

      // Seviye göstergesi (daireler)
      for (let lv = 0; lv < yukseltme.maksSeviyet; lv++) {
        const dairegfx = this.add.graphics();
        const dolu = lv < mevcutSeviye;
        const erisim = lv < maksErisim;
        dairegfx.fillStyle(dolu ? 0x8844ff : (erisim ? 0x334466 : 0x221133), 1);
        dairegfx.fillCircle(16 + lv * 14, y + 28, 5);
        if (dolu) {
          dairegfx.lineStyle(1, 0xcc88ff, 1);
          dairegfx.strokeCircle(16 + lv * 14, y + 28, 5);
        }
        container.add(dairegfx);
      }

      // Mevcut / sonraki değer
      const simdikiMetin = mevcutSeviye > 0
        ? yukseltme.degerMetni(mevcutSeviye)
        : 'Yok';
      const sonrakiMetin = !maksimumda && !kilitli
        ? `→ ${yukseltme.degerMetni(mevcutSeviye + 1)}`
        : '';
      container.add(
        this.add.text(16, y + 40, `${simdikiMetin}  ${sonrakiMetin}`, {
          fontSize: '10px', color: '#88aacc',
        }),
      );

      // Maliyet ve buton
      if (!maksimumda) {
        const maliyet = yukseltme.maliyet(mevcutSeviye);
        const maliyetMetni = kilitli
          ? '🔒 Geliştirme Merkezi gerek'
          : `${maliyet.kredi}₵${maliyet.kristal > 0 ? `  💎${maliyet.kristal}` : ''}`;
        const maliyetRenk = kilitli ? '#ff6644'
          : (this.ekonomi.getKredi() >= maliyet.kredi &&
             this.envanter.getMiktar('kristal') >= maliyet.kristal)
            ? '#aaffaa' : '#ff8888';

        container.add(
          this.add.text(panelW - 100, y + 6, maliyetMetni, {
            fontSize: '10px', color: maliyetRenk, align: 'right',
          }).setOrigin(1, 0),
        );

        if (!kilitli) {
          const btnX = panelW - 84;
          const btnGfx = this.add.graphics();
          const canAfford = this.ekonomi.getKredi() >= maliyet.kredi &&
                            this.envanter.getMiktar('kristal') >= maliyet.kristal;
          const btnRenk = canAfford ? 0x442288 : 0x221133;
          btnGfx.fillStyle(btnRenk, 1);
          btnGfx.fillRoundedRect(btnX, y + 22, 72, 24, 4);
          container.add(btnGfx);

          const btnYazi = this.add.text(btnX + 36, y + 34, 'YÜKSELT', {
            fontSize: '10px', color: canAfford ? '#cc88ff' : '#556677',
          }).setOrigin(0.5);
          container.add(btnYazi);

          if (canAfford) {
            const alan = this.add.rectangle(btnX + 36, y + 34, 72, 24)
              .setInteractive({ useHandCursor: true });
            container.add(alan);
            alan.on('pointerover', () => { btnGfx.clear(); btnGfx.fillStyle(0x6633bb, 1); btnGfx.fillRoundedRect(btnX, y + 22, 72, 24, 4); });
            alan.on('pointerout',  () => { btnGfx.clear(); btnGfx.fillStyle(0x442288, 1); btnGfx.fillRoundedRect(btnX, y + 22, 72, 24, 4); });
            alan.on('pointerdown', () => this.yukseltmeYap(yukseltme.id, gelisimMerkeziSeviye));
          }
        }
      } else {
        container.add(
          this.add.text(panelW - 16, y + 28, '✓ MAKS', {
            fontSize: '10px', color: '#44ffaa',
          }).setOrigin(1, 0.5),
        );
      }
    });

    // Kapat butonu
    const kapatY = Math.min(panelH, height - 20) - 32;
    const kapatAlan = this.add.rectangle(panelW / 2, kapatY + 12, 80, 24)
      .setInteractive({ useHandCursor: true });
    const kapatGfx = this.add.graphics();
    kapatGfx.fillStyle(0x3a1010, 1);
    kapatGfx.fillRoundedRect(panelW / 2 - 40, kapatY, 80, 24, 4);
    container.add(kapatGfx);
    container.add(
      this.add.text(panelW / 2, kapatY + 12, '✕ Kapat', {
        fontSize: '10px', color: '#ff8888',
      }).setOrigin(0.5),
    );
    container.add(kapatAlan);
    kapatAlan.on('pointerdown', () => this.gelistirmePaneliniKapat());

    this.gelistirmePaneli = container;
  }

  private gelistirmePaneliniKapat(): void {
    if (this.gelistirmePaneli) {
      this.gelistirmePaneli.destroy(true);
      this.gelistirmePaneli = null;
    }
  }

  private yukseltmeYap(yukseltmeId: string, _gelisimSeviye: number): void {
    const tanim = KARAKTER_YUKSELTMELERI[yukseltmeId];
    if (!tanim) return;

    if (!this.durum.karakterGelisim) this.durum.karakterGelisim = {};
    const mevcutSeviye = this.durum.karakterGelisim[yukseltmeId] ?? 0;
    if (mevcutSeviye >= tanim.maksSeviyet) return;

    const maliyet = tanim.maliyet(mevcutSeviye);

    if (!this.ekonomi.harca(maliyet.kredi)) {
      this.bildirim('Yeterli kredi yok!', '#ff4444');
      return;
    }
    if (maliyet.kristal > 0 && !this.envanter.cikar('kristal', maliyet.kristal)) {
      // Kredit geri ver
      this.ekonomi.setKredi(this.ekonomi.getKredi() + maliyet.kredi);
      this.bildirim('Yeterli kristal yok!', '#ff4444');
      return;
    }

    this.durum.karakterGelisim[yukseltmeId] = mevcutSeviye + 1;
    this.kaydet();

    const yeniDeger = tanim.degerMetni(mevcutSeviye + 1);
    this.bildirim(
      `${tanim.icon} ${tanim.ad} Seviye ${mevcutSeviye + 1}! (${yeniDeger})`,
      '#cc88ff',
    );

    // Paneli yenile
    this.gelistirmePaneliniKapat();
    this.gelistirmePaneliniAc();
  }

  // ─── Yardımcılar ─────────────────────────────────────────────────────────

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
