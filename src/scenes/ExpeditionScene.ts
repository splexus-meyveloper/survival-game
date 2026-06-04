// Sefer sahnesi — top-down, otomatik saldırı, kaynak toplama (iskelet)
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
const POOL_MERMI = 80;
const POOL_KAYNAK = 15;

export class ExpeditionScene extends Phaser.Scene {
  // Sistemler
  private saveSystem!: SaveSystem;
  private spawnSystem!: SpawnSystem;
  private weaponSystem!: WeaponSystem;
  private envanter!: InventorySystem; // Sefer envanteri (geçici)
  private _ekonomi!: EconomySystem;
  private durum!: OyunDurumu;

  // Entity'ler
  private oyuncu!: Player;
  private dusmanPool: Enemy[] = [];
  private mermiPool: Projectile[] = [];
  private kaynakPool: ResourceNode[] = [];

  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };

  // Render (Graphics placeholder)
  private gfx!: Phaser.GameObjects.Graphics;
  private uiGfx!: Phaser.GameObjects.Graphics;
  private uiMetinler: Phaser.GameObjects.Text[] = [];
  private dalgaMetni!: Phaser.GameObjects.Text;

  private hazir: boolean = false;

  // Kamera scroll
  private kameraX: number = 0;
  private kameraY: number = 0;

  constructor() {
    super({ key: 'ExpeditionScene' });
  }

  async create(): Promise<void> {
    this.saveSystem = new SaveSystem();
    this.durum = await this.saveSystem.yukle();
    // Sefer envanteri başlangıçta boş (ölürse kaybedilir)
    this.envanter = new InventorySystem();
    this._ekonomi = new EconomySystem(this.durum.kredi);

    // Sistemler
    this.spawnSystem = new SpawnSystem();
    this.weaponSystem = new WeaponSystem();
    this.spawnSystem.baslat();

    // Object pool'ları oluştur
    for (let i = 0; i < POOL_DUSMANLAR; i++) this.dusmanPool.push(new Enemy(i));
    for (let i = 0; i < POOL_MERMI; i++) this.mermiPool.push(new Projectile(i));
    for (let i = 0; i < POOL_KAYNAK; i++) this.kaynakPool.push(new ResourceNode(i));

    // Oyuncu — harita merkezine başlar
    this.oyuncu = new Player(SEFER.harita.genislik / 2, SEFER.harita.yukseklik / 2);

    // Kaynak düğümlerini haritaya dağıt
    this.kaynakDugumleriniDagit();

    // Grafik katmanı
    this.gfx = this.add.graphics().setDepth(0);
    this.uiGfx = this.add.graphics().setDepth(100);

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // UI
    this.uiOlustur();

    // Üsse dön butonu
    this.add.text(this.scale.width - 10, 10, '🏠 Üsse Dön', {
      fontSize: '13px', color: '#ffffff',
      backgroundColor: '#0d2040cc', padding: { x: 8, y: 5 },
    }).setOrigin(1, 0).setDepth(110).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.seferiBitir(true));

    this.hazir = true;
  }

  update(_time: number, delta: number): void {
    if (!this.hazir) return;
    // Hareket girdisi
    let dx = 0, dy = 0;
    if (this.cursors.left.isDown || this.wasd.left.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.wasd.right.isDown) dx += 1;
    if (this.cursors.up.isDown || this.wasd.up.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.wasd.down.isDown) dy += 1;

    this.oyuncu.hareket(dx, dy, delta, SEFER.harita.genislik, SEFER.harita.yukseklik);

    // Oyuncu öldü mü?
    if (this.oyuncu.olduMu()) { this.seferiBitir(false); return; }

    // Kameraayı oyuncuya kilitle
    const { width, height } = this.scale;
    this.kameraX = this.oyuncu.state.x - width / 2;
    this.kameraY = this.oyuncu.state.y - height / 2;

    // Dalga sistemi
    const talepler = this.spawnSystem.guncelle(SEFER.harita.genislik, SEFER.harita.yukseklik);
    for (const talep of talepler) {
      const musait = this.dusmanPool.find((e) => !e.aktif);
      musait?.baslat(talep.dusmanId, talep.x, talep.y);
    }

    // Düşman güncellemesi + saldırı
    for (const d of this.dusmanPool) {
      if (!d.aktif) continue;
      d.hedefeSal(this.oyuncu.state.x, this.oyuncu.state.y, delta);
      // Oyuncuya değdi mi?
      const dx2 = d.x - this.oyuncu.state.x;
      const dy2 = d.y - this.oyuncu.state.y;
      if (dx2 * dx2 + dy2 * dy2 < 30 * 30) {
        this.oyuncu.hasarAl(d.hasar * (delta / 1000));
      }
    }

    // Otomatik ateş
    const aktifDusmanlar = this.dusmanPool.filter((e) => e.aktif);
    const hedef = this.weaponSystem.hedefSec(
      this.oyuncu.state.x, this.oyuncu.state.y,
      aktifDusmanlar.map((e) => ({ x: e.x, y: e.y, id: e.id })),
    );
    if (hedef && this.weaponSystem.atesEdebilir(Date.now())) {
      const mermi = this.mermiPool.find((m) => !m.aktif);
      mermi?.baslat(this.oyuncu.state.x, this.oyuncu.state.y, hedef.x, hedef.y, hedef.id);
    }

    // Mermi güncellemesi
    for (const m of this.mermiPool) {
      if (!m.aktif) continue;
      m.guncelle(delta);
      // Sınır dışı mı?
      if (m.x < 0 || m.x > SEFER.harita.genislik || m.y < 0 || m.y > SEFER.harita.yukseklik) {
        m.aktif = false; continue;
      }
      // Hedefle çarpışma
      const hedefDusman = aktifDusmanlar.find((e) => e.id === m.hedefId);
      if (hedefDusman && m.carpisti(hedefDusman.x, hedefDusman.y)) {
        hedefDusman.hasarAl(m.hasar);
        m.aktif = false;
        if (!hedefDusman.aktif) {
          // Malzeme drop
          for (const drop of hedefDusman.dropHesapla()) {
            this.envanter.ekle(drop.tur, drop.miktar);
          }
        }
      }
    }

    // Kaynak toplama
    for (const k of this.kaynakPool) {
      if (!k.aktif) continue;
      const dkx = k.x - this.oyuncu.state.x;
      const dky = k.y - this.oyuncu.state.y;
      if (dkx * dkx + dky * dky < 40 * 40) {
        const miktar = k.hasat(delta);
        if (miktar > 0) {
          this.envanter.ekle(k.tur, miktar);
          this.bildirim(`+${miktar} ${k.tur}`, '#aaffaa');
        }
      }
    }

    // Çizim
    this.sahneciCiz();
    this.uiGuncelle();
  }

  // --- Çizim ---

  private sahneciCiz(): void {
    this.gfx.clear();
    const ox = this.kameraX;
    const oy = this.kameraY;

    // Arka plan (harita zemin)
    this.gfx.fillStyle(0x0d1a0d, 1);
    this.gfx.fillRect(0, 0, this.scale.width, this.scale.height);

    // Harita sınırı
    this.gfx.lineStyle(2, 0x334433, 1);
    this.gfx.strokeRect(-ox, -oy, SEFER.harita.genislik, SEFER.harita.yukseklik);

    // Kaynak düğümleri
    for (const k of this.kaynakPool) {
      if (!k.aktif) continue;
      const renk = { hurda: 0x888800, biyokutle: 0x228822, kristal: 0x2244aa }[k.tur] ?? 0x555555;
      this.gfx.fillStyle(renk, 1);
      this.gfx.fillCircle(k.x - ox, k.y - oy, 12);
    }

    // Düşmanlar
    for (const d of this.dusmanPool) {
      if (!d.aktif) continue;
      this.gfx.fillStyle(0xcc2222, 1);
      this.gfx.fillRect(d.x - ox - 10, d.y - oy - 10, 20, 20);
      // Can barı
      const canOrani = d.can / d.canMax;
      this.gfx.fillStyle(0x333333, 1);
      this.gfx.fillRect(d.x - ox - 12, d.y - oy - 18, 24, 4);
      this.gfx.fillStyle(0x44ff44, 1);
      this.gfx.fillRect(d.x - ox - 12, d.y - oy - 18, 24 * canOrani, 4);
    }

    // Mermiler
    for (const m of this.mermiPool) {
      if (!m.aktif) continue;
      this.gfx.fillStyle(0xffff00, 1);
      this.gfx.fillCircle(m.x - ox, m.y - oy, 4);
    }

    // Oyuncu
    this.gfx.fillStyle(0x44aaff, 1);
    this.gfx.fillCircle(this.oyuncu.state.x - ox, this.oyuncu.state.y - oy, 14);
    // Can barı
    const canOrani = this.oyuncu.state.can / this.oyuncu.state.canMax;
    this.gfx.fillStyle(0x333333, 1);
    this.gfx.fillRect(this.oyuncu.state.x - ox - 20, this.oyuncu.state.y - oy - 24, 40, 5);
    this.gfx.fillStyle(0x44ff44, 1);
    this.gfx.fillRect(this.oyuncu.state.x - ox - 20, this.oyuncu.state.y - oy - 24, 40 * canOrani, 5);
  }

  // --- UI ---

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
      this.scale.width / 2, 14,
      'DALGA 0',
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

  // --- Kaynak Dağıtımı ---

  private kaynakDugumleriniDagit(): void {
    const { genislik, yukseklik } = SEFER.harita;
    for (const k of this.kaynakPool) {
      const x = 100 + Math.random() * (genislik - 200);
      const y = 100 + Math.random() * (yukseklik - 200);
      k.baslat(x, y);
    }
  }

  // --- Sefer Sonu ---

  private async seferiBitir(basarili: boolean): Promise<void> {
    if (basarili) {
      // Toplanan malzemeleri kalıcı envantere ekle
      for (const tur of MALZEME_TURLERI) {
        const miktar = this.envanter.getMiktar(tur);
        if (miktar > 0) {
          this.durum.envanter[tur] = (this.durum.envanter[tur] ?? 0) + miktar;
        }
      }
      this.durum.toplamSefer++;
      await this.saveSystem.kaydet(this.durum);
      this.bildirim('Üsse döndün! Malzemeler kaydedildi.', '#44ff88');
    } else {
      this.bildirim('Öldün! Sefer malzemeleri kayboldu.', '#ff4444');
    }

    this.time.delayedCall(1500, () => {
      this.scene.start('UsScene');
    });
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
