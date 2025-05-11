import Phaser from 'phaser';
import { PlayerSprite } from '../objects/PlayerSprite'; // Changed to named import
import { EnemySprite } from '../objects/EnemySprite'; // Import EnemySprite
import ProjectileSprite, { ProjectileType } from '../objects/ProjectileSprite'; // Import ProjectileSprite and its enum
import { XpOrb } from '../objects/XpOrb'; // Import the new XpOrb class
import type { EntitySprite } from '../objects/EntitySprite'; // Changed to type-only import
import { EnemySpawner, type WaveDefinition } from '../systems/EnemySpawner'; // Updated import
import NetworkSystem from '../systems/NetworkSystem';
import {
    EVENT_ENTITY_SHOOT_PROJECTILE,
    EVENT_PROJECTILE_SPAWNED,
    EVENT_ENTITY_TAKE_DAMAGE,
    EVENT_PROJECTILE_HIT_ENTITY,
    EVENT_ENTITY_DIED
} from '../../common/events';
import { ProgressionSystem } from '../systems/ProgressionSystem'; // Import ProgressionSystem
import { ParticleSystem } from '../systems/ParticleSystem'; // Added import
import { type RemotePlayerData, type ServerMessage, isPlayerPositionsMessage } from '../types/multiplayer'; // Import multiplayer types
import WAVE_DEFINITIONS from '../definitions/waves.json'; // Import WAVE_DEFINITIONS
import GAME_ENEMY_DEFINITIONS from '../definitions/enemies.json'; // Import game enemy definitions
import { HitboxCollisionManager } from '../world/HitboxCollisionManager'; // ADDED

// Define the type for data passed from LobbyScene
interface GameSceneData {
    playerId: string;
    initialPosition: { x: number; y: number };
    worldSeed?: number;
    isMultiplayer?: boolean;
    serverUrl?: string;
    // ... any other data from initialServerData
}

// Define Wave Configurations
// const WAVE_DEFINITIONS: WaveDefinition[] = [
//     {
//         waveNumber: 1,
//         waveStartMessage: "Wave 1: Slime Time!",
//         enemyGroups: [
//             { enemyType: 'slime', count: 10, spawnInterval: 1000, isRanged: false },
//         ],
//         timeToNextWave: 5000 // 5 seconds after wave clear
//     },
//     {
//         waveNumber: 2,
//         waveStartMessage: "Wave 2: Goblins Approach!",
//         enemyGroups: [
//             { enemyType: 'slime', count: 10, spawnInterval: 1500, isRanged: false, spawnDelay: 0 },
//             { enemyType: 'goblin', count: 5, spawnInterval: 500, isRanged: true, spawnDelay: 1000 },
//         ],
//         timeToNextWave: 5000
//     },
//     {
//         waveNumber: 3,
//         waveStartMessage: "Wave 3: The Horde!",
//         enemyGroups: [
//             { enemyType: 'slime', count: 20, spawnInterval: 800, isRanged: false },
//             { enemyType: 'goblin', count: 10, spawnInterval: 1200, isRanged: true, spawnDelay: 2000 },
//         ],
//         // No timeToNextWave means this is the last wave in this definition set
//     }
// ];

export class GameScene extends Phaser.Scene {
    player: PlayerSprite | undefined;
    cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
    private enemies!: Phaser.Physics.Arcade.Group; // Enemy group
    private projectiles!: Phaser.Physics.Arcade.Group; // Projectile group
    private xpOrbs!: Phaser.Physics.Arcade.Group; // Group for XP orbs
    private enemySpawner!: EnemySpawner; // Added EnemySpawner property
    private progressionSystem!: ProgressionSystem; // Add progressionSystem property
    private particleSystem!: ParticleSystem; // Added particle system member

    // Camera zoom properties
    private currentZoom = 1;
    private targetZoom = 1;
    private minZoom = 0.5;
    private maxZoom = 2;
    private zoomFactor = 0.1;
    private zoomDuration = 50; // Duration of zoom animation in ms
    private currentZoomTween: Phaser.Tweens.Tween | null = null;
    private keyZoomIn!: Phaser.Input.Keyboard.Key;
    private keyZoomOut!: Phaser.Input.Keyboard.Key;

    // Network related members
    private networkSystem: NetworkSystem | null = null;
    private isMultiplayer = false;
    private serverUrl = 'ws://127.0.0.1:8080';
    private remotePlayers: Map<string, PlayerSprite> = new Map();

    public static readonly CELL_WIDTH = 64;
    public static readonly CELL_HEIGHT = 64;

    private hitboxCollisionManager!: HitboxCollisionManager; // ADDED
    private buildings!: Phaser.Physics.Arcade.StaticGroup; // ADDED for static building colliders

    private cursorHideTimer?: Phaser.Time.TimerEvent;
    private readonly CURSOR_HIDE_DELAY = 200; // Time in ms to hide cursor after no movement

    constructor() {
        super({ key: 'GameScene' });
    }

    init(data: GameSceneData) {
        // Set up multiplayer mode if specified
        this.isMultiplayer = data.isMultiplayer ?? false;
        if (data.serverUrl) {
            this.serverUrl = data.serverUrl;
        }
    }

    preload() {
        // Preload enemy textures based on definitions
        for (const enemyDef of GAME_ENEMY_DEFINITIONS) {
            if (enemyDef.assetUrl && !this.textures.exists(enemyDef.assetUrl)) {
                // enemyDef.assetUrl is now the ID string (e.g., "1")
                // This ID string will also be the texture key
                const textureKey = enemyDef.assetUrl;
                const filePath = `assets/enemies/${enemyDef.assetUrl}.png`; // e.g., assets/enemies/1.png
                this.load.image(textureKey, filePath);
            } else if (!enemyDef.assetUrl) {
                console.warn(`Enemy definition for '${enemyDef.name}' is missing assetUrl.`);
            }
        }
    }

    create(data: GameSceneData) {
        // ADDED: Display the static map
        this.add.image(0, 0, 'mega-map').setOrigin(0, 0).setDepth(-20); // Ensure it's behind everything

        // ADDED: Get map dimensions from JSON (or hardcode if known fixed)
        const mapHitboxData = this.cache.json.get('mapHitboxData');
        const mapWidth = mapHitboxData?.mapWidth ?? 10000; // Default to 10000 if not in JSON
        const mapHeight = mapHitboxData?.mapHeight ?? 10000;

        // Create the dynamic XP orb texture
        this.createXpOrbTexture();

        // Instantiate ParticleSystem early
        this.particleSystem = new ParticleSystem(this); // Instantiated ParticleSystem

        this.physics.world.setBounds(0, 0, mapWidth, mapHeight); // Use new map dimensions

        this.cameras.main.setBackgroundColor('#222222');

        // Set up network system if in multiplayer mode
        if (this.isMultiplayer) {
            this.setupNetworkSystem();
        }

        // Initialize player BEFORE setting up collision
        const playerX = data.initialPosition?.x ?? mapWidth / 2;
        const playerY = data.initialPosition?.y ?? mapHeight / 2;
        this.player = new PlayerSprite(this, playerX, playerY, data.playerId ?? 'localPlayer', this.particleSystem);

        // Configure player network mode if multiplayer
        if (this.isMultiplayer && this.networkSystem && this.player) {
            this.player.setNetworkMode(this.networkSystem, false);
        }

        // Initialize enemies group
        this.enemies = this.physics.add.group({
            classType: EnemySprite, // Optional: For type safety if creating directly from group
            runChildUpdate: true // Automatically calls update on children (our EnemySprite instances)
        });

        // Initialize projectiles group
        this.projectiles = this.physics.add.group({
            classType: ProjectileSprite,
            runChildUpdate: true // ProjectileSprite's preUpdate handles lifespan
        });

        // Initialize XP Orbs group
        this.xpOrbs = this.physics.add.group({
            classType: XpOrb, // Use the XpOrb class
            runChildUpdate: true // Ensure XpOrb's preUpdate is called
        });

        // ADDED: Initialize HitboxCollisionManager and create building colliders
        if (mapHitboxData?.objects) {
            this.hitboxCollisionManager = new HitboxCollisionManager(mapHitboxData.objects);
            this.buildings = this.physics.add.staticGroup();
            for (const obj of this.hitboxCollisionManager.getAllObjects()) {
                if (obj.category === 'building') {
                    // Create a static physics body for each building
                    // Adjust origin if necessary, but x,y from JSON are usually top-left
                    const buildingCollider = this.buildings.create(obj.x + obj.width / 2, obj.y + obj.height / 2, undefined);
                    buildingCollider.setSize(obj.width, obj.height);
                    buildingCollider.setVisible(false); // The building is already part of the visual map
                    buildingCollider.refreshBody();
                }
            }
        } else {
            console.error("GameScene: Map hitbox data not found or invalid. Cannot create collision manager or buildings.");
            // Fallback or error state if map data is missing
            this.hitboxCollisionManager = new HitboxCollisionManager([]); // Init with empty if no data
            this.buildings = this.physics.add.staticGroup();
        }

        // Setup Enemy Spawner
        if (this.player) {
            this.enemySpawner = new EnemySpawner(this, this.player, this.enemies, WAVE_DEFINITIONS, this.particleSystem); // Pass particleSystem
            // this.enemySpawner.startWaveSystem(1); // Start with wave 1 - MOVED

            // Initialize ProgressionSystem after player is created
            this.progressionSystem = new ProgressionSystem(this, this.player);
        }

        // ADDED: New collision with static buildings
        if (this.player) {
            this.physics.add.collider(this.player, this.buildings);
        }
        this.physics.add.collider(this.enemies, this.buildings);

        // Collision between player and enemies
        if (this.player) {
            this.physics.add.overlap(this.projectiles, this.enemies, this.handleProjectileHitEnemy as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
            this.physics.add.overlap(this.projectiles, this.player, this.handleProjectileHitPlayer as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
            // Add collision for player and XP orbs
            this.physics.add.overlap(this.player, this.xpOrbs, this.handlePlayerCollectXpOrb as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
        }

        // Collision between enemies themselves (to prevent clumping)
        this.physics.add.collider(this.enemies, this.enemies, this.handleEnemyCollideEnemy as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);

        if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
            
            // Add zoom key bindings
            this.keyZoomIn = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.PLUS);
            this.keyZoomOut = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.MINUS);
        }

        this.cameras.main.startFollow(this.player, true, 1, 1);
        this.cameras.main.setBounds(0, 0, mapWidth, mapHeight); // Use new map dimensions
        this.cameras.main.roundPixels = true; // For smoother, pixel-perfect camera movement
        
        // Set initial zoom
        this.cameras.main.setZoom(this.currentZoom);

        // Setup mousewheel zoom
        this.input.on('wheel', (pointer: Phaser.Input.Pointer, gameObjects: Phaser.GameObjects.GameObject[], deltaX: number, deltaY: number, deltaZ: number) => {
            if (deltaY > 0) {
                this.zoomOut();
            } else if (deltaY < 0) {
                this.zoomIn();
            }
        });

        // Launch the HUD Scene
        this.scene.launch('HudScene');
        this.scene.bringToTop('HudScene');

        // Listen for HUD ready event before starting wave system
        this.game.events.once('hudReady', () => {
            if (this.enemySpawner) {
                this.enemySpawner.startWaveSystem(1); // Start with wave 1 NOW
            }
        });

        // Set initial HUD values
        if (this.player) {
            this.game.events.emit('updateHud', {
                hp: this.player.currentStats.hp,
                maxHp: this.player.currentStats.maxHp,
                currentXp: 0,
                nextLevelXp: 100
            });
        }

        // Hide the cursor initially
        this.game.canvas.style.cursor = 'none';
        // Listen for mouse movement to show and then hide cursor
        this.input.on('pointermove', this.handleMouseMoveForCursor, this);

        // Connect progression system events to HUD
        this.events.on('xpUpdated', (data: { currentXP: number, currentLevel: number, xpToNextLevel: number }) => {
            this.game.events.emit('updateHud', {
                currentXp: data.currentXP,
                nextLevelXp: data.xpToNextLevel,
                level: data.currentLevel // Ensure level is passed to HUD
            });
        });

        this.events.on('playerLevelUp', (data: { newLevel: number }) => {
            // This is handled by ProgressionSystem opening the upgrade UI
            // We could add a visual effect here if desired
            // Ensure HUD is updated with the new level if not already covered by xpUpdated
             this.game.events.emit('updateHud', { level: data.newLevel });
        });

        // Event Listeners
        this.events.on(EVENT_ENTITY_SHOOT_PROJECTILE, this.handleEntityShoot, this);
        this.events.on(EVENT_ENTITY_DIED, (payload: { entity: EntitySprite, killer?: EntitySprite | ProjectileSprite | string }) => {
            if (payload.entity instanceof EnemySprite && this.enemySpawner) {
                this.enemySpawner.notifyEnemyDefeated(payload.entity as EnemySprite);
                if (payload.killer instanceof ProjectileSprite &&
                    this.player &&
                    payload.killer.ownerId === this.player.entityId) {
                    // Use currentStats or baseStats for xpValue, with a fallback
                    const xpAmount = (payload.entity as EnemySprite).currentStats.xpValue ?? (payload.entity as EnemySprite).baseStats.xpValue ?? 10;
                    // Instead of emitting 'enemyKilled' for XP, spawn orbs
                    this.spawnXpOrbs(payload.entity.x, payload.entity.y, xpAmount);
                    // We might still want an 'enemyKilled' event for other purposes (e.g. quests, stats)
                    // For now, focusing on XP orb change.
                    // this.events.emit('enemyKilled', { amount: xpAmount, enemy: payload.entity });
                }
            } else if (payload.entity instanceof PlayerSprite && payload.entity === this.player) {
                const wavesSurvived = this.enemySpawner ? this.enemySpawner.getCurrentWaveNumber() - 1 : 0; 
                this.scene.stop('HudScene'); 
                this.scene.stop(this.scene.key); 
                this.scene.start('GameOverScene', { wavesSurvived: wavesSurvived });
            }
        });

        this.events.on(EVENT_ENTITY_TAKE_DAMAGE, (payload: { target: EntitySprite, damage: number, newHp: number, source?: EntitySprite | ProjectileSprite | string }) => {
            if (payload.target instanceof PlayerSprite && this.player === payload.target) {
                this.game.events.emit('updateHud', {
                    hp: payload.newHp,
                    maxHp: this.player.currentStats.maxHp
                });
            }
        });
        this.events.on(EVENT_PROJECTILE_SPAWNED, (payload: { projectile: ProjectileSprite, ownerId: string }) => {
        });

        // Listen for XP orb collection to pass XP to ProgressionSystem
        this.events.on('xpOrbCollected', (data: { amount: number }) => {
            if (this.progressionSystem) {
                this.progressionSystem.addXp(data.amount);
            }
        });

        // Listen to EnemySpawner events for logging (and later UI)
        this.events.on('waveStart', (data: { waveNumber: number, totalEnemies: number }) => {
            // Emit a global event for the HUD
            this.game.events.emit('updateWaveHud', {
                waveNumber: data.waveNumber,
                enemiesRemaining: data.totalEnemies, // Initially, all enemies are remaining
                totalEnemiesInWave: data.totalEnemies
            });
            // Emit the new event specifically for the wave started message
            this.game.events.emit('newWaveStartedHud', { waveNumber: data.waveNumber });
        });
        this.events.on('enemyDefeatedInWave', (data: { waveNumber: number, enemiesRemaining: number, totalSpawnedThisWave: number, totalToSpawnThisWave: number }) => {
            // Emit a global event for the HUD
            this.game.events.emit('updateWaveHud', {
                waveNumber: data.waveNumber,
                enemiesRemaining: data.enemiesRemaining,
                totalEnemiesInWave: data.totalToSpawnThisWave
            });
        });
        this.events.on('waveClear', (data: { waveNumber: number }) => {
            // We no longer need to show upgrades on wave clear
            // as progression is now XP-based
            // Just update the HUD
            this.game.events.emit('waveClearHud', data);
        });
        this.events.on('allWavesCleared', () => {
            // Optionally, tell HUD all waves are cleared
            this.game.events.emit('allWavesClearedHud');
        });
    }

    private handleEntityShoot(payload: {
        shooter: EntitySprite,
        projectileType: string,
        direction: Phaser.Math.Vector2,
        targetPosition?: Phaser.Math.Vector2
    }): void {
        const { shooter, projectileType, direction } = payload; 

        const pType: ProjectileType = ProjectileType[projectileType as keyof typeof ProjectileType] || ProjectileType.BULLET;

        let spawnOffsetMagnitude: number;
        let projectileScale: number | undefined = undefined;

        if (shooter instanceof PlayerSprite) {
            spawnOffsetMagnitude = 37;
            projectileScale = shooter.getProjectileScale();
        } else if (shooter instanceof EnemySprite) {
            const sWidth = typeof shooter.width === 'number' && Number.isFinite(shooter.width) ? shooter.width : 32;
            const sHeight = typeof shooter.height === 'number' && Number.isFinite(shooter.height) ? shooter.height : 32;
            spawnOffsetMagnitude = (Math.max(sWidth, sHeight) / 2) + 10;
        } else {
            const sWidth = typeof shooter.width === 'number' && Number.isFinite(shooter.width) ? shooter.width : 32;
            const sHeight = typeof shooter.height === 'number' && Number.isFinite(shooter.height) ? shooter.height : 32;
            spawnOffsetMagnitude = (Math.max(sWidth, sHeight) / 2) + 10;
        }

        // Use shooter's currentStats for projectile properties, with fallbacks from EntitySprite defaults if needed
        const damage = shooter.currentStats.projectileDamage ?? 10;
        const speed = shooter.currentStats.projectileSpeed ?? 300;

        const projectile = new ProjectileSprite(
            this,
            shooter.x + direction.x * spawnOffsetMagnitude,
            shooter.y + direction.y * spawnOffsetMagnitude, 
            pType,
            shooter.entityId,
            damage, 
            speed,  
            shooter.projectileLifespan, 
            projectileScale, 
            this.particleSystem 
        );

        this.projectiles.add(projectile);
        if (projectile.body instanceof Phaser.Physics.Arcade.Body) {
            projectile.body.setVelocity(direction.x * projectile.speed, direction.y * projectile.speed);
        }

        this.events.emit(EVENT_PROJECTILE_SPAWNED, { projectile, ownerId: shooter.entityId });
    }

    private handleProjectileHitEnemy(obj1: Phaser.Types.Physics.Arcade.GameObjectWithBody, obj2: Phaser.Types.Physics.Arcade.GameObjectWithBody): void {
        const projectile = obj1 as ProjectileSprite;
        const enemy = obj2 as EnemySprite;

        if (!projectile.active || !enemy.active || !projectile.ownerId) return;
        if (this.player && projectile.ownerId === this.player.entityId) {
            this.events.emit(EVENT_PROJECTILE_HIT_ENTITY, { projectile, target: enemy });
            enemy.takeDamage(projectile.damageAmount, projectile);
            projectile.impact();
        }
    }

    private handleProjectileHitPlayer(obj1: Phaser.Types.Physics.Arcade.GameObjectWithBody, obj2: Phaser.Types.Physics.Arcade.GameObjectWithBody): void {
        let projectile: ProjectileSprite | undefined;
        let player: PlayerSprite | undefined;

        if (obj1 instanceof ProjectileSprite && obj2 instanceof PlayerSprite) {
            projectile = obj1;
            player = obj2;
        } else if (obj2 instanceof ProjectileSprite && obj1 instanceof PlayerSprite) {
            projectile = obj2;
            player = obj1;
        } else {
            // Not a collision between a projectile and a player we are interested in
            return;
        }

        if (!projectile || !player || !projectile.active || !player.active || !projectile.ownerId) return;
        if (projectile.ownerId === player.entityId) return; // Player can't shoot self

        // If projectile owner is one of the enemies, it can damage player
        let isEnemyProjectile = false;
        for (const enemyChild of this.enemies.getChildren()) {
            const enemyEntity = enemyChild as EntitySprite; // Cast to access entityId
            if (enemyEntity.entityId === projectile.ownerId) {
                isEnemyProjectile = true;
                break;
            }
        }

        if (isEnemyProjectile) {
            this.events.emit(EVENT_PROJECTILE_HIT_ENTITY, { projectile, target: player });
            player.takeDamage(projectile.damageAmount, projectile);
            projectile.impact();
        }
    }

    private handlePlayerCollectXpOrb(
        playerObject: Phaser.Types.Physics.Arcade.GameObjectWithBody,
        orbObject: Phaser.Types.Physics.Arcade.GameObjectWithBody
    ): void {
        const player = playerObject as PlayerSprite; 
        const orb = orbObject as XpOrb; // Cast to XpOrb

        if (!orb.active || !orb.body || !this.player) return; // Orb already collected, no body, or player missing

        const xpValue = orb.xpValue; // Access directly from XpOrb property

        if (typeof xpValue === 'number' && xpValue > 0) { // Only process if there is XP to gain
            this.events.emit('xpOrbCollected', { amount: xpValue });

            // Display floating XP text
            this.showFloatingText(`+${xpValue} XP`, this.player.x, this.player.y - this.player.displayHeight / 2, '#FFD700'); // Gold color for XP

            if (this.particleSystem) {
                // this.particleSystem.playXpOrbCollect(orb.x, orb.y); // TODO: Implement in ParticleSystem
            }
            orb.destroy();
        } else {
            if (xpValue === 0) {
                // Silently destroy 0-value orbs if they somehow get created and collected
                orb.destroy();
            } else {
                console.warn('XP Orb collected without xpValue data or invalid data.');
                orb.destroy(); // Still remove it
            }
        }
    }

    private showFloatingText(text: string, x: number, y: number, color: string, fontSize = '16px'): void {
        const randomXOffset = Phaser.Math.Between(-15, 15);
        const textObject = this.add.text(x + randomXOffset, y, text, {
            fontFamily: 'Arial', // Using a pixel-art friendly font if available
            fontSize: fontSize,
            color: color,
            stroke: '#000000',
            strokeThickness: 3
        });
        textObject.setOrigin(0.5, 1); // Origin at bottom-center for upward float
        textObject.setDepth(1000); // Ensure it's above other game elements

        this.tweens.add({
            targets: textObject,
            y: y - 50, // Float upwards by 50 pixels
            alpha: 0,  // Fade out
            duration: 1200, // Duration of 1.2 seconds
            ease: 'Power1',
            onComplete: () => {
                textObject.destroy();
            }
        });
    }

    private zoomIn(): void {
        if (this.targetZoom < this.maxZoom) {
            this.targetZoom = Math.min(this.maxZoom, this.targetZoom + this.zoomFactor);
            this.smoothZoom(this.targetZoom);
        }
    }

    private zoomOut(): void {
        if (this.targetZoom > this.minZoom) {
            this.targetZoom = Math.max(this.minZoom, this.targetZoom - this.zoomFactor);
            this.smoothZoom(this.targetZoom);
        }
    }

    private smoothZoom(targetZoom: number): void {
        // Stop any existing zoom tween
        if (this.currentZoomTween) {
            this.currentZoomTween.stop();
        }

        // Create a new tween to smoothly transition to the target zoom
        this.currentZoomTween = this.tweens.add({
            targets: this.cameras.main,
            zoom: targetZoom,
            duration: this.zoomDuration,
            ease: 'Sine.easeInOut',
            onUpdate: () => {
                this.currentZoom = this.cameras.main.zoom;
            },
            onComplete: () => {
                this.currentZoom = targetZoom;
                this.currentZoomTween = null;
            }
        });
    }

    update(time: number, delta: number) {
        if (!this.player || !this.cursors || !this.player.body) {
            return;
        }

        // Handle keyboard zoom controls
        if (Phaser.Input.Keyboard.JustDown(this.keyZoomIn)) {
            this.zoomIn();
        } else if (Phaser.Input.Keyboard.JustDown(this.keyZoomOut)) {
            this.zoomOut();
        }

        // Update player movement - just handles input and movement
        this.player.updateMovement(this.cursors);

        // Give the player the current list of enemies for auto-targeting
        if (this.enemies) {
            this.player.updateEnemiesInRange(this.enemies.getChildren());
        }

        // Update enemy spawner
        if (this.enemySpawner) {
            this.enemySpawner.update(time, delta);
        }

        // Y-sorting for player
        if (this.player) {
            this.player.setDepth(this.player.y + this.player.displayHeight / 2);
        }

        // Enemies update is handled by the group's runChildUpdate: true
        // Y-sorting for enemies
        for (const enemy of this.enemies.getChildren()) {
            if (enemy instanceof Phaser.GameObjects.Sprite) {
                enemy.setDepth(enemy.y + enemy.displayHeight / 2);
            }
        }

        // Y-sorting for remote players too
        for (const remotePlayer of this.remotePlayers.values()) {
            remotePlayer.setDepth(remotePlayer.y + remotePlayer.displayHeight / 2);
        }
        
        // Send enemy positions to HUD for indicators
        this.updateEnemyIndicators();
    }

    // Add this new method to update enemy indicators
    private updateEnemyIndicators(): void {
        // Only update if enemies exist and the HUD scene is active
        if (!this.enemies || !this.enemies.getLength() || !this.scene.isActive('HudScene')) {
            return;
        }
        
        const cam = this.cameras.main;
        const enemyData = [];
        
        // Collect data about all enemies
        for (const enemy of this.enemies.getChildren()) {
            if (enemy instanceof Phaser.GameObjects.Sprite && enemy.active) {
                // Cast to EnemySprite to access entityId
                const enemySprite = enemy as EnemySprite;
                enemyData.push({
                    id: enemySprite.entityId || `enemy_${enemy.x}_${enemy.y}`,
                    worldX: enemy.x,
                    worldY: enemy.y
                });
            }
        }
        
        // Emit event to update HUD indicators with enemy and camera information
        this.game.events.emit('updateEnemyIndicators', {
            enemies: enemyData,
            cameraX: cam.worldView.x,
            cameraY: cam.worldView.y,
            cameraWidth: cam.width,
            cameraHeight: cam.height
        });
    }

    // Add shutdown method for cleanup
    shutdown() {
        if (this.particleSystem) {
            this.particleSystem.destroy();
        }

        // Clean up network connections
        if (this.networkSystem) {
            this.networkSystem.disconnect();
            this.networkSystem = null;
        }

        // Clear remote players
        for (const player of this.remotePlayers.values()) {
            player.destroy();
        }
        this.remotePlayers.clear();

        // Potentially destroy other systems or clear event listeners if not handled by Phaser automatically
        this.events.off(EVENT_ENTITY_SHOOT_PROJECTILE, this.handleEntityShoot, this);
        // ... remove other listeners added with this.events.on ...

        // If HUD scene is managed here, ensure it's stopped
        if (this.scene.isActive('HudScene')) {
            this.scene.stop('HudScene');
        }

        // Restore the cursor and clean up
        this.game.canvas.style.cursor = 'default';
        this.input.off('pointermove', this.handleMouseMoveForCursor, this);
        if (this.cursorHideTimer) {
            this.cursorHideTimer.remove(false);
            this.cursorHideTimer = undefined;
        }
    }

    /**
     * Set up the network system for multiplayer mode
     */
    private setupNetworkSystem(): void {
        this.networkSystem = new NetworkSystem();

        // Set up network event listeners
        this.networkSystem.on('connected', () => {
            console.log('Successfully connected to game server!');

            // Send connect message to the server
            this.networkSystem?.sendConnectMessage(`Player_${Math.floor(Math.random() * 1000)}`);
        });

        this.networkSystem.on('messageReceived', (message: ServerMessage) => {
            this.handleNetworkMessage(message);
        });

        this.networkSystem.on('disconnected', (event: { code: number, reason: string }) => {
            console.log(`Disconnected from server. Code: ${event.code}, Reason: ${event.reason}`);
            // Optionally handle fallback to singleplayer
        });

        // Connect to the server
        console.log(`Connecting to game server at ${this.serverUrl}...`);
        this.networkSystem.connect(this.serverUrl);
    }

    /**
     * Handle messages from the network
     */
    private handleNetworkMessage(message: ServerMessage): void {
        // Handle player position updates
        if (isPlayerPositionsMessage(message)) {
            for (const playerData of message.players) {
                // Skip updates for our own player
                if (this.player && playerData.id === this.player.playerId) {
                    continue;
                }

                // Update or create remote player
                this.updateRemotePlayer(playerData);
            }
        }
    }

    /**
     * Update or create a remote player instance
     */
    private updateRemotePlayer(playerData: RemotePlayerData): void {
        const { id, position } = playerData;

        // Check if we already have this remote player
        let remotePlayer = this.remotePlayers.get(id);

        if (!remotePlayer) {
            // Create new remote player sprite
            remotePlayer = new PlayerSprite(this, position.x, position.y, id, this.particleSystem);

            // Mark as network controlled
            if (this.networkSystem) {
                remotePlayer.setNetworkMode(this.networkSystem, true);
            }

            // Add to physics system if needed
            this.physics.add.existing(remotePlayer);

            // Store in our map
            this.remotePlayers.set(id, remotePlayer);

            // Add any necessary colliders
            if (this.buildings) { // ADDED collision with static buildings for remote players
                this.physics.add.collider(remotePlayer, this.buildings);
            }
        }

        // Update the remote player's position
        remotePlayer.updateFromNetwork(position.x, position.y);
    }

    private handleMouseMoveForCursor(): void {
        // Show the cursor
        this.game.canvas.style.cursor = 'default';

        // Clear any existing timer
        if (this.cursorHideTimer) {
            this.cursorHideTimer.remove(false);
        }

        // Set a timer to hide the cursor again
        this.cursorHideTimer = this.time.delayedCall(this.CURSOR_HIDE_DELAY, () => {
            if (this.scene.isActive()) { // Only hide if the scene is still active
                this.game.canvas.style.cursor = 'none';
            }
        }, [], this);
    }

    private spawnXpOrbs(x: number, y: number, totalXpValue: number): void {
        if (!this.player) return; // Ensure player exists
        if (totalXpValue <= 0) return; // No XP to spawn

        const DYNAMIC_ORB_TEXTURE_KEY = 'xp_orb_dynamic';
        const numOrbsToSpawn = Phaser.Math.Between(3, 5); // Spawn 3 to 5 orbs
        const baseXpValuePerOrb = Math.floor(totalXpValue / numOrbsToSpawn);
        let remainderXp = totalXpValue % numOrbsToSpawn;

        for (let i = 0; i < numOrbsToSpawn; i++) {
            let currentOrbXp = baseXpValuePerOrb;
            if (remainderXp > 0) {
                currentOrbXp++;
                remainderXp--;
            }

            if (currentOrbXp <= 0 && numOrbsToSpawn === 1 && totalXpValue > 0) {
                // Ensure at least 1 XP if totalXpValue was positive but got lost in division for a single orb
                currentOrbXp = 1; 
            } else if (currentOrbXp <= 0 && totalXpValue > 0) {
                // If an orb ends up with 0 xp due to division, but there was total XP,
                // skip creating this 0-value orb unless it's the only one meant to carry all XP.
                // This check helps avoid spawning 0xp orbs if totalXp is small (e.g. 2xp, 3 orbs)
                // The first few orbs will get 1xp each due to remainder distribution in that case.
                if (baseXpValuePerOrb === 0) continue; 
            }


            // Create the orb using the new XpOrb class
            const orb = new XpOrb(this, x, y, DYNAMIC_ORB_TEXTURE_KEY, currentOrbXp, this.player);
            this.xpOrbs.add(orb);

            // Optional: make orbs fly out a bit, each with a slightly different trajectory
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const distance = Phaser.Math.FloatBetween(25, 60); // Slightly larger spread
            const targetX = x + Math.cos(angle) * distance;
            const targetY = y + Math.sin(angle) * distance;

            orb.initialBurst(targetX, targetY);

            if (this.particleSystem) {
                // this.particleSystem.playXpOrbSpawn(orb.x, orb.y);
            }
        }
    }

    private createXpOrbTexture(): void {
        const key = 'xp_orb_dynamic';
        const size = 32; // Texture size (diameter of the orb)
        const glowPadding = 4; // Extra padding for the glow effect
        const canvasSize = size + glowPadding * 2; // Canvas needs to be larger to accommodate glow

        if (this.textures.exists(key)) {
            return; // Texture already created
        }

        const canvasTexture = this.textures.createCanvas(key, canvasSize, canvasSize);
        if (!canvasTexture) return;

        const ctx = canvasTexture.context;
        const centerX = canvasSize / 2;
        const centerY = canvasSize / 2;
        const orbRadius = size / 2 - 1; // Orb radius, -1 to keep it slightly smaller than original texture box

        // Green orb colors
        const baseColor = '#4CAF50'; // Green 500
        const highlightColor = '#A5D6A7'; // Green 200 (lighter)
        const shadowColor = '#2E7D32'; // Green 800 (darker)
        const glowColor = 'rgba(76, 175, 80, 0.6)'; // Semi-transparent base green for glow
        const intenseGlowColor = 'rgba(165, 214, 167, 0.3)'; // Lighter, more transparent glow

        // Draw the glow effect first
        ctx.beginPath();
        const glowGradient = ctx.createRadialGradient(centerX, centerY, orbRadius * 0.5, centerX, centerY, orbRadius + glowPadding);
        glowGradient.addColorStop(0, intenseGlowColor); // More intense glow closer to the orb
        glowGradient.addColorStop(0.7, glowColor);
        glowGradient.addColorStop(1, 'rgba(76, 175, 80, 0)'); // Fade to transparent
        ctx.fillStyle = glowGradient;
        ctx.arc(centerX, centerY, orbRadius + glowPadding, 0, Math.PI * 2, false);
        ctx.fill();

        // Main orb body with radial gradient for 3D effect (drawn on top of the glow)
        ctx.beginPath();
        ctx.arc(centerX, centerY, orbRadius, 0, Math.PI * 2, false);
        const orbGradient = ctx.createRadialGradient(centerX - orbRadius / 3, centerY - orbRadius / 3, 0, centerX, centerY, orbRadius);
        orbGradient.addColorStop(0, highlightColor); // Center highlight
        orbGradient.addColorStop(0.7, baseColor);    // Main color
        orbGradient.addColorStop(1, shadowColor);    // Edge color for depth
        ctx.fillStyle = orbGradient;
        ctx.fill();

        // Add a smaller, brighter specular highlight
        ctx.beginPath();
        ctx.arc(centerX - orbRadius * 0.3, centerY - orbRadius * 0.4, orbRadius * 0.25, 0, Math.PI * 2, false);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fill();
        
        // Refresh the texture
        canvasTexture.refresh();
    }

    // Add a new method to handle enemy-enemy collision with separation logic
    private handleEnemyCollideEnemy(enemy1: Phaser.GameObjects.GameObject, enemy2: Phaser.GameObjects.GameObject): void {
        // Dynamic force adjustment to separate overlapping enemies
        if (enemy1 instanceof EnemySprite && enemy2 instanceof EnemySprite) {
            // Skip collision processing if either enemy is inactive or fleeing
            if (!enemy1.active || !enemy2.active || enemy1.isFleeing || enemy2.isFleeing) {
                return;
            }
            
            // Calculate vector between enemies
            const dx = enemy2.x - enemy1.x;
            const dy = enemy2.y - enemy1.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Skip if they're too far apart (shouldn't happen with collision)
            if (distance <= 0) return;
            
            // Normalize direction vector
            const nx = dx / distance;
            const ny = dy / distance;
            
            // Calculate separation force based on overlap
            const minSeparation = (enemy1.displayWidth + enemy2.displayWidth) / 3;
            if (distance < minSeparation) {
                const separationForce = (minSeparation - distance) * 8; // Adjust multiplier for stronger effect
                
                // Apply opposing forces to separate them
                if (enemy1.body instanceof Phaser.Physics.Arcade.Body) {
                    enemy1.body.velocity.x -= nx * separationForce;
                    enemy1.body.velocity.y -= ny * separationForce;
                }
                
                if (enemy2.body instanceof Phaser.Physics.Arcade.Body) {
                    enemy2.body.velocity.x += nx * separationForce;
                    enemy2.body.velocity.y += ny * separationForce;
                }
            }
        }
    }
} 