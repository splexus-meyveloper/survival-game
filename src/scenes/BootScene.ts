// Boot sahnesi — assetler yüklenir, sonra MainMenu'ye geçilir
import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Placeholder: şimdilik asset yok, grafiker eklenince buraya gelir
    this.createLoadingBar();
  }

  create(): void {
    // GameRegistry üzerinden paylaşılan sistem nesneleri burada init edilir
    this.scene.start('MainMenuScene');
  }

  private createLoadingBar(): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    this.add.text(cx, cy - 40, 'Yükleniyor...', {
      fontSize: '20px',
      color: '#ffffff',
    }).setOrigin(0.5);

    const cerceve = this.add.rectangle(cx, cy, 300, 20, 0x333333);
    const bar = this.add.rectangle(cx - 150, cy, 0, 16, 0x44aaff).setOrigin(0, 0.5);

    this.load.on('progress', (value: number) => {
      bar.width = 300 * value;
    });

    void cerceve; // lint uyarısını önle
  }
}
