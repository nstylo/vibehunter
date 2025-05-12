import Phaser from 'phaser';
import { DataManager } from '../systems/DataManager';

export default class BootScene extends Phaser.Scene {
    constructor() {
        super({key: 'BootScene'});
    }

    preload() {
        // Load all asset manifest files
        this.loadAssets();
        
        // Load all JSON definition files
        this.loadDefinitions();
    }

    create() {
        // Initialize the DataManager with the loaded JSON files
        this.initializeDataManager();
        
        // Start the game by switching to the main menu scene
        this.scene.start('GameScene');
    }

    /**
     * Load all game assets (images, sprites, audio, etc.)
     */
    private loadAssets() {
        // Load player character sprites
        for (let i = 1; i <= 20; i++) {
            this.load.image(`character_front_${i}`, `assets/characters/front/${i}.png`);
        }

        // Load enemy sprites
        for (let i = 1; i <= 36; i++) {
            this.load.image(`enemy_${i}`, `assets/enemies/${i}.png`);
        }

        // Preload static map assets
        this.load.image('mega-map', 'assets/map/mega-map.png');
        this.load.json('mapHitboxData', 'assets/map/map-hitboxes.json');
    }

    /**
     * Load all JSON definition files
     */
    private loadDefinitions() {
        // Load all game data definitions
        this.load.json('attackDefinitions', 'src/client/definitions/attacks.json');
        this.load.json('characterDefinitions', 'assets/characters/characters.json');
        this.load.json('enemyDefinitions', 'src/client/definitions/enemies.json');
        this.load.json('upgradeDefinitions', 'src/client/definitions/upgrades.json');
        this.load.json('projectileDefinitions', 'src/client/definitions/projectiles.json');
        this.load.json('statusEffectDefinitions', 'src/client/definitions/statusEffects.json');
        this.load.json('waveDefinitions', 'src/client/definitions/waves.json');
    }

    /**
     * Initialize the DataManager with the loaded JSON files
     */
    private initializeDataManager() {
        try {
            // Load the data from the Phaser cache into the DataManager
            const dataManager = DataManager.getInstance();
            dataManager.loadFromPhaserCache(this);
            console.log('DataManager initialized successfully.');
        } catch (error) {
            console.error('Failed to initialize DataManager:', error);
        }
    }
} 