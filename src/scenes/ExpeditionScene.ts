// Birleşik oyun sahnesi — haritada üs bölgesi + sefer + karakter geliştirme
import Phaser from 'phaser';
import { SaveSystem, OyunDurumu, BinaKayit } from '@/systems/SaveSystem';
import { InventorySystem } from '@/systems/InventorySystem';
import { EconomySystem } from '@/systems/EconomySystem';
import { ProductionSystem } from '@/systems/ProductionSystem';
import { SpawnSystem } from '@/systems/SpawnSystem';
import { WeaponSystem } from '@/systems/WeaponSystem';
import { Player } from '@/entities/Player';
import { Enemy } from '@/entities/Enemy';
import { ResourceNode } from '@/entities/ResourceNode';
import { Projectile } from '@/entities/Projectile';
import {
  SEFER, MALZEME_TURLERI, MalzemeTuru,
  BINA_TANIMLARI, KARAKTER_YUKSELTMELERI, TEMEL_MAX_YUKSELTME,
} from '@/config/balance';

const POOL_DUSMANLAR = 40;
const POOL_MERMI     = 80;
const POOL_KAYNAK    = 22;

const ISO_CELL = 96;
const ISO_HW   = 48;
const ISO_HH   = 24;
const MAP_TILES = SEFER.harita.genislik / ISO_CELL;

// ── Üs bölgesi ────────────────────────────────────────────────────────────
const USS_X           = 500;
const USS_Y           = 500;
const USS_GUVENLI     = 240;  // düşmanlar bu mesafede durur
const USS_PANEL_R     = 200;  // panel açılma mesafesi
const USS_REJEN_R     = 160;  // biyokütle çiftliği yoğun rejen bölgesi

// ── Bina slotları (dünya koordinatı, üs çevresinde) ───────────────────────
const SLOTLAR = [
  { x: USS_X + 130, y: USS_Y - 10  },
  { x: USS_X + 95,  y: USS_Y + 115 },
  { x: USS_X - 10,  y: USS_Y + 145 },
  { x: USS_X - 130, y: USS_Y - 10  },
  { x: USS_X - 95,  y: USS_Y - 115 },
  { x: USS_X + 10,  y: USS_Y - 145 },
] as const;

// ── Renkler ───────────────────────────────────────────────────────────────
const BINA_RENKLER: Record<string, number> = {
  hurda_toplama:      0xaa8800,
  biyokutle_ciftligi: 0x228822,
  kristal_arastirma:  0x224488,
  gelistirme_merkezi: 0x882288,
};

function koyulastir(c: number, f: number): number {
  const r = Math.max(0, Math.floor(((c >> 16) & 0xff) * f));
  const g = Math.max(0, Math.floor(((c >>  8) & 0xff) * f));
  const b = Math.max(0, Math.floor( (c & 0xff)        * f));
  return (r << 16) | (g << 8) | b;
}

export class ExpeditionScene extends Phaser.Scene {
  // Sistemler
  private saveSystem!: SaveSystem;
  private uretim!: ProductionSystem;
  private spawnSystem!: SpawnSystem;
  private weaponSystem!: WeaponSystem;
  private envanter!: InventorySystem;
  private ekonomi!: EconomySystem;
  private durum!: OyunDurumu;

  // Varlıklar
  private oyuncu!: Player;
  private dusmanPool: Enemy[] = [];
  private mermiPool: Projectile[] = [];
  private kaynakPool: ResourceNode[] = [];

  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };
  private eKey!: Phaser.Input.Keyboard.Key;

  // Grafik
  private gfx!: Phaser.GameObjects.Graphics;
  private uiGfx!: Phaser.GameObjects.Graphics;
  private uiMetinler: Phaser.GameObjects.Text[] = [];
  private dalgaMetni!: Phaser.GameObjects.Text;
  private kritikMetni!: Phaser.GameObjects.Text;
  private kameraX = 0;
  private kameraY = 0;

  // Karakter istatistikleri (bina + yükseltme birleşik)
  private mermiHasarBase = SEFER.basarBasarHasari;
  private atisHizi = SEFER.saldiriHizi;
  private pasifRejenHizi = 0;
  private kritikSans = 0;
  private saldiriMenzili = SEFER.otomatikSaldiriMenzili;
  private gelistirmeKillBonus = 0;

  // Sefer sayaçları
  private seferOldurme = 0;
  private sonDalga = 0;
  private otomatikKaydetSayac = 0;

  // Üs paneli durumu
  private ussPanel: Phaser.GameObjects.Container | null = null;
  private aktifTab: 'insa' | 'gelistir' = 'insa';
  private inşaModu = false;
  private inşaBinaId: string | null = null;

  private hazir = false;

  constructor() { super({ key: 'ExpeditionScene' }); }

  async create(): Promise<void> {
    this.hazir        = false;
    this.uiMetinler   = [];
    this.dusmanPool   = [];
    this.mermiPool    = [];
    this.kaynakPool   = [];
    this.ussPanel     = null;
    this.inşaModu     = false;
    this.inşaBinaId   = null;
    this.seferOldurme = 0;
    this.sonDalga     = 0;
    this.otomatikKaydetSayac = 0;

    this.saveSystem = new SaveSystem();
    this.uretim     = new ProductionSystem();
    this.spawnSystem = new SpawnSystem();
    this.ekonomi    = new EconomySystem();
    this.envanter   = new InventorySystem();

    this.durum = await this.saveSystem.yukle();
    this.ekonomi.setKredi(this.durum.kredi);
    this.envanter.yukle(this.durum.envanter);

    // Offline üretim
    const kazanilan = this.uretim.offlineUretimiHesapla(
      this.durum.binalar, this.durum.sonGorulme, this.envanter,
    );

    // Tüm bonusları hesapla
    this.tumBonuslariHesapla();

    this.weaponSystem = new WeaponSystem(1000 / this.atisHizi);
    this.spawnSystem.baslat();

    for (let i = 0; i < POOL_DUSMANLAR; i++) this.dusmanPool.push(new Enemy(i));
    for (let i = 0; i < POOL_MERMI;     i++) this.mermiPool.push(new Projectile(i));
    for (let i = 0; i < POOL_KAYNAK;    i++) this.kaynakPool.push(new ResourceNode(i));

    // Oyuncu üssün yanında başlar
    this.oyuncu = new Player(USS_X + 60, USS_Y + 60);
    const gel   = this.durum.karakterGelisim ?? {};
    this.oyuncu.state.canMax = KARAKTER_YUKSELTMELERI.maksimum_can.deger(gel['maksimum_can'] ?? 0);
    this.oyuncu.state.can    = this.oyuncu.state.canMax;
    this.oyuncu.state.hiz    = KARAKTER_YUKSELTMELERI.hareket_hizi.deger(gel['hareket_hizi'] ?? 0);

    this.kaynakDagit();

    this.gfx   = this.add.graphics().setDepth(0);
    this.uiGfx = this.add.graphics().setDepth(100);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up:    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.eKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    // Harita tıklaması (slot seçimi için)
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.haritaTiklandi(p));

    this.uiOlustur();

    this.kritikMetni = this.add.text(0, 0, '', {
      fontSize: '18px', fontStyle: 'bold', color: '#ff4400',
      stroke: '#000000', strokeThickness: 3,
    }).setDepth(130).setVisible(false);

    // Ayarlar / menüye dön butonu
    this.add.text(this.scale.width - 6, 6, '⚙', {
      fontSize: '20px', color: '#aaaaaa', backgroundColor: '#00000088', padding: { x: 4, y: 2 },
    }).setOrigin(1, 0).setDepth(120).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.menuAc());

    // Offline bildirimi
    const offlineVar = MALZEME_TURLERI.some(t => kazanilan[t] > 0);
    if (offlineVar) {
      const satirlar = MALZEME_TURLERI
        .filter(t => kazanilan[t] > 0)
        .map(t => `${t}: +${Math.floor(kazanilan[t])}`);
      this.bildirim(`Offline üretim:\n${satirlar.join(', ')}`, '#aaffaa');
    }

    this.hazir = true;
  }

  update(_time: number, delta: number): void {
    if (!this.hazir) return;

    // ── Hareket ──────────────────────────────────────────────────────────
    let dx = 0, dy = 0;
    if (this.cursors.left.isDown  || this.wasd.left.isDown)  dx -= 1;
    if (this.cursors.right.isDown || this.wasd.right.isDown) dx += 1;
    if (this.cursors.up.isDown    || this.wasd.up.isDown)    dy -= 1;
    if (this.cursors.down.isDown  || this.wasd.down.isDown)  dy += 1;
    this.oyuncu.hareket(dx, dy, delta, SEFER.harita.genislik, SEFER.harita.yukseklik);

    if (this.oyuncu.olduMu()) { this.oldu(); return; }

    const px = this.oyuncu.state.x;
    const py = this.oyuncu.state.y;
    const dUss = Math.sqrt((px - USS_X) ** 2 + (py - USS_Y) ** 2);

    // ── Kamera ───────────────────────────────────────────────────────────
    const { width, height } = this.scale;
    this.kameraX = (px - py) / 2 - width  / 2;
    this.kameraY = (px + py) / 4 - height / 2;

    // ── Üs paneli: otomatik aç/kapat ─────────────────────────────────────
    if (dUss < USS_PANEL_R && this.ussPanel === null) {
      this.ussPanelAc();
    } else if (dUss >= USS_PANEL_R && this.ussPanel !== null) {
      this.ussPanelKapat();
    }

    // E tuşu → inşa modunu iptal et
    if (Phaser.Input.Keyboard.JustDown(this.eKey) && this.inşaModu) {
      this.inşaModu   = false;
      this.inşaBinaId = null;
      this.bildirim('İnşa iptal edildi', '#aaaaaa');
    }

    // ── Pasif üretim (binalar) ────────────────────────────────────────────
    this.uretim.guncelle(this.durum.binalar, this.envanter, delta);

    // ── Biyokütle çiftliği: can yenileme ─────────────────────────────────
    if (this.pasifRejenHizi > 0) {
      const rejenX = dUss < USS_REJEN_R ? 3.0 : 1.0;
      this.oyuncu.state.can = Math.min(
        this.oyuncu.state.canMax,
        this.oyuncu.state.can + this.pasifRejenHizi * rejenX * (delta / 1000),
      );
    }

    // ── Otomatik kaydet (30 sn) ───────────────────────────────────────────
    this.otomatikKaydetSayac += delta;
    if (this.otomatikKaydetSayac >= 30_000) {
      this.otomatikKaydetSayac = 0;
      this.kaydet();
    }

    // ── Dalga bonusu ──────────────────────────────────────────────────────
    const yeniDalga = this.spawnSystem.getDalga();
    if (yeniDalga > this.sonDalga && this.sonDalga > 0) {
      const bonus = yeniDalga * 15;
      this.ekonomi.setKredi(this.ekonomi.getKredi() + bonus);
      this.bildirim(`DALGA ${this.sonDalga} Bitti! +${bonus}₵`, '#ffdd44');
    }
    this.sonDalga = yeniDalga;

    // ── Spawn — üse 600px yakın doğurma ──────────────────────────────────
    const talepler = this.spawnSystem
      .guncelle(SEFER.harita.genislik, SEFER.harita.yukseklik)
      .filter(t => (t.x - USS_X) ** 2 + (t.y - USS_Y) ** 2 > 600 * 600);
    for (const t of talepler) {
      this.dusmanPool.find(e => !e.aktif)?.baslat(t.dusmanId, t.x, t.y);
    }

    // ── Düşmanlar ─────────────────────────────────────────────────────────
    const aktifDusmanlar = this.dusmanPool.filter(e => e.aktif);
    for (const d of aktifDusmanlar) {
      // Üs güvenli bölgesinde durur
      const distBase = Math.sqrt((d.x - USS_X) ** 2 + (d.y - USS_Y) ** 2);
      if (distBase > USS_GUVENLI) {
        d.hedefeSal(px, py, delta);
      }
      // Oyuncuya temas hasarı
      if ((d.x - px) ** 2 + (d.y - py) ** 2 < 32 * 32) {
        this.oyuncu.hasarAl(d.hasar * (delta / 1000));
      }
    }

    // ── Ateş ──────────────────────────────────────────────────────────────
    const hedef = this.weaponSystem.hedefSec(
      px, py,
      aktifDusmanlar.map(e => ({ x: e.x, y: e.y, id: e.id })),
      this.saldiriMenzili,
    );
    if (hedef && this.weaponSystem.atesEdebilir(Date.now())) {
      const m = this.mermiPool.find(mr => !mr.aktif);
      if (m) {
        m.baslat(px, py, hedef.x, hedef.y, hedef.id);
        const kritik = Math.random() < this.kritikSans;
        m.hasar = this.mermiHasarBase * (kritik ? 2.0 : 1.0);
        if (kritik) this.kritikFlash(px, py);
      }
    }

    // ── Mermiler ──────────────────────────────────────────────────────────
    for (const m of this.mermiPool) {
      if (!m.aktif) continue;
      m.guncelle(delta);
      if (m.x < 0 || m.x > SEFER.harita.genislik || m.y < 0 || m.y > SEFER.harita.yukseklik) {
        m.aktif = false; continue;
      }
      const hd = aktifDusmanlar.find(e => e.id === m.hedefId);
      if (hd && m.carpisti(hd.x, hd.y)) {
        hd.hasarAl(m.hasar);
        m.aktif = false;
        if (!hd.aktif) {
          const killKredi = Math.round(5 * (1 + this.gelistirmeKillBonus));
          this.ekonomi.setKredi(this.ekonomi.getKredi() + killKredi);
          this.seferOldurme++;
          for (const drop of hd.dropHesapla()) this.envanter.ekle(drop.tur, drop.miktar);
        }
      }
    }

    // ── Kaynaklar — üstünden geçince anında topla ─────────────────────────
    for (const k of this.kaynakPool) {
      if (!k.aktif) continue;
      if ((k.x - px) ** 2 + (k.y - py) ** 2 < 36 * 36) {
        this.envanter.ekle(k.tur, k.miktar);
        this.bildirim(`+${k.miktar} ${k.tur}`, '#aaffaa');
        k.aktif = false;
        // 20 saniye sonra aynı yerde yeniden doğ
        this.time.delayedCall(20_000, () => { if (!k.aktif) k.baslat(k.x, k.y); });
      }
    }

    this.sahneciCiz();
    this.uiGuncelle();
  }

  // ─── Bonus Hesaplama ────────────────────────────────────────────────────

  private tumBonuslariHesapla(): void {
    const gel = this.durum.karakterGelisim ?? {};

    this.mermiHasarBase  = KARAKTER_YUKSELTMELERI.saldiri_hasari.deger(gel['saldiri_hasari'] ?? 0);
    this.atisHizi        = KARAKTER_YUKSELTMELERI.saldiri_hizi.deger(gel['saldiri_hizi'] ?? 0);
    this.kritikSans      = KARAKTER_YUKSELTMELERI.kritik_sans.deger(gel['kritik_sans'] ?? 0);
    this.saldiriMenzili  = KARAKTER_YUKSELTMELERI.menzil.deger(gel['menzil'] ?? 0);
    this.pasifRejenHizi  = 0;
    this.gelistirmeKillBonus = 0;

    for (const b of this.durum.binalar) {
      if (b.id === 'kristal_arastirma')  this.mermiHasarBase  *= (1 + 0.20 * b.seviye);
      if (b.id === 'biyokutle_ciftligi') this.pasifRejenHizi  += 1.5  * b.seviye;
      if (b.id === 'gelistirme_merkezi') this.gelistirmeKillBonus += 0.05 * b.seviye;
    }
  }

  // ─── Üs Paneli ──────────────────────────────────────────────────────────

  private ussPanelAc(): void {
    this.aktifTab = 'insa';
    this.ussPanelCiz();
  }

  private ussPanelKapat(): void {
    if (this.ussPanel) { this.ussPanel.destroy(true); this.ussPanel = null; }
    this.inşaModu   = false;
    this.inşaBinaId = null;
  }

  private ussPanelYenile(): void {
    if (this.ussPanel) { this.ussPanel.destroy(true); this.ussPanel = null; }
    this.ussPanelCiz();
  }

  private ussPanelCiz(): void {
    const { width, height } = this.scale;
    const PH = 310; // panel yüksekliği
    const PY = height - PH;

    const con = this.add.container(0, PY).setDepth(200);

    // Arka plan
    const bg = this.add.graphics();
    bg.fillStyle(0x050d1a, 0.97);
    bg.lineStyle(1, this.aktifTab === 'insa' ? 0x2255aa : 0x5522aa, 1);
    bg.fillRect(0, 0, width, PH);
    bg.strokeRect(0, 0, width, PH);
    con.add(bg);

    // Başlık
    con.add(this.add.text(10, 8, '🏚 ÜS YÖNETİMİ', { fontSize: '12px', color: '#aaddff', fontStyle: 'bold' }));

    // Uzaklık ipucu
    const dUss = Math.sqrt((this.oyuncu.state.x - USS_X) ** 2 + (this.oyuncu.state.y - USS_Y) ** 2);
    const uzaklasBilgi = dUss < USS_PANEL_R - 20 ? '' : '  (ayrılırsan panel kapanır)';
    con.add(this.add.text(width - 10, 8, uzaklasBilgi, { fontSize: '10px', color: '#556677' }).setOrigin(1, 0));

    // Tab butonları
    const tablar: Array<{ id: 'insa' | 'gelistir'; etiket: string }> = [
      { id: 'insa',     etiket: '📦 Binalar' },
      { id: 'gelistir', etiket: '⚡ Geliştir' },
    ];
    tablar.forEach(({ id, etiket }, i) => {
      const tx = i * (width / 2);
      const aktif = this.aktifTab === id;
      const tgfx = this.add.graphics();
      tgfx.fillStyle(aktif ? 0x0d2040 : 0x030810, 1);
      tgfx.lineStyle(1, aktif ? 0x4488ff : 0x223344, 1);
      tgfx.fillRect(tx, 26, width / 2, 30);
      tgfx.strokeRect(tx, 26, width / 2, 30);
      con.add(tgfx);
      const tMetin = this.add.text(tx + width / 4, 41, etiket, {
        fontSize: '12px', color: aktif ? '#ffffff' : '#668899', fontStyle: aktif ? 'bold' : 'normal',
      }).setOrigin(0.5);
      con.add(tMetin);
      const tAlan = this.add.rectangle(tx + width / 4, 41, width / 2, 30).setInteractive({ useHandCursor: true });
      con.add(tAlan);
      tAlan.on('pointerdown', () => {
        if (this.aktifTab !== id) { this.aktifTab = id; this.ussPanelYenile(); }
      });
    });

    // İçerik alanı (Y=56'dan başlar)
    if (this.aktifTab === 'insa') {
      this.insaTabiCiz(con, 58, width, PH - 58);
    } else {
      this.gelistirTabiCiz(con, 58, width, PH - 58);
    }

    this.ussPanel = con;
  }

  // ── İnşa Tabı ─────────────────────────────────────────────────────────

  private insaTabiCiz(con: Phaser.GameObjects.Container, startY: number, w: number, _maxH: number): void {
    const binaIdler = Object.keys(BINA_TANIMLARI);
    const mevcutBinalar = this.durum.binalar;
    const slotDolu = new Set(mevcutBinalar.map(b => b.col));
    const bosSlot  = SLOTLAR.findIndex((_, i) => !slotDolu.has(i));

    let cy = startY + 4;
    const satirH = 54;

    for (const binaId of binaIdler) {
      const tanim = BINA_TANIMLARI[binaId];
      const mevcutBina = mevcutBinalar.find(b => b.id === binaId);

      // Satır arka plan
      const sbg = this.add.graphics();
      sbg.fillStyle(mevcutBina ? 0x0d2040 : 0x080f1a, 0.9);
      sbg.fillRoundedRect(6, cy, w - 12, satirH - 4, 4);
      con.add(sbg);

      // Renk çizgisi
      const renkBar = this.add.graphics();
      renkBar.fillStyle(BINA_RENKLER[binaId] ?? 0x555555, 1);
      renkBar.fillRect(6, cy, 4, satirH - 4);
      con.add(renkBar);

      // Bina adı + seviye
      const seviyeMetni = mevcutBina ? `  Sv${mevcutBina.seviye}` : '';
      con.add(this.add.text(18, cy + 5, `${tanim.ad}${seviyeMetni}`, {
        fontSize: '11px', fontStyle: 'bold', color: mevcutBina ? '#ffffff' : '#778899',
      }));

      // Etki metni
      con.add(this.add.text(18, cy + 22, this.binaEtkiMetni(binaId, mevcutBina?.seviye ?? 0), {
        fontSize: '10px', color: '#88aacc',
      }));

      // Buton
      const btnW = 90;
      const btnX = w - btnW - 10;
      const btnY = cy + 8;

      if (mevcutBina) {
        // Yükselt butonu
        const maliyet = Math.round(tanim.krediBedeli * Math.pow(1.8, mevcutBina.seviye));
        const karsilanabilir = this.ekonomi.getKredi() >= maliyet;
        this.panelButon(con, btnX, btnY, btnW, 34,
          `Yükselt\n${maliyet}₵`,
          karsilanabilir ? 0x1a4030 : 0x1a1a2a,
          karsilanabilir ? '#44ffaa' : '#446655',
          karsilanabilir ? () => this.binaYukselt(mevcutBina.col) : null,
        );
      } else {
        // İnşa Et butonu
        const karsilanabilir = this.ekonomi.getKredi() >= tanim.krediBedeli && bosSlot >= 0;
        this.panelButon(con, btnX, btnY, btnW, 34,
          `İnşa Et\n${tanim.krediBedeli}₵`,
          karsilanabilir ? 0x1a3060 : 0x1a1a2a,
          karsilanabilir ? '#44aaff' : '#446688',
          karsilanabilir ? () => this.insaModuBaslat(binaId) : null,
        );
      }

      cy += satirH;
    }

    // Slot seçimi aktifse ipucu
    if (this.inşaModu) {
      con.add(this.add.text(w / 2, cy + 4,
        `⬆ Haritada parlayan slota tıkla  [E] iptal`,
        { fontSize: '11px', color: '#ffdd44', align: 'center' },
      ).setOrigin(0.5, 0));
    }
  }

  // ── Geliştir Tabı ─────────────────────────────────────────────────────

  private gelistirTabiCiz(con: Phaser.GameObjects.Container, startY: number, w: number, _maxH: number): void {
    const hasGelistirme = this.durum.binalar.some(b => b.id === 'gelistirme_merkezi');
    const gel = this.durum.karakterGelisim ?? {};
    const yukseltmeler = Object.values(KARAKTER_YUKSELTMELERI);
    const satirH = 46;
    let cy = startY + 2;

    // 2 sütun düzeni (sol ve sağ)
    yukseltmeler.forEach((yuk, i) => {
      const col   = i % 2;
      const satir = Math.floor(i / 2);
      const x     = col * (w / 2) + 6;
      const y     = cy + satir * satirH;
      const half  = w / 2 - 12;
      const mevcutSeviye = gel[yuk.id] ?? 0;
      const maksErisim = hasGelistirme ? yuk.maksSeviyet : Math.min(yuk.maksSeviyet, TEMEL_MAX_YUKSELTME);
      const maks = mevcutSeviye >= yuk.maksSeviyet;
      const kilitli = !maks && mevcutSeviye >= maksErisim;

      const sbg = this.add.graphics();
      sbg.fillStyle(mevcutSeviye > 0 ? 0x0d1840 : 0x080f1a, 0.9);
      sbg.fillRoundedRect(x, y, half, satirH - 4, 4);
      con.add(sbg);

      // İkon + isim + seviye
      con.add(this.add.text(x + 6, y + 4,
        `${yuk.icon} ${yuk.ad}  ${mevcutSeviye > 0 ? `Sv${mevcutSeviye}` : ''}`,
        { fontSize: '10px', color: maks ? '#44ffaa' : '#aaaaff', fontStyle: 'bold' },
      ));

      // Mevcut değer
      con.add(this.add.text(x + 6, y + 18,
        mevcutSeviye > 0 ? yuk.degerMetni(mevcutSeviye) : '—',
        { fontSize: '9px', color: '#778899' },
      ));

      if (maks) {
        con.add(this.add.text(x + half - 6, y + 13, '✓MAX', { fontSize: '9px', color: '#44ffaa' }).setOrigin(1, 0.5));
      } else if (kilitli) {
        con.add(this.add.text(x + half - 6, y + 13, '🔒', { fontSize: '10px', color: '#ff6644' }).setOrigin(1, 0.5));
      } else {
        const maliyet = yuk.maliyet(mevcutSeviye);
        const karsilanabilir = this.ekonomi.getKredi() >= maliyet.kredi &&
                               this.envanter.getMiktar('kristal') >= maliyet.kristal;
        const maliyetMetni = `${maliyet.kredi}₵${maliyet.kristal > 0 ? ` 💎${maliyet.kristal}` : ''}`;
        const btnH = 20;
        this.panelButon(con, x + half - 68, y + satirH - btnH - 6, 66, btnH,
          maliyetMetni,
          karsilanabilir ? 0x1a1a60 : 0x111122,
          karsilanabilir ? '#8888ff' : '#334466',
          karsilanabilir ? () => this.yukseltmeYap(yuk.id) : null,
        );
      }
    });

    if (!hasGelistirme) {
      const infoY = cy + Math.ceil(yukseltmeler.length / 2) * satirH + 4;
      con.add(this.add.text(w / 2, infoY,
        '⚠ Geliştirme Merkezi inşa et → Sv4-5 açılır',
        { fontSize: '10px', color: '#ff8844', align: 'center' },
      ).setOrigin(0.5, 0));
    }
  }

  // ── Bina işlemleri ─────────────────────────────────────────────────────

  private insaModuBaslat(binaId: string): void {
    this.inşaModu   = true;
    this.inşaBinaId = binaId;
    this.bildirim(`Haritada bir slot seç  [E] iptal`, '#ffdd44');
    this.ussPanelYenile();
  }

  private haritaTiklandi(pointer: Phaser.Input.Pointer): void {
    if (!this.inşaModu || !this.inşaBinaId) return;

    const mevcutSlotlar = new Set(this.durum.binalar.map(b => b.col));
    for (let si = 0; si < SLOTLAR.length; si++) {
      if (mevcutSlotlar.has(si)) continue;
      const { sx, sy } = this.wToS(SLOTLAR[si].x, SLOTLAR[si].y);
      const dx = pointer.x - sx, dy = pointer.y - (sy - 20);
      if (dx * dx + dy * dy < 40 * 40) {
        this.binaInsa(this.inşaBinaId, si);
        return;
      }
    }
  }

  private binaInsa(binaId: string, slotIdx: number): void {
    const tanim = BINA_TANIMLARI[binaId];
    if (!tanim) return;
    if (!this.ekonomi.harca(tanim.krediBedeli)) {
      this.bildirim('Yetersiz kredi!', '#ff4444'); return;
    }
    const yeni: BinaKayit = { id: binaId, seviye: 1, col: slotIdx, row: 0, atanenElemanlar: 0 };
    this.durum.binalar.push(yeni);
    this.tumBonuslariHesapla();
    this.kaydet();
    this.inşaModu   = false;
    this.inşaBinaId = null;
    this.bildirim(`${tanim.ad} inşa edildi!`, '#44ff88');
    this.ussPanelYenile();
  }

  private binaYukselt(slotIdx: number): void {
    const bina = this.durum.binalar.find(b => b.col === slotIdx);
    if (!bina) return;
    const tanim  = BINA_TANIMLARI[bina.id];
    const maliyet = Math.round(tanim.krediBedeli * Math.pow(1.8, bina.seviye));
    if (!this.ekonomi.harca(maliyet)) {
      this.bildirim(`Yetersiz kredi! (${maliyet}₵)`, '#ff4444'); return;
    }
    bina.seviye++;
    this.tumBonuslariHesapla();
    this.kaydet();
    this.bildirim(`${tanim.ad} Sv${bina.seviye} oldu!`, '#44ffaa');
    this.ussPanelYenile();
  }

  private yukseltmeYap(yukseltmeId: string): void {
    const tanim = KARAKTER_YUKSELTMELERI[yukseltmeId];
    if (!tanim) return;
    if (!this.durum.karakterGelisim) this.durum.karakterGelisim = {};
    const mevcutSeviye = this.durum.karakterGelisim[yukseltmeId] ?? 0;
    if (mevcutSeviye >= tanim.maksSeviyet) return;

    const maliyet = tanim.maliyet(mevcutSeviye);
    if (!this.ekonomi.harca(maliyet.kredi)) { this.bildirim('Yetersiz kredi!', '#ff4444'); return; }
    if (maliyet.kristal > 0 && !this.envanter.cikar('kristal', maliyet.kristal)) {
      this.ekonomi.setKredi(this.ekonomi.getKredi() + maliyet.kredi);
      this.bildirim('Yetersiz kristal!', '#ff4444'); return;
    }

    this.durum.karakterGelisim[yukseltmeId] = mevcutSeviye + 1;
    const yeniSeviye = mevcutSeviye + 1;

    // Oyuncu statlarını anında güncelle
    if (yukseltmeId === 'maksimum_can') {
      const yeniMax = KARAKTER_YUKSELTMELERI.maksimum_can.deger(yeniSeviye);
      const fark    = yeniMax - this.oyuncu.state.canMax;
      this.oyuncu.state.canMax = yeniMax;
      this.oyuncu.state.can   += fark;
    }
    if (yukseltmeId === 'hareket_hizi') {
      this.oyuncu.state.hiz = KARAKTER_YUKSELTMELERI.hareket_hizi.deger(yeniSeviye);
    }
    if (yukseltmeId === 'saldiri_hizi') {
      this.atisHizi = KARAKTER_YUKSELTMELERI.saldiri_hizi.deger(yeniSeviye);
      this.weaponSystem.setAtisSuresi(1000 / this.atisHizi);
    }

    this.tumBonuslariHesapla();
    this.kaydet();
    this.bildirim(`${tanim.icon} ${tanim.ad} Sv${yeniSeviye}! (${tanim.degerMetni(yeniSeviye)})`, '#cc88ff');
    this.ussPanelYenile();
  }

  // ─── Çizim ─────────────────────────────────────────────────────────────

  private sahneciCiz(): void {
    this.gfx.clear();
    const { width, height } = this.scale;
    const ox = this.kameraX, oy = this.kameraY;

    // ── Zemin tile'ları ──
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

        // Üs bölgesindeyse farklı renk
        const wx = col * ISO_CELL;
        const wy = row * ISO_CELL;
        const distUss = Math.sqrt((wx - USS_X) ** 2 + (wy - USS_Y) ** 2);
        const renk = distUss < USS_GUVENLI ? this.ussTileRengi(col, row) : this.tileRengi(col, row);

        this.gfx.fillStyle(renk, 1);
        this.gfx.lineStyle(1, distUss < USS_GUVENLI ? 0x1a3a2a : 0x090f08, 0.7);
        this.gfx.beginPath();
        this.gfx.moveTo(sx,          sy - ISO_HH);
        this.gfx.lineTo(sx + ISO_HW, sy);
        this.gfx.lineTo(sx,          sy + ISO_HH);
        this.gfx.lineTo(sx - ISO_HW, sy);
        this.gfx.closePath();
        this.gfx.fillPath();
        this.gfx.strokePath();
      }
    }

    // ── Varlıklar (painter's algorithm) ──
    type RItem = { depth: number; draw: () => void };
    const items: RItem[] = [];

    // Üs binası
    { const { sx, sy } = this.wToS(USS_X, USS_Y); items.push({ depth: USS_X + USS_Y - 1, draw: () => this.ussBinasiCiz(sx, sy) }); }

    // Bina slotları
    for (let si = 0; si < SLOTLAR.length; si++) {
      const slot = SLOTLAR[si];
      const bina = this.durum.binalar.find(b => b.col === si);
      const { sx, sy } = this.wToS(slot.x, slot.y);
      if (bina) {
        const renk = BINA_RENKLER[bina.id] ?? 0x555555;
        const yuk  = 18 + bina.seviye * 6;
        items.push({ depth: slot.x + slot.y, draw: () => this.isoCutu(sx, sy, 18, 10, yuk, renk) });
      } else {
        // Boş slot göstergesi
        items.push({ depth: slot.x + slot.y, draw: () => {
          const parlak = this.inşaModu;
          this.gfx.lineStyle(1, parlak ? 0x88ddff : 0x334455, parlak ? 0.8 : 0.4);
          this.gfx.fillStyle(parlak ? 0x112233 : 0x0a1520, parlak ? 0.5 : 0.3);
          this.gfx.beginPath();
          this.gfx.moveTo(sx, sy - 10); this.gfx.lineTo(sx + 18, sy);
          this.gfx.lineTo(sx, sy + 10); this.gfx.lineTo(sx - 18, sy);
          this.gfx.closePath(); this.gfx.fillPath(); this.gfx.strokePath();
        }});
      }
    }

    // Kaynak düğümleri
    for (const k of this.kaynakPool) {
      if (!k.aktif) continue;
      const { sx, sy } = this.wToS(k.x, k.y);
      const renkMap: Record<string, number> = { hurda: 0x998800, biyokutle: 0x228833, kristal: 0x3366cc };
      const renk = renkMap[k.tur] ?? 0x666666;
      items.push({ depth: k.x + k.y, draw: () => {
        this.isoCutu(sx, sy, 13, 9, 14, renk);
      }});
    }

    // Düşmanlar
    for (const d of this.dusmanPool) {
      if (!d.aktif) continue;
      const { sx, sy } = this.wToS(d.x, d.y);
      const cr = d.can / d.canMax;
      items.push({ depth: d.x + d.y, draw: () => {
        this.isoCutu(sx, sy, 14, 10, 22, 0xcc2222);
        this.gfx.fillStyle(0x1a1a1a, 1); this.gfx.fillRect(sx - 14, sy - 38, 28, 4);
        this.gfx.fillStyle(cr > 0.4 ? 0x44ff44 : 0xff4444, 1); this.gfx.fillRect(sx - 14, sy - 38, 28 * cr, 4);
      }});
    }

    // Oyuncu
    { const { sx, sy } = this.wToS(this.oyuncu.state.x, this.oyuncu.state.y);
      const cr = this.oyuncu.state.can / this.oyuncu.state.canMax;
      items.push({ depth: this.oyuncu.state.x + this.oyuncu.state.y, draw: () => {
        this.isoCutu(sx, sy, 16, 12, 28, 0x3399ff);
        this.gfx.fillStyle(0x1a1a1a, 1); this.gfx.fillRect(sx - 20, sy - 48, 40, 5);
        this.gfx.fillStyle(cr > 0.4 ? 0x44ff44 : 0xff4444, 1); this.gfx.fillRect(sx - 20, sy - 48, 40 * cr, 5);
      }});
    }

    items.sort((a, b) => a.depth - b.depth);
    for (const it of items) it.draw();

    // Mermiler
    this.gfx.fillStyle(0xffee44, 1);
    for (const m of this.mermiPool) {
      if (!m.aktif) continue;
      const { sx, sy } = this.wToS(m.x, m.y);
      this.gfx.fillCircle(sx, sy - 12, 4);
    }

    // Saldırı menzili (oyuncu etrafı, ince)
    { const { sx, sy } = this.wToS(this.oyuncu.state.x, this.oyuncu.state.y);
      this.gfx.lineStyle(1, 0x3399ff, 0.10);
      this.gfx.strokeCircle(sx, sy - 12, this.saldiriMenzili * 0.5); }
  }

  private ussBinasiCiz(sx: number, sy: number): void {
    const hw = 38, hh = 20, h = 50, renk = 0x1a3a88;
    this.gfx.fillStyle(koyulastir(renk, 0.55), 1);
    this.gfx.beginPath(); this.gfx.moveTo(sx - hw, sy - h); this.gfx.lineTo(sx, sy + hh - h); this.gfx.lineTo(sx, sy + hh); this.gfx.lineTo(sx - hw, sy); this.gfx.closePath(); this.gfx.fillPath();
    this.gfx.fillStyle(koyulastir(renk, 0.72), 1);
    this.gfx.beginPath(); this.gfx.moveTo(sx + hw, sy - h); this.gfx.lineTo(sx, sy + hh - h); this.gfx.lineTo(sx, sy + hh); this.gfx.lineTo(sx + hw, sy); this.gfx.closePath(); this.gfx.fillPath();
    this.gfx.fillStyle(renk, 1);
    this.gfx.beginPath(); this.gfx.moveTo(sx, sy - hh - h); this.gfx.lineTo(sx + hw, sy - h); this.gfx.lineTo(sx, sy + hh - h); this.gfx.lineTo(sx - hw, sy - h); this.gfx.closePath(); this.gfx.fillPath();
    // Bayrak direği
    this.gfx.lineStyle(2, 0xaaaaaa, 0.9);
    this.gfx.lineBetween(sx, sy - hh - h, sx, sy - hh - h - 20);
    this.gfx.fillStyle(0xff4444, 1);
    this.gfx.fillTriangle(sx, sy - hh - h - 20, sx + 12, sy - hh - h - 14, sx, sy - hh - h - 8);
  }

  private wToS(wx: number, wy: number): { sx: number; sy: number } {
    return { sx: (wx - wy) / 2 - this.kameraX, sy: (wx + wy) / 4 - this.kameraY };
  }

  private isoCutu(sx: number, sy: number, hw: number, hh: number, h: number, renk: number): void {
    this.gfx.fillStyle(koyulastir(renk, 0.62), 1);
    this.gfx.beginPath(); this.gfx.moveTo(sx - hw, sy - h); this.gfx.lineTo(sx, sy + hh - h); this.gfx.lineTo(sx, sy + hh); this.gfx.lineTo(sx - hw, sy); this.gfx.closePath(); this.gfx.fillPath();
    this.gfx.fillStyle(koyulastir(renk, 0.78), 1);
    this.gfx.beginPath(); this.gfx.moveTo(sx + hw, sy - h); this.gfx.lineTo(sx, sy + hh - h); this.gfx.lineTo(sx, sy + hh); this.gfx.lineTo(sx + hw, sy); this.gfx.closePath(); this.gfx.fillPath();
    this.gfx.fillStyle(renk, 1);
    this.gfx.beginPath(); this.gfx.moveTo(sx, sy - hh - h); this.gfx.lineTo(sx + hw, sy - h); this.gfx.lineTo(sx, sy + hh - h); this.gfx.lineTo(sx - hw, sy - h); this.gfx.closePath(); this.gfx.fillPath();
  }

  private tileRengi(col: number, row: number): number {
    const t = [0x131c10, 0x172514, 0x152312, 0x192916, 0x111d0f, 0x1a2a16];
    return t[(col * 3 + row * 5 + Math.floor(col * row * 0.7)) % t.length];
  }

  private ussTileRengi(col: number, row: number): number {
    const t = [0x0e2018, 0x0d221a, 0x0f241c, 0x0c1f17, 0x112618, 0x0d2319];
    return t[(col * 3 + row * 5 + Math.floor(col * row * 0.7)) % t.length];
  }

  // ─── UI ────────────────────────────────────────────────────────────────

  private uiOlustur(): void {
    this.uiGfx.fillStyle(0x000000, 0.6);
    this.uiGfx.fillRoundedRect(6, 6, 200, 160, 6);

    for (let i = 0; i < 7; i++) {
      this.uiMetinler.push(
        this.add.text(12, 12 + i * 21, '', { fontSize: '12px', color: '#aaddff' }).setDepth(110),
      );
    }

    this.dalgaMetni = this.add.text(
      this.scale.width / 2, 12, 'DALGA 0',
      { fontSize: '15px', fontStyle: 'bold', color: '#ff6644' },
    ).setOrigin(0.5, 0).setDepth(110);
  }

  private uiGuncelle(): void {
    if (this.uiMetinler.length < 7) return;
    const gel = this.durum.karakterGelisim ?? {};
    this.uiMetinler[0].setText(`❤ ${Math.ceil(this.oyuncu.state.can)}/${this.oyuncu.state.canMax}`);
    this.uiMetinler[1].setText(`💰 ${this.ekonomi.getKredi()}₵`);
    this.uiMetinler[2].setText(`🔩 ${Math.floor(this.envanter.getMiktar('hurda'))}`);
    this.uiMetinler[3].setText(`🌿 ${Math.floor(this.envanter.getMiktar('biyokutle'))}`);
    this.uiMetinler[4].setText(`💎 ${Math.floor(this.envanter.getMiktar('kristal'))}`);
    this.uiMetinler[5].setText(`☠ ${this.seferOldurme}  ⚔ ${Math.round(this.mermiHasarBase)}`);
    this.uiMetinler[6].setText(
      this.inşaModu ? '📍 Slot seç (haritaya tıkla)' :
      (Math.sqrt((this.oyuncu.state.x - USS_X) ** 2 + (this.oyuncu.state.y - USS_Y) ** 2) < USS_PANEL_R
        ? '🏚 Üs bölgesinde' : ``)
    );
    this.dalgaMetni.setText(`DALGA ${this.spawnSystem.getDalga()}`);
  }

  // ─── Yardımcılar ───────────────────────────────────────────────────────

  private panelButon(
    con: Phaser.GameObjects.Container,
    x: number, y: number, w: number, h: number,
    metin: string,
    renk: number,
    metinRenk: string,
    tikla: (() => void) | null,
  ): void {
    const gfx = this.add.graphics();
    gfx.fillStyle(renk, 1);
    gfx.fillRoundedRect(x, y, w, h, 3);
    con.add(gfx);
    con.add(this.add.text(x + w / 2, y + h / 2, metin, {
      fontSize: '10px', color: metinRenk, align: 'center',
    }).setOrigin(0.5));
    if (tikla) {
      const alan = this.add.rectangle(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
      con.add(alan);
      alan.on('pointerover', () => { gfx.clear(); gfx.fillStyle(Math.min(0xffffff, renk + 0x111111), 1); gfx.fillRoundedRect(x, y, w, h, 3); });
      alan.on('pointerout',  () => { gfx.clear(); gfx.fillStyle(renk, 1); gfx.fillRoundedRect(x, y, w, h, 3); });
      alan.on('pointerdown', () => tikla());
    }
  }

  private binaEtkiMetni(binaId: string, seviye: number): string {
    const sv = seviye > 0 ? `(Sv${seviye}) ` : '';
    const uretimBazlari: Record<string, string> = {
      hurda_toplama:      `${sv}Pasif: +${(0.5 * Math.pow(1.5, Math.max(0, seviye - 1))).toFixed(2)} hurda/sn`,
      biyokutle_ciftligi: `${sv}Can: +${(1.5 * seviye).toFixed(1)}/sn  (×3 üs bölgesinde)`,
      kristal_arastirma:  `${sv}Hasar: +%${20 * seviye}  Pasif: +${(0.05 * Math.pow(1.8, Math.max(0, seviye - 1))).toFixed(3)} kristal/sn`,
      gelistirme_merkezi: `${sv}Geliştirme açık  Öldürme: +%${5 * seviye} kredi`,
    };
    return uretimBazlari[binaId] ?? `${sv}Bilinmeyen efekt`;
  }

  private kaynakDagit(): void {
    const { genislik, yukseklik } = SEFER.harita;
    for (const k of this.kaynakPool) {
      let kx: number, ky: number;
      do {
        kx = 80 + Math.random() * (genislik - 160);
        ky = 80 + Math.random() * (yukseklik - 160);
      } while ((kx - USS_X) ** 2 + (ky - USS_Y) ** 2 < 320 * 320);
      k.baslat(kx, ky);
    }
  }

  private kritikFlash(wx: number, wy: number): void {
    const { sx, sy } = this.wToS(wx, wy);
    this.kritikMetni.setText('KRİTİK!').setPosition(sx - 20, sy - 60).setVisible(true).setAlpha(1);
    this.tweens.add({ targets: this.kritikMetni, y: sy - 95, alpha: 0, duration: 700,
      onComplete: () => this.kritikMetni.setVisible(false) });
  }

  private oldu(): void {
    this.hazir = false;
    this.ussPanelKapat();
    this.bildirim('Öldün! Otomatik kaydedildi.', '#ff4444');
    window.setTimeout(() => { this.kaydet(); this.scene.restart(); }, 2000);
  }

  private menuAc(): void {
    this.kaydet();
    this.scene.start('MainMenuScene');
  }

  private kaydet(): void {
    this.durum.kredi      = this.ekonomi.getKredi();
    this.durum.envanter   = this.envanter.snapshot();
    this.durum.toplamOldurme = (this.durum.toplamOldurme ?? 0) + this.seferOldurme;
    this.seferOldurme = 0;
    void this.saveSystem.kaydet(this.durum);
  }

  private bildirim(mesaj: string, renk = '#ffffff'): void {
    const { width, height } = this.scale;
    const basePanel = this.ussPanel ? 320 : 60;
    const t = this.add.text(width / 2, height - basePanel, mesaj, {
      fontSize: '13px', color: renk, backgroundColor: '#00000099', padding: { x: 10, y: 6 }, align: 'center',
    }).setOrigin(0.5).setDepth(210);
    this.time.delayedCall(2500, () => t.destroy());
  }
}
