import Phaser from 'phaser';
import { WorldGen } from '../world/WorldGen';
import { CollisionMap } from '../world/CollisionMap';
import { ChunkRenderer } from '../world/ChunkRenderer';
import { generateInitialSeed } from '../../common/world'; // For a default seed
import { PlayerSprite } from '../objects/PlayerSprite'; // Changed to named import
import { EnemySprite } from '../objects/EnemySprite'; // Import EnemySprite
import ProjectileSprite, { ProjectileType } from '../objects/ProjectileSprite'; // Import ProjectileSprite and its enum
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
    private enemySpawner!: EnemySpawner; // Added EnemySpawner property
    private progressionSystem!: ProgressionSystem; // Add progressionSystem property
    private particleSystem!: ParticleSystem; // Added particle system member

    // Network related members
    private networkSystem: NetworkSystem | null = null;
    private isMultiplayer = false;
    private serverUrl = 'ws://127.0.0.1:8080';
    private remotePlayers: Map<string, PlayerSprite> = new Map();

    public static readonly CELL_WIDTH = 64;
    public static readonly CELL_HEIGHT = 64;

    private worldGen!: WorldGen;
    private collisionMap!: CollisionMap;
    private chunkRenderer!: ChunkRenderer;

    private cursorHideTimer?: Phaser.Time.TimerEvent;
    private readonly CURSOR_HIDE_DELAY = 200; // Time in ms to hide cursor after no movement

    constructor() {
        super({ key: 'GameScene' });
    }

    init(data: GameSceneData) {
        const seed = data.worldSeed ?? generateInitialSeed();

        this.worldGen = new WorldGen(seed);
        this.collisionMap = new CollisionMap(this.worldGen);

        // Set up multiplayer mode if specified
        this.isMultiplayer = data.isMultiplayer ?? false;
        if (data.serverUrl) {
            this.serverUrl = data.serverUrl;
        }
    }

    preload() {
    }

    create(data: GameSceneData) {
        this.chunkRenderer = new ChunkRenderer(this, this.worldGen);

        // Instantiate ParticleSystem early
        this.particleSystem = new ParticleSystem(this); // Instantiated ParticleSystem

        const worldPixelWidth = this.collisionMap.getWidth() * GameScene.CELL_WIDTH;
        const worldPixelHeight = this.collisionMap.getHeight() * GameScene.CELL_HEIGHT;
        this.physics.world.setBounds(0, 0, worldPixelWidth, worldPixelHeight);

        this.cameras.main.setBackgroundColor('#222222');

        // Set up network system if in multiplayer mode
        if (this.isMultiplayer) {
            this.setupNetworkSystem();
        }

        // Initialize player BEFORE setting up collision
        const playerX = data.initialPosition?.x ?? worldPixelWidth / 2;
        const playerY = data.initialPosition?.y ?? worldPixelHeight / 2;
        this.player = new PlayerSprite(this, playerX, playerY, data.playerId ?? 'localPlayer');

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

        // Setup Enemy Spawner
        if (this.player) {
            this.enemySpawner = new EnemySpawner(this, this.player, this.enemies, WAVE_DEFINITIONS, this.particleSystem); // Pass particleSystem
            // this.enemySpawner.startWaveSystem(1); // Start with wave 1 - MOVED

            // Initialize ProgressionSystem after player is created
            this.progressionSystem = new ProgressionSystem(this, this.player);
        }

        // Get the tilemap layer from the chunk renderer
        const tilemapLayer = this.chunkRenderer.tilemapLayer;

        if (tilemapLayer) {
            // Tile index 2 corresponds to CellType.SOLID (stone)
            tilemapLayer.setCollision(2);
            tilemapLayer.setDepth(-10); // Ensure tilemap is rendered behind entities
            if (this.player) {
                this.physics.add.collider(this.player, tilemapLayer); // Player vs World
            }
            this.physics.add.collider(this.enemies, tilemapLayer); // Enemies vs World
        } else {
            console.error('GameScene: Tilemap layer not available from ChunkRenderer for collision setup.');
        }

        // Collision between player and enemies
        if (this.player) {
            this.physics.add.overlap(this.projectiles, this.enemies, this.handleProjectileHitEnemy as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
            this.physics.add.overlap(this.projectiles, this.player, this.handleProjectileHitPlayer as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
        }

        // Collision between enemies themselves (to prevent clumping)
        this.physics.add.collider(this.enemies, this.enemies);

        if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
        }

        this.cameras.main.startFollow(this.player, true, 1, 1);
        this.cameras.main.setBounds(0, 0, worldPixelWidth, worldPixelHeight);
        this.cameras.main.roundPixels = true; // For smoother, pixel-perfect camera movement

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
                hp: this.player.hp,
                maxHp: this.player.maxHp,
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
                nextLevelXp: data.xpToNextLevel
            });
        });

        this.events.on('playerLevelUp', (data: { newLevel: number }) => {
            // This is handled by ProgressionSystem opening the upgrade UI
            // We could add a visual effect here if desired
        });

        // Event Listeners
        this.events.on(EVENT_ENTITY_SHOOT_PROJECTILE, this.handleEntityShoot, this);
        this.events.on(EVENT_ENTITY_DIED, (payload: { entity: EntitySprite, killer?: EntitySprite | ProjectileSprite | string }) => {
            // Notify EnemySpawner if an EnemySprite died
            if (payload.entity instanceof EnemySprite && this.enemySpawner) {
                this.enemySpawner.notifyEnemyDefeated(payload.entity as EnemySprite);

                // If the player killed the enemy, award XP via the progression system
                if (payload.killer instanceof ProjectileSprite &&
                    this.player &&
                    payload.killer.ownerId === this.player.entityId) {

                    // Emit enemyKilled event for progressionSystem to handle XP rewards
                    // The amount could vary based on enemy type
                    const xpAmount = payload.entity.xpValue || 10; // Default 10 XP if not specified
                    this.events.emit('enemyKilled', { amount: xpAmount, enemy: payload.entity });
                }
            } else if (payload.entity instanceof PlayerSprite && payload.entity === this.player) {
                // Player died, transition to GameOverScene
                const wavesSurvived = this.enemySpawner ? this.enemySpawner.getCurrentWaveNumber() - 1 : 0; // Get waves survived

                this.scene.stop('HudScene'); // Stop HUD
                this.scene.stop(this.scene.key); // Stop current scene (GameScene)
                this.scene.start('GameOverScene', { wavesSurvived: wavesSurvived });
            }
        });

        this.events.on(EVENT_ENTITY_TAKE_DAMAGE, (payload: { target: EntitySprite, damage: number, newHp: number, source?: EntitySprite | ProjectileSprite | string }) => {

            // If player took damage, update HUD
            if (payload.target instanceof PlayerSprite && this.player === payload.target) {
                this.game.events.emit('updateHud', {
                    hp: payload.newHp,
                    maxHp: this.player.maxHp
                });
            }
        });
        this.events.on(EVENT_PROJECTILE_SPAWNED, (payload: { projectile: ProjectileSprite, ownerId: string }) => {
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
        ownerId: string,
        projectileType: string,
        direction: Phaser.Math.Vector2,
        targetPosition?: Phaser.Math.Vector2
    }): void {
        const { shooter, ownerId, projectileType, direction } = payload; // targetPosition not directly used for spawn point

        // Determine projectile type from string
        const pType: ProjectileType = ProjectileType[projectileType as keyof typeof ProjectileType] || ProjectileType.BULLET;

        let spawnOffsetMagnitude: number;
        let projectileScale: number | undefined = undefined;

        if (shooter instanceof PlayerSprite) {
            // Player's physics body: width 32 (half 16), height 64 (half 32).
            // Spawn offset should be slightly larger than the max half-dimension.
            // Math.max(32 / 2, 64 / 2) + 5 = Math.max(16, 32) + 5 = 32 + 5 = 37.
            spawnOffsetMagnitude = 37;
            projectileScale = shooter.getProjectileScale();
        } else if (shooter instanceof EnemySprite) {
            // Enemies use definition.width/height for their body size.
            // Use the larger of their half-dimensions + a buffer.
            const sWidth = typeof shooter.width === 'number' && Number.isFinite(shooter.width) ? shooter.width : 32;
            const sHeight = typeof shooter.height === 'number' && Number.isFinite(shooter.height) ? shooter.height : 32;
            spawnOffsetMagnitude = (Math.max(sWidth, sHeight) / 2) + 10;
            // projectileScale remains undefined for enemies
        } else {
            // Fallback for any other EntitySprite type (e.g. if we add other shootable entities)
            const sWidth = typeof shooter.width === 'number' && Number.isFinite(shooter.width) ? shooter.width : 32;
            const sHeight = typeof shooter.height === 'number' && Number.isFinite(shooter.height) ? shooter.height : 32;
            spawnOffsetMagnitude = (Math.max(sWidth, sHeight) / 2) + 10;
        }

        const projectile = new ProjectileSprite(
            this,
            shooter.x + direction.x * spawnOffsetMagnitude,
            shooter.y + direction.y * spawnOffsetMagnitude, // Use the same magnitude for y offset based on direction
            pType,
            ownerId,
            shooter.projectileDamage, // Use damage from shooter
            shooter.projectileSpeed,  // Use speed from shooter
            shooter.projectileLifespan, // Use lifespan from shooter
            projectileScale, // Pass scale
            this.particleSystem // Pass particle system
        );

        this.projectiles.add(projectile);
        if (projectile.body instanceof Phaser.Physics.Arcade.Body) {
            projectile.body.setVelocity(direction.x * projectile.speed, direction.y * projectile.speed);
        }

        this.events.emit(EVENT_PROJECTILE_SPAWNED, { projectile, ownerId });
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

    update(time: number, delta: number) {
        if (!this.player || !this.cursors || !this.player.body) {
            return;
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

        console.log('GameScene shutdown complete.');
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
            remotePlayer = new PlayerSprite(this, position.x, position.y, id);

            // Mark as network controlled
            if (this.networkSystem) {
                remotePlayer.setNetworkMode(this.networkSystem, true);
            }

            // Add to physics system if needed
            this.physics.add.existing(remotePlayer);

            // Store in our map
            this.remotePlayers.set(id, remotePlayer);

            // Add any necessary colliders
            const tilemapLayer = this.chunkRenderer.tilemapLayer;
            if (tilemapLayer) {
                this.physics.add.collider(remotePlayer, tilemapLayer);
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
} 