// İzometrik koordinat yardımcıları
import { ISO_GRID } from '@/config/balance';

export interface GridPos { col: number; row: number }
export interface ScreenPos { x: number; y: number }

/** Grid hücresi → ekran merkezi (kaydırma olmadan) */
export function gridToScreen(col: number, row: number): ScreenPos {
  const x = (col - row) * (ISO_GRID.hucreW / 2);
  const y = (col + row) * (ISO_GRID.hucreH / 2);
  return { x, y };
}

/** Ekran noktası → en yakın grid hücresi */
export function screenToGrid(sx: number, sy: number): GridPos {
  const col = Math.round(sx / ISO_GRID.hucreW + sy / ISO_GRID.hucreH);
  const row = Math.round(sy / ISO_GRID.hucreH - sx / ISO_GRID.hucreW);
  return { col, row };
}

/** Hücrenin geçerli sınırlar içinde olup olmadığını kontrol eder */
export function gecerliHucre(col: number, row: number): boolean {
  return col >= 0 && col < ISO_GRID.genislik && row >= 0 && row < ISO_GRID.yukseklik;
}

/** İzometrik derinlik sıralaması için Y değeri (painter's algorithm) */
export function derinlikSirasi(col: number, row: number): number {
  return col + row;
}

/** Tüm grid'in ekran boyutunu döndürür */
export function gridEkranBoyutu(): ScreenPos {
  const n = ISO_GRID.genislik;
  const m = ISO_GRID.yukseklik;
  return {
    x: (n + m) * (ISO_GRID.hucreW / 2),
    y: (n + m) * (ISO_GRID.hucreH / 2),
  };
}
