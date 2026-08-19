import Phaser from 'phaser';

import { ARENA_HEIGHT, ARENA_WIDTH } from './content/tuning';
import { ArenaScene } from './presentation/ArenaScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: ARENA_WIDTH,
  height: ARENA_HEIGHT,
  backgroundColor: '#090d16',
  scene: ArenaScene,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});
