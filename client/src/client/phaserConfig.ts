import Phaser from 'phaser';

const phaserConfig: Phaser.Types.Core.GameConfig = {
    type: Phaser.WEBGL,
    width: 1280,
    height: 720,
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 0 },
            debug: true // Set to true for visual debugging of physics bodies
        }
    },
    render: {
		autoMobilePipeline: true,
		antialias: true,
		pixelArt: false,
		roundPixels: false,
	},
    fps: {
        target: 60,
    },
    scene: []
};

export default phaserConfig; 