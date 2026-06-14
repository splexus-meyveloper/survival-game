// =====================================================================
// DENGE DOSYASI — Tüm sihirli sayılar burada. Kod içine gömme!
// =====================================================================

// --- Malzeme Türleri ---
export const MALZEME_TURLERI = ['hurda', 'biyokutle', 'kristal'] as const;
export type MalzemeTuru = (typeof MALZEME_TURLERI)[number];

// --- Bina Tanımları ---
export interface BinaTanimi {
  id: string;
  ad: string;
  maliyet: Partial<Record<MalzemeTuru, number>>;
  krediBedeli: number;         // para ile satın alma
  uretim: Partial<Record<MalzemeTuru, number>>; // saniye başına üretim
  maksKapasite: Partial<Record<MalzemeTuru, number>>; // maks depo
  yukselmeKatsayisi: number;   // her seviyede üretim çarpanı
  gridBoyutu: { w: number; h: number }; // izometrik grid kaplama
}

export const BINA_TANIMLARI: Record<string, BinaTanimi> = {
  hurda_toplama: {
    id: 'hurda_toplama',
    ad: 'Hurda Toplayıcı',
    maliyet: { hurda: 50 },
    krediBedeli: 200,
    uretim: { hurda: 0.5 },     // 0.5 hurda/sn
    maksKapasite: { hurda: 500 },
    yukselmeKatsayisi: 1.5,
    gridBoyutu: { w: 1, h: 1 },
  },
  biyokutle_ciftligi: {
    id: 'biyokutle_ciftligi',
    ad: 'Biyokütle Çiftliği',
    maliyet: { biyokutle: 40, hurda: 20 },
    krediBedeli: 300,
    uretim: { biyokutle: 0.3 },
    maksKapasite: { biyokutle: 400 },
    yukselmeKatsayisi: 1.5,
    gridBoyutu: { w: 2, h: 1 },
  },
  kristal_arastirma: {
    id: 'kristal_arastirma',
    ad: 'Kristal Araştırma',
    maliyet: { kristal: 10, hurda: 100 },
    krediBedeli: 800,
    uretim: { kristal: 0.05 },
    maksKapasite: { kristal: 100 },
    yukselmeKatsayisi: 1.8,
    gridBoyutu: { w: 2, h: 2 },
  },
  gelistirme_merkezi: {
    id: 'gelistirme_merkezi',
    ad: 'Geliştirme Merkezi',
    maliyet: { hurda: 150, kristal: 5 },
    krediBedeli: 600,
    uretim: {},
    maksKapasite: {},
    yukselmeKatsayisi: 2.0,
    gridBoyutu: { w: 2, h: 2 },
  },
};

// --- Eleman (Worker) ---
export const ELEMAN = {
  baseFiyat: 150,           // kredi
  fiyatArtisCarpani: 1.3,   // her alımda fiyat artar
  uretimArtisi: 0.25,       // eleman başına +%25 üretim
  maksEleman: 20,
};

// --- Ekonomi / Tüccar ---
export const EKONOMI = {
  // Taban fiyatlar (kredi / malzeme birimi)
  tabanFiyatlar: {
    hurda: 2,
    biyokutle: 3,
    kristal: 15,
  } as Record<MalzemeTuru, number>,
  // Pazar dalgalanma aralığı (±yüzde)
  dalgalanmaMin: 0.8,
  dalgalanmaMax: 1.3,
  // Fiyat güncelleme sıklığı (ms)
  fiyatGuncellemeSuresi: 60_000,
};

// --- Sefer ---
export const SEFER = {
  harita: { genislik: 2400, yukseklik: 2400 },
  oyuncuHizi: 200,           // piksel/sn
  otomatikSaldiriMenzili: 180,
  saldiriHizi: 1.2,          // saldırı/sn
  basarBasarHasari: 25,
  canMax: 100,

  // Kaynak düğümleri
  kaynakDugumu: {
    hasat_suresi: 2.0,       // sn
    miktar: { min: 5, max: 15 },
  },

  // Dalga sistemi
  dalga: {
    ilkDalgaSuresi: 10_000,  // ms
    dalgaAraliği: 20_000,
    dalgaBasinaEkDüşman: 2,
    baslangicDüşmanSayisi: 3,
  },
};

// --- Düşman İstatistikleri ---
export interface DusmanTanimi {
  id: string;
  ad: string;
  can: number;
  hiz: number;
  hasar: number;
  puan: number;
  malzemeDrop: Partial<Record<MalzemeTuru, { min: number; max: number }>>;
}

export const DUSMANLAR: Record<string, DusmanTanimi> = {
  temel: {
    id: 'temel',
    ad: 'Çöp Robotu',
    can: 40,
    hiz: 80,
    hasar: 8,
    puan: 10,
    malzemeDrop: { hurda: { min: 1, max: 4 } },
  },
  hizli: {
    id: 'hizli',
    ad: 'Hızlı Mutant',
    can: 20,
    hiz: 150,
    hasar: 5,
    puan: 15,
    malzemeDrop: { biyokutle: { min: 1, max: 3 } },
  },
  guclu: {
    id: 'guclu',
    ad: 'Zırhlı Dev',
    can: 150,
    hiz: 50,
    hasar: 20,
    puan: 30,
    malzemeDrop: {
      hurda: { min: 3, max: 8 },
      kristal: { min: 0, max: 2 },
    },
  },
};

// --- İzometrik Grid ---
export const ISO_GRID = {
  genislik: 20,   // yatay hücre sayısı
  yukseklik: 20,  // dikey hücre sayısı
  hucreW: 64,     // piksel (izometrik döşeme genişliği)
  hucreH: 32,     // piksel (izometrik döşeme yüksekliği)
};

// --- Offline Üretim ---
export const OFFLINE_URETIM = {
  maksCatchupSaniye: 8 * 3600, // max 8 saat aradan sonra üretim hesaplanır
};

// --- Karakter Yükseltme Sistemi ---

export interface YukseltmeTanimi {
  id: string;
  ad: string;
  icon: string;
  aciklama: string;         // (%XX/seviye gibi sabit metin)
  maksSeviyet: number;
  // Satın alma maliyeti (mevcut seviyeye göre — 0 = lv1'e geçiş maliyeti)
  maliyet: (mevcutSeviye: number) => { kredi: number; kristal: number };
  // Yeni seviyede değer (oyun içi kullanım)
  deger: (seviye: number) => number;
  // Tooltip için mevcut/sonraki değer metni
  degerMetni: (seviye: number) => string;
}

export const KARAKTER_YUKSELTMELERI: Record<string, YukseltmeTanimi> = {
  saldiri_hasari: {
    id: 'saldiri_hasari',
    ad: 'Saldırı Hasarı',
    icon: '⚔',
    aciklama: '+%30 mermi hasarı / seviye',
    maksSeviyet: 5,
    maliyet: (lv) => ({
      kredi:   Math.round(120 * Math.pow(2.2, lv)),
      kristal: lv >= 3 ? (lv - 2) * 4 : 0,
    }),
    deger:     (lv) => 25 * (1 + lv * 0.30),
    degerMetni: (lv) => `${Math.round(25 * (1 + lv * 0.30))} hasar`,
  },

  saldiri_hizi: {
    id: 'saldiri_hizi',
    ad: 'Saldırı Hızı',
    icon: '⚡',
    aciklama: '+%20 ateş hızı / seviye',
    maksSeviyet: 5,
    maliyet: (lv) => ({
      kredi:   Math.round(150 * Math.pow(2.3, lv)),
      kristal: lv >= 3 ? (lv - 2) * 3 : 0,
    }),
    deger:     (lv) => 1.2 * (1 + lv * 0.20),
    degerMetni: (lv) => `${(1.2 * (1 + lv * 0.20)).toFixed(2)} atış/sn`,
  },

  maksimum_can: {
    id: 'maksimum_can',
    ad: 'Maksimum Can',
    icon: '❤',
    aciklama: '+30 can / seviye',
    maksSeviyet: 6,
    maliyet: (lv) => ({
      kredi:   Math.round(80 * Math.pow(1.9, lv)),
      kristal: 0,
    }),
    deger:     (lv) => 100 + lv * 30,
    degerMetni: (lv) => `${100 + lv * 30} can`,
  },

  hareket_hizi: {
    id: 'hareket_hizi',
    ad: 'Hareket Hızı',
    icon: '👟',
    aciklama: '+%12 hız / seviye',
    maksSeviyet: 4,
    maliyet: (lv) => ({
      kredi:   Math.round(200 * Math.pow(2.5, lv)),
      kristal: lv * 2,
    }),
    deger:     (lv) => 200 * (1 + lv * 0.12),
    degerMetni: (lv) => `${Math.round(200 * (1 + lv * 0.12))} px/sn`,
  },

  kritik_sans: {
    id: 'kritik_sans',
    ad: 'Kritik Vuruş',
    icon: '💥',
    aciklama: '+%12 kritik şans / seviye (2× hasar)',
    maksSeviyet: 4,
    maliyet: (lv) => ({
      kredi:   Math.round(300 * Math.pow(2.4, lv)),
      kristal: (lv + 1) * 3,
    }),
    deger:     (lv) => lv * 0.12,
    degerMetni: (lv) => `%${Math.round(lv * 12)} kritik şans`,
  },

  menzil: {
    id: 'menzil',
    ad: 'Saldırı Menzili',
    icon: '🎯',
    aciklama: '+35px menzil / seviye',
    maksSeviyet: 4,
    maliyet: (lv) => ({
      kredi:   Math.round(130 * Math.pow(2.1, lv)),
      kristal: lv >= 2 ? (lv - 1) * 2 : 0,
    }),
    deger:     (lv) => 180 + lv * 35,
    degerMetni: (lv) => `${180 + lv * 35}px menzil`,
  },
};

// Geliştirme Merkezi olmadan erişilebilecek max yükseltme seviyesi
export const TEMEL_MAX_YUKSELTME = 3;

// --- Kayıt Versiyonu ---
export const KAYIT_VERSIYONU = 1;
