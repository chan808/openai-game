import Phaser from 'phaser';

class SetupScene extends Phaser.Scene {
  create(): void {
    const marker = this.add.circle(480, 270, 40, 0x4f7cff);

    this.input.once('pointerdown', () => {
      marker.setFillStyle(0x4fd18b);
    });
    this.input.keyboard?.once('keydown-SPACE', () => {
      marker.setFillStyle(0xffcc4f);
    });
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 540,
  backgroundColor: '#10141f',
  scene: SetupScene,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});
