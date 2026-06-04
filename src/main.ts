// Oyun giriş noktası — Phaser 4 konfigürasyonu
import Phaser from 'phaser';
import { BootScene } from '@/scenes/BootScene';
import { MainMenuScene } from '@/scenes/MainMenuScene';
import { UsScene } from '@/scenes/UsScene';
import { ExpeditionScene } from '@/scenes/ExpeditionScene';
import { MarketScene } from '@/scenes/MarketScene';
import { LevelUpScene } from '@/scenes/LevelUpScene';
import { ResultScene } from '@/scenes/ResultScene';

// Mobil uyumlu boyut: sabit 480×854 (9:16), canvas otomatik ölçeklenir
const OYUN_GENISLIK = 480;
const OYUN_YUKSEKLIK = 854;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: OYUN_GENISLIK,
  height: OYUN_YUKSEKLIK,
  backgroundColor: '#0a0a0f',
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [
    BootScene,
    MainMenuScene,
    UsScene,
    ExpeditionScene,
    MarketScene,
    LevelUpScene,
    ResultScene,
  ],
};

const game = new Phaser.Game(config);
// Geliştirme/test için global erişim
(window as unknown as Record<string, unknown>).__GAME__ = game;
