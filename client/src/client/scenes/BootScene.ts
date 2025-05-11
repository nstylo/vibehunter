import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        // Preload Character Sprites
        for (let i = 1; i <= 20; i++) {
            this.load.image(`character_front_${i}`, `assets/characters/front/${i}.png`);
        }

        // Preload Enemy Sprites
        for (let i = 1; i <= 36; i++) {
            this.load.image(`enemy_${i}`, `assets/enemies/${i}.png`);
        }

        // Preload static map assets
        this.load.image('mega-map', 'assets/map/mega-map.png');
        this.load.json('mapHitboxData', 'assets/map/map-hitboxes.json');
    }

    create() {
        this.scene.start('GameScene');
    }
} 