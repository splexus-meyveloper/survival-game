// Oyuncu entity'si — sefer sahnesinde kullanılır
import { SEFER } from '@/config/balance';

export interface PlayerState {
  x: number;
  y: number;
  can: number;
  canMax: number;
  hiz: number;
}

export class Player {
  state: PlayerState;

  constructor(x: number, y: number) {
    this.state = {
      x,
      y,
      can: SEFER.canMax,
      canMax: SEFER.canMax,
      hiz: SEFER.oyuncuHizi,
    };
  }

  /** Joystick/klavye girdisiyle hareket (delta: ms) */
  hareket(dx: number, dy: number, delta: number, sinirW: number, sinirH: number): void {
    const uzunluk = Math.sqrt(dx * dx + dy * dy);
    if (uzunluk === 0) return;
    const nx = dx / uzunluk;
    const ny = dy / uzunluk;
    this.state.x = Math.max(0, Math.min(sinirW, this.state.x + nx * this.state.hiz * (delta / 1000)));
    this.state.y = Math.max(0, Math.min(sinirH, this.state.y + ny * this.state.hiz * (delta / 1000)));
  }

  hasarAl(miktar: number): void {
    this.state.can = Math.max(0, this.state.can - miktar);
  }

  olduMu(): boolean { return this.state.can <= 0; }
}
