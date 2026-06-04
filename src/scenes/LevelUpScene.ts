// Seviye atlama sahnesi — ileride yetenek seçimi eklenecek (iskelet)
import Phaser from 'phaser';

export class LevelUpScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LevelUpScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.text(width / 2, height / 2, 'SEVİYE ATLAMA\n(Yakında)', {
      fontSize: '24px', color: '#ffdd44', align: 'center',
    }).setOrigin(0.5);
  }
}
