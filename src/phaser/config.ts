import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';

export function createGameConfig(): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: 'game-container',
    backgroundColor: '#090d22',
    transparent: false,
    antialias: true,
    pixelArt: false,
    roundPixels: false,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: '100%',
      height: '100%'
    },
    render: {
      antialias: true,
      powerPreference: 'high-performance'
    },
    fps: {
      target: 60,
      forceSetTimeOut: false
    },
    scene: [GameScene]
  };
}
