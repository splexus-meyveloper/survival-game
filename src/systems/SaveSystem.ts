// Kayıt sistemi — soyut arayüz + localStorage implementasyonu.
// İleride Spring backend'e geçmek için sadece StorageAdapter'ı değiştir.
import { KAYIT_VERSIYONU, MalzemeTuru } from '@/config/balance';

// --- Veri modeli ---

export interface BinaKayit {
  id: string;         // bina tipi id'si (balance.ts'teki BINA_TANIMLARI key)
  seviye: number;
  col: number;
  row: number;
  atanenElemanlar: number;
}

export interface OyunDurumu {
  versiyon: number;
  sonGorulme: number;           // Date.now() — offline üretim için
  kredi: number;
  envanter: Record<MalzemeTuru, number>;
  binalar: BinaKayit[];
  toplamEleman: number;
  toplamKazanilanKredi: number; // istatistik
  toplamSefer: number;
  toplamOldurme: number;        // tüm seferlerdeki toplam öldürme
  karakterGelisim: Record<string, number>; // yukseltmeId -> mevcut seviye
}

// --- Soyut adapter arayüzü ---
interface StorageAdapter {
  kaydet(durum: OyunDurumu): Promise<void>;
  yukle(): Promise<OyunDurumu | null>;
  sil(): Promise<void>;
}

// --- LocalStorage implementasyonu ---
const KAYIT_ANAHTARI = 'survival_save_v1';

class LocalStorageAdapter implements StorageAdapter {
  async kaydet(durum: OyunDurumu): Promise<void> {
    localStorage.setItem(KAYIT_ANAHTARI, JSON.stringify(durum));
  }

  async yukle(): Promise<OyunDurumu | null> {
    const veri = localStorage.getItem(KAYIT_ANAHTARI);
    if (!veri) return null;
    try {
      const durum = JSON.parse(veri) as OyunDurumu;
      // Versiyon uyumsuzluğunda kayıt sıfırlanır
      if (durum.versiyon !== KAYIT_VERSIYONU) return null;
      return durum;
    } catch {
      return null;
    }
  }

  async sil(): Promise<void> {
    localStorage.removeItem(KAYIT_ANAHTARI);
  }
}

// --- SaveSystem ---
export class SaveSystem {
  private adapter: StorageAdapter;

  constructor(adapter: StorageAdapter = new LocalStorageAdapter()) {
    this.adapter = adapter;
  }

  /** Oyun durumunu kaydet */
  async kaydet(durum: OyunDurumu): Promise<void> {
    await this.adapter.kaydet({ ...durum, sonGorulme: Date.now() });
  }

  /** Kayıtlı durumu yükle; yoksa varsayılan döner */
  async yukle(): Promise<OyunDurumu> {
    const kayit = await this.adapter.yukle();
    if (kayit) return kayit;
    return this.varsayilanDurum();
  }

  async sil(): Promise<void> {
    await this.adapter.sil();
  }

  private varsayilanDurum(): OyunDurumu {
    return {
      versiyon: KAYIT_VERSIYONU,
      sonGorulme: Date.now(),
      kredi: 500,
      envanter: { hurda: 100, biyokutle: 50, kristal: 0 },
      binalar: [],
      toplamEleman: 0,
      toplamKazanilanKredi: 0,
      toplamSefer: 0,
      toplamOldurme: 0,
      karakterGelisim: {},
    };
  }
}
