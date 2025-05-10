import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        // Nothing here
    }

    create() {
        this.scene.start('GameScene');
    }
} 