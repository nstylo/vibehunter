import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        // Nothing here
        this.load.image('character_front_1', 'assets/characters/front/1.png');
        this.load.image('character_front_10', 'assets/characters/front/10.png');
        this.load.image('character_front_11', 'assets/characters/front/11.png');
        this.load.image('character_front_12', 'assets/characters/front/12.png');
        this.load.image('character_front_13', 'assets/characters/front/13.png');
        this.load.image('character_front_14', 'assets/characters/front/14.png');
        this.load.image('character_front_15', 'assets/characters/front/15.png');
        this.load.image('character_front_16', 'assets/characters/front/16.png');
        this.load.image('character_front_17', 'assets/characters/front/17.png');
        this.load.image('character_front_18', 'assets/characters/front/18.png');
        this.load.image('character_front_19', 'assets/characters/front/19.png');
        this.load.image('character_front_2', 'assets/characters/front/2.png');
        this.load.image('character_front_20', 'assets/characters/front/20.png');
        this.load.image('character_front_3', 'assets/characters/front/3.png');
        this.load.image('character_front_4', 'assets/characters/front/4.png');
        this.load.image('character_front_5', 'assets/characters/front/5.png');
        this.load.image('character_front_6', 'assets/characters/front/6.png');
        this.load.image('character_front_7', 'assets/characters/front/7.png');
        this.load.image('character_front_8', 'assets/characters/front/8.png');
        this.load.image('character_front_9', 'assets/characters/front/9.png');
    }

    create() {
        this.scene.start('GameScene');
    }
} 