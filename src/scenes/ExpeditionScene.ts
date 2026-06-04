// Sefer sahnesi — izometrik görünüm, otomatik saldırı, kaynak toplama
import Phaser from 'phaser';
import { SaveSystem, OyunDurumu } from '@/systems/SaveSystem';
import { InventorySystem } from '@/systems/InventorySystem';
import { EconomySystem } from '@/systems/EconomySystem';
import { SpawnSystem } from '@/systems/SpawnSystem';
import { WeaponSystem } from '@/systems/WeaponSystem';
import { Player } from '@/entities/Player';
import { Enemy } from '@/entities/Enemy';
import { ResourceNode } from '@/entities/ResourceNode';
import { Projectile } from '@/entities/Projectile';
import { SEFER, MALZEME_TURLERI } from '@/config/balance';

// Object pool boyutları
const POOL_DUSMANLAR = 40;
const POOL_MERMI     = 80;
const POOL_KAYNAK    = 15;

// İzometrik projeksiyon sabitleri
// Dünya 2400×2400 px → 25×25 grid hücresi (her hücre 96 dünya pikseli)
const ISO_CELL  = 96;
const ISO_HW    = 48;  // ekrandaki tile yarı-genişliği (px)
const ISO_HH    = 24;  // ekrandaki tile yarı-yüksekliği (px)
const MAP_TILES = SEFER.harita.genislik / ISO_CELL; // 25

function koyulastir(c: number, f: number): number {
  const r = Math.max(0, Math.floor(((c >> 16) & 0xff) * f));
  const g = Math.max(0, Math.floor(((c >>  8) & 0xff) * f));
  const b = Math.max(0, Math.floor( (c & 0xff)        * f));
  return (r << 16) | (g << 8) | b;
}

export class ExpeditionScene extends Phaser.Scene {
  private saveSystem!: SaveSystem;
  private spawnSystem!: SpawnSystem;
  private weaponSystem!: WeaponSystem;
  private envanter!: InventorySystem;
  private _ekonomi!: EconomySystem;
  private durum!: OyunDurumu;

  private oyuncu!: Player;
  private dusmanPool: Enemy[] = [];
  private mermiPool: Projectile[] = [];
  private kaynakPool: ResourceNode[] = [];

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key;
  };

  private gfx!: Phaser.GameObjects.Graphics;
  private uiGfx!: Phaser.GameObjects.Graphics;
  private uiMetinler: Phaser.GameObjects.Text[] = [];
  private dalgaMetni!: Phaser.GameObjects.Text;

  private hazir: boolean = false;

  // İzometrik kamera: viewport'un iso ekran uzayındaki sol-üst köşesi
  private kameraX: number = 0;
  private kameraY: number = 0;

  constructor() {
    super({ key: 'ExpeditionScene' });
  }

  async create(): Promise<void> {
    // Yeniden başlatmada eski state'i temizle
    this.hazir      = false;
    this.uiMetinler = [];
    this.dusmanPool = [];
    this.mermiPool  = [];
    this.kaynakPool = [];

    this.saveSystem = new SaveSystem();
    this.durum = await this.saveSystem.yukle();
    this.envanter = new InventorySystem();
    this._ekonomi = new EconomySystem(this.durum.kredi);

    this.spawnSystem = new SpawnSystem();
    this.weaponSystem = new WeaponSystem();
    this.spawnSystem.baslat();

    for (let i = 0; i < POOL_DUSMANLAR; i++) this.dusmanPool.push(new Enemy(i));
    for (let i = 0; i < POOL_MERMI;     i++) this.mermiPool.push(new Projectile(i));
    for (let i = 0; i < POOL_KAYNAK;    i++) this.kaynakPool.push(new ResourceNode(i));

    this.oyuncu = new Player(SEFER.harita.genislik / 2, SEFER.harita.yukseklik / 2);
    this.kaynakDugumleriniDagit();

    this.gfx   = this.add.graphics().setDepth(0);
    this.uiGfx = this.add.graphics().setDepth(100);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up:    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    this.uiOlustur();

    this.add.text(this.scale.width - 10, 10, '🏠 Üsse Dön', {
      fontSize: '13px', color: '#ffffff',
      backgroundColor: '#0d2040cc', padding: { x: 8, y: 5 },
    }).setOrigin(1, 0).setDepth(110).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.seferiBitir(true));

    this.hazir = true;
  }

  update(_time: number, delta: number): void {
    if (!this.hazir) return;

    let dx = 0, dy = 0;
    if (this.cursors.left.isDown  || this.wasd.left.isDown)  dx -= 1;
    if (this.cursors.right.isDown || this.wasd.right.isDown) dx += 1;
    if (this.cursors.up.isDown    || this.wasd.up.isDown)    dy -= 1;
    if (this.cursors.down.isDown  || this.wasd.down.isDown)  dy += 1;

    this.oyuncu.hareket(dx, dy, delta, SEFER.harita.genislik, SEFER.harita.yukseklik);

    if (this.oyuncu.olduMu()) { this.seferiBitir(false); return; }

    // İzometrik kamera: oyuncunun iso pozisyonu ekran merkezinde
    const { width, height } = this.scale;
    const px = this.oyuncu.state.x;
    const py = this.oyuncu.state.y;
    this.kameraX = (px - py) / 2  - width  / 2;
    this.kameraY = (px + py) / 4  - height / 2;

    const talepler = this.spawnSystem.guncelle(SEFER.harita.genislik, SEFER.harita.yukseklik);
    for (const talep of talepler) {
      this.dusmanPool.find((e) => !e.aktif)?.baslat(talep.dusmanId, talep.x, talep.y);
    }

    for (const d of this.dusmanPool) {
      if (!d.aktif) continue;
      d.hedefeSal(this.oyuncu.state.x, this.oyuncu.state.y, delta);
      const ddx = d.x - px, ddy = d.y - py;
      if (ddx * ddx + ddy * ddy < 30 * 30) {
        this.oyuncu.hasarAl(d.hasar * (delta / 1000));
      }
    }

    const aktifDusmanlar = this.dusmanPool.filter((e) => e.aktif);
    const hedef = this.weaponSystem.hedefSec(
      px, py,
      aktifDusmanlar.map((e) => ({ x: e.x, y: e.y, id: e.id })),
    );
    if (hedef && this.weaponSystem.atesEdebilir(Date.now())) {
      this.mermiPool.find((m) => !m.aktif)?.baslat(px, py, hedef.x, hedef.y, hedef.id);
    }

    for (const m of this.mermiPool) {
      if (!m.aktif) continue;
      m.guncelle(delta);
      if (m.x < 0 || m.x > SEFER.harita.genislik || m.y < 0 || m.y > SEFER.harita.yukseklik) {
        m.aktif = false; continue;
      }
      const hd = aktifDusmanlar.find((e) => e.id === m.hedefId);
      if (hd && m.carpisti(hd.x, hd.y)) {
        hd.hasarAl(m.hasar);
        m.aktif = false;
        if (!hd.aktif) {
          for (const drop of hd.dropHesapla()) this.envanter.ekle(drop.tur, drop.miktar);
        }
      }
    }

    for (const k of this.kaynakPool) {
      if (!k.aktif) continue;
      const dkx = k.x - px, dky = k.y - py;
      if (dkx * dkx + dky * dky < 40 * 40) {
        const miktar = k.hasat(delta);
        if (miktar > 0) {
          this.envanter.ekle(k.tur, miktar);
          this.bildirim(`+${miktar} ${k.tur}`, '#aaffaa');
        }
      }
    }

    this.sahneciCiz();
    this.uiGuncelle();
  }

  // ─── İzometrik Çizim ─────────────────────────────────────────────────────

  private sahneciCiz(): void {
    this.gfx.clear();
    const { width, height } = this.scale;
    const ox = this.kameraX;
    const oy = this.kameraY;

    // 1. Zemin tile'ları — sadece viewport'ta görünen hücreleri çiz
    const uMin = Math.floor(ox / ISO_HW) - 1;
    const uMax = Math.ceil((ox + width)  / ISO_HW) + 1;
    const vMin = Math.floor(oy / ISO_HH) - 1;
    const vMax = Math.ceil((oy + height) / ISO_HH) + 1;

    for (let v = vMin; v <= vMax; v++) {
      for (let u = uMin; u <= uMax; u++) {
        if ((u + v) % 2 !== 0) continue;
        const col = (u + v) / 2;
        const row = (v - u) / 2;
        if (col < 0 || col >= MAP_TILES || row < 0 || row >= MAP_TILES) continue;

        const sx = u * ISO_HW - ox;
        const sy = v * ISO_HH - oy;
        const renk = this.tileRengi(col, row);

        this.gfx.fillStyle(renk, 1);
        this.gfx.lineStyle(1, 0x090f08, 0.7);
        this.gfx.beginPath();
        this.gfx.moveTo(sx,           sy - ISO_HH);
        this.gfx.lineTo(sx + ISO_HW,  sy);
        this.gfx.lineTo(sx,           sy + ISO_HH);
        this.gfx.lineTo(sx - ISO_HW,  sy);
        this.gfx.closePath();
        this.gfx.fillPath();
        this.gfx.strokePath();
      }
    }

    // 2. Varlıkları derinlik sırasına göre topla (painter's algorithm)
    type RItem = { depth: number; draw: () => void };
    const items: RItem[] = [];

    for (const k of this.kaynakPool) {
      if (!k.aktif) continue;
      const { sx, sy } = this.wToS(k.x, k.y);
      const renk = ({ hurda: 0x998800, biyokutle: 0x228833, kristal: 0x3366cc } as Record<string, number>)[k.tur] ?? 0x666666;
      items.push({ depth: k.x + k.y, draw: () => this.isoCutu(sx, sy, 14, 10, 16, renk) });
    }

    for (const d of this.dusmanPool) {
      if (!d.aktif) continue;
      const { sx, sy } = this.wToS(d.x, d.y);
      const canOrani = d.can / d.canMax;
      items.push({
        depth: d.x + d.y,
        draw: () => {
          this.isoCutu(sx, sy, 14, 10, 22, 0xcc2222);
          this.gfx.fillStyle(0x1a1a1a, 1);
          this.gfx.fillRect(sx - 14, sy - 38, 28, 4);
          this.gfx.fillStyle(canOrani > 0.4 ? 0x44ff44 : 0xff4444, 1);
          this.gfx.fillRect(sx - 14, sy - 38, 28 * canOrani, 4);
        },
      });
    }

    {
      const { sx, sy } = this.wToS(this.oyuncu.state.x, this.oyuncu.state.y);
      const canOrani = this.oyuncu.state.can / this.oyuncu.state.canMax;
      items.push({
        depth: this.oyuncu.state.x + this.oyuncu.state.y,
        draw: () => {
          this.isoCutu(sx, sy, 16, 12, 28, 0x3399ff);
          this.gfx.fillStyle(0x1a1a1a, 1);
          this.gfx.fillRect(sx - 20, sy - 48, 40, 5);
          this.gfx.fillStyle(canOrani > 0.4 ? 0x44ff44 : 0xff4444, 1);
          this.gfx.fillRect(sx - 20, sy - 48, 40 * canOrani, 5);
        },
      });
    }

    items.sort((a, b) => a.depth - b.depth);
    for (const item of items) item.draw();

    this.gfx.fillStyle(0xffee44, 1);
    for (const m of this.mermiPool) {
      if (!m.aktif) continue;
      const { sx, sy } = this.wToS(m.x, m.y);
      this.gfx.fillCircle(sx, sy - 12, 4);
    }
  }

  private wToS(wx: number, wy: number): { sx: number; sy: number } {
    return {
      sx: (wx - wy) / 2 - this.kameraX,
      sy: (wx + wy) / 4 - this.kameraY,
    };
  }

  private isoCutu(sx: number, sy: number, hw: number, hh: number, h: number, renk: number): void {
    const sol = koyulastir(renk, 0.62);
    const sag = koyulastir(renk, 0.78);

    this.gfx.fillStyle(sol, 1);
    this.gfx.beginPath();
    this.gfx.moveTo(sx - hw, sy - h);
    this.gfx.lineTo(sx,      sy + hh - h);
    this.gfx.lineTo(sx,      sy + hh);
    this.gfx.lineTo(sx - hw, sy);
    this.gfx.closePath();
    this.gfx.fillPath();

    this.gfx.fillStyle(sag, 1);
    this.gfx.beginPath();
    this.gfx.moveTo(sx + hw, sy - h);
    this.gfx.lineTo(sx,      sy + hh - h);
    this.gfx.lineTo(sx,      sy + hh);
    this.gfx.lineTo(sx + hw, sy);
    this.gfx.closePath();
    this.gfx.fillPath();

    this.gfx.fillStyle(renk, 1);
    this.gfx.beginPath();
    this.gfx.moveTo(sx,      sy - hh - h);
    this.gfx.lineTo(sx + hw, sy - h);
    this.gfx.lineTo(sx,      sy + hh - h);
    this.gfx.lineTo(sx - hw, sy - h);
    this.gfx.closePath();
    this.gfx.fillPath();
  }

  private tileRengi(col: number, row: number): number {
    const tonlar = [0x131c10, 0x172514, 0x152312, 0x192916, 0x111d0f, 0x1a2a16];
    return tonlar[(col * 3 + row * 5 + Math.floor(col * row * 0.7)) % tonlar.length];
  }

  // ─── UI ──────────────────────────────────────────────────────────────────

  private uiOlustur(): void {
    this.uiGfx.fillStyle(0x000000, 0.6);
    this.uiGfx.fillRoundedRect(8, 8, 180, 100, 6);

    for (let i = 0; i < 4; i++) {
      const t = this.add.text(14, 14 + i * 22, '', {
        fontSize: '12px', color: '#aaddff',
      }).setDepth(110);
      this.uiMetinler.push(t);
    }

    this.dalgaMetni = this.add.text(
      this.scale.width / 2, 14, 'DALGA 0',
      { fontSize: '16px', fontStyle: 'bold', color: '#ff6644' },
    ).setOrigin(0.5, 0).setDepth(110);
  }

  private uiGuncelle(): void {
    if (this.uiMetinler.length < 4) return;
    this.uiMetinler[0].setText(`❤ Can: ${Math.ceil(this.oyuncu.state.can)}`);
    this.uiMetinler[1].setText(`🔩 Hurda: ${Math.floor(this.envanter.getMiktar('hurda'))}`);
    this.uiMetinler[2].setText(`🌿 Biokütle: ${Math.floor(this.envanter.getMiktar('biyokutle'))}`);
    this.uiMetinler[3].setText(`💎 Kristal: ${Math.floor(this.envanter.getMiktar('kristal'))}`);
    this.dalgaMetni.setText(`DALGA ${this.spawnSystem.getDalga()}`);
  }

  // ─── Yardımcılar ─────────────────────────────────────────────────────────

  private kaynakDugumleriniDagit(): void {
    const { genislik, yukseklik } = SEFER.harita;
    for (const k of this.kaynakPool) {
      k.baslat(
        100 + Math.random() * (genislik - 200),
        100 + Math.random() * (yukseklik - 200),
      );
    }
  }

  private seferiBitir(basarili: boolean): void {
    if (!this.hazir) return;
    this.hazir = false;

    if (basarili) {
      for (const tur of MALZEME_TURLERI) {
        const miktar = this.envanter.getMiktar(tur);
        if (miktar > 0) this.durum.envanter[tur] = (this.durum.envanter[tur] ?? 0) + miktar;
      }
      this.durum.toplamSefer++;
      void this.saveSystem.kaydet(this.durum);
      this.bildirim('Üsse döndün! Malzemeler kaydedildi.', '#44ff88');
    } else {
      this.bildirim('Öldün! Sefer malzemeleri kayboldu.', '#ff4444');
    }

    window.setTimeout(() => this.scene.start('UsScene'), 1500);
  }

  private bildirim(mesaj: string, renk: string = '#ffffff'): void {
    const { width, height } = this.scale;
    const t = this.add.text(width / 2, height - 60, mesaj, {
      fontSize: '14px', color: renk,
      backgroundColor: '#00000088', padding: { x: 10, y: 6 },
    }).setOrigin(0.5).setDepth(120);
    this.time.delayedCall(2500, () => t.destroy());
  }
}
