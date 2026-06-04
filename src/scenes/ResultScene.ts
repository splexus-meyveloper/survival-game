// Sonuç sahnesi — sefer bitti, malzeme özeti gösterilir
import Phaser from 'phaser';
import { MalzemeTuru } from '@/config/balance';

interface ResultData {
  basarili: boolean;
  toplananMalzeme: Partial<Record<MalzemeTuru, number>>;
  dalga: number;
}

export class ResultScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ResultScene' });
  }

  init(_data: ResultData): void { /* ileride doldurulacak */ }

  create(): void {
    const { width, height } = this.scale;
    this.add.text(width / 2, height / 2, 'SEFER SONUCU\n(Yakında)', {
      fontSize: '24px', color: '#ffffff', align: 'center',
    }).setOrigin(0.5);
  }
}
