import Phaser from 'phaser';
import { PlayerSprite } from '../objects/PlayerSprite'; // Changed to named import
import { EnemySprite } from '../objects/EnemySprite'; // Import EnemySprite
import ProjectileSprite, { ProjectileType } from '../objects/ProjectileSprite'; // Import ProjectileSprite and its enum
import { XpOrb } from '../objects/XpOrb'; // Import the new XpOrb class
import type { EntitySprite } from '../objects/EntitySprite'; // Changed to type-only import
import { EnemySpawner, type WaveDefinition } from '../systems/EnemySpawner'; // Updated import
import NetworkSystem from '../systems/NetworkSystem';
import {
    GameEvent
} from '../../common/events'; // Use the enum
import { ProgressionSystem } from '../systems/ProgressionSystem'; // Import ProgressionSystem
import { ParticleSystem } from '../systems/ParticleSystem'; // Added import
import { type RemotePlayerData, type ServerMessage, isPlayerPositionsMessage } from '../types/multiplayer'; // Import multiplayer types
import WAVE_DEFINITIONS from '../definitions/waves.json'; // Import WAVE_DEFINITIONS
import GAME_ENEMY_DEFINITIONS from '../definitions/enemies.json'; // Import game enemy definitions
import { HitboxCollisionManager } from '../world/HitboxCollisionManager'; // ADDED
import { EnemyDebugDisplay, PlayerDebugDisplay } from '../debug'; // UPDATED: Import debug displays from index
// New imports for modular components
import { CameraManager } from '../camera/CameraManager';
import { InputController } from '../input/InputController';
import { MapInitializer } from '../world/MapInitializer';
import { 
    handleProjectileHitEnemy,
    handleProjectileHitPlayer,
    handlePlayerCollectXpOrb,
    handleEnemyCollideEnemy
} from '../eventHandlers/collisionHandlers';
import { FloatingTextManager } from '../ui/FloatingTextManager';
import { PauseMenuScene } from '../ui/PauseMenuScene'; // Import PauseMenuScene

// Define the type for data passed from LobbyScene
interface GameSceneData {
    playerId: string;
    initialPosition: { x: number; y: number };
    worldSeed?: number;
    isMultiplayer?: boolean;
    serverUrl?: string;
    characterId?: string;
    // ... any other data from initialServerData
}

export class GameScene extends Phaser.Scene {
    player: PlayerSprite | undefined;
    private enemies!: Phaser.Physics.Arcade.Group; // Enemy group
    private projectiles!: Phaser.Physics.Arcade.Group; // Projectile group
    private xpOrbs!: Phaser.Physics.Arcade.Group; // Group for XP orbs
    private enemySpawner!: EnemySpawner; // Added EnemySpawner property
    private progressionSystem!: ProgressionSystem; // Add progressionSystem property
    private particleSystem!: ParticleSystem; // Added particle system member

    // New modular component instances
    private cameraManager!: CameraManager;
    private inputController!: InputController;
    private mapInitializer!: MapInitializer;

    // Network related members
    private networkSystem: NetworkSystem | null = null;
    private isMultiplayer = false;
    private serverUrl = 'ws://127.0.0.1:8080';
    private remotePlayers: Map<string, PlayerSprite> = new Map();

    private hitboxCollisionManager!: HitboxCollisionManager;
    private buildings!: Phaser.Physics.Arcade.StaticGroup;

    private enemyDebugDisplay!: EnemyDebugDisplay; // ADDED: Instance of EnemyDebugDisplay
    private playerDebugDisplay!: PlayerDebugDisplay; // ADDED: Instance of PlayerDebugDisplay
    private killCount = 0; // ADDED: Player's kill count
    
    // Pause handling
    private isPaused: boolean = false;

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
        this.killCount = 0; // Explicitly reset kill count on scene creation

        // Initialize modular components
        this.cameraManager = new CameraManager(this);
        this.inputController = new InputController(this);
        this.mapInitializer = new MapInitializer(this);

        // Initialize map and buildings
        const mapData = this.mapInitializer.initialize();
        this.hitboxCollisionManager = mapData.hitboxCollisionManager;
        this.buildings = mapData.buildings;
        const mapWidth = mapData.mapWidth;
        const mapHeight = mapData.mapHeight;

        // Set camera background color
        this.cameraManager.setBackgroundColor('#222222');

        // Create the dynamic XP orb texture
        this.createXpOrbTexture();

        // Instantiate ParticleSystem early
        this.particleSystem = new ParticleSystem(this); // Instantiated ParticleSystem

        // Set up network system if in multiplayer mode
        if (this.isMultiplayer) {
            this.setupNetworkSystem();
        }

        // Initialize player BEFORE setting up collision
        const playerX = data.initialPosition?.x ?? mapWidth / 2;
        const playerY = data.initialPosition?.y ?? mapHeight / 2;
        
        // Debug character information
        console.log(`GameScene: Creating player with character ID: ${data.characterId ?? '1'}`);
        
        this.player = new PlayerSprite(this, playerX, playerY, data.playerId ?? 'localPlayer', data.characterId ?? '1', this.particleSystem);

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

        // Setup Enemy Spawner
        if (this.player) {
            this.enemySpawner = new EnemySpawner(this, this.player, this.enemies, WAVE_DEFINITIONS, this.particleSystem); // Pass particleSystem
            // this.enemySpawner.startWaveSystem(1); // Start with wave 1 - MOVED

            // Initialize ProgressionSystem after player is created
            this.progressionSystem = new ProgressionSystem(this, this.player);
        }

        // Set up collisions using the MapInitializer
        if (this.player) {
            this.mapInitializer.setupCollisions(this.player);
        }
        this.mapInitializer.setupCollisions(this.enemies);

        // Collision between player and enemies
        if (this.player) {
            this.physics.add.overlap(
                this.projectiles, 
                this.enemies, 
                (obj1, obj2) => handleProjectileHitEnemy(this, obj1, obj2, this.player) as unknown as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, 
                undefined, 
                this
            );
            
            this.physics.add.overlap(
                this.projectiles, 
                this.player, 
                (obj1, obj2) => handleProjectileHitPlayer(this, obj1, obj2, this.player, this.enemies) as unknown as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, 
                undefined, 
                this
            );
            
            // Add collision for player and XP orbs
            this.physics.add.overlap(
                this.player, 
                this.xpOrbs, 
                (obj1, obj2) => handlePlayerCollectXpOrb(this, obj1, obj2) as unknown as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, 
                undefined, 
                this
            );
        }

        // Collision between enemies themselves (to prevent clumping)
        this.physics.add.collider(
            this.enemies, 
            this.enemies, 
            handleEnemyCollideEnemy as unknown as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, 
            undefined, 
            this
        );

        // ADDED: Initialize EnemyDebugDisplay and PlayerDebugDisplay
        this.enemyDebugDisplay = new EnemyDebugDisplay(this);
        this.playerDebugDisplay = new PlayerDebugDisplay(this);

        // Initialize camera with player as target
        if (this.player) {
            this.cameraManager.initialize(this.player, 0, 0, mapWidth, mapHeight);
        }

        // Launch the HUD Scene
        this.scene.launch('HudScene');
        this.scene.bringToTop('HudScene');
        
        // Load the PauseMenuScene but keep it inactive until needed
        if (!this.scene.get('PauseMenuScene')) {
            this.scene.add('PauseMenuScene', PauseMenuScene, false);
        }

        // Listen for HUD ready event before starting wave system and updating HUD
        this.game.events.once(GameEvent.HUD_READY, () => {
            if (this.enemySpawner) {
                this.enemySpawner.startWaveSystem(1); // Start with wave 1
            }
            
            // Set initial HUD values after HUD is ready
            if (this.player) {
                this.game.events.emit(GameEvent.UPDATE_HUD, {
                    hp: this.player.currentStats.hp,
                    maxHp: this.player.currentStats.maxHp,
                    currentXp: 0,
                    nextLevelXp: 100,
                    killCount: this.killCount
                });
            }
        });

        // Connect progression system events to HUD
        this.events.on(GameEvent.XP_UPDATED, (data: { currentXP: number, currentLevel: number, xpToNextLevel: number }) => {
            this.game.events.emit(GameEvent.UPDATE_HUD, {
                currentXp: data.currentXP,
                nextLevelXp: data.xpToNextLevel,
                level: data.currentLevel // Ensure level is passed to HUD
            });
        });

        this.events.on(GameEvent.PLAYER_LEVEL_UP, (data: { newLevel: number }) => {
            // This is handled by ProgressionSystem opening the upgrade UI
            // We could add a visual effect here if desired
            // Ensure HUD is updated with the new level if not already covered by xpUpdated
             this.game.events.emit(GameEvent.UPDATE_HUD, { level: data.newLevel });
        });

        // Event Listeners
        this.events.on(GameEvent.ENTITY_SHOOT_PROJECTILE, this.handleEntityShoot, this);
        this.events.on(GameEvent.ENTITY_DIED, (payload: { entity: EntitySprite, killer?: EntitySprite | ProjectileSprite | string }) => {
            if (payload.entity instanceof EnemySprite && this.enemySpawner) {
                this.enemySpawner.notifyEnemyDefeated(payload.entity as EnemySprite);

                // Check if the player is the killer, either directly or via a projectile
                let killedByPlayer = false;
                if (this.player) {
                    if (payload.killer instanceof ProjectileSprite && payload.killer.ownerId === this.player.entityId) {
                        killedByPlayer = true;
                    } else if (payload.killer === this.player) { // Direct kill by player (e.g., melee)
                        killedByPlayer = true;
                    } else if (typeof payload.killer === 'string' && payload.killer === this.player.entityId) {
                        // Case where killer is an entityId string referring to the player
                        killedByPlayer = true;
                    }
                }

                if (killedByPlayer) {
                    const xpAmount = (payload.entity as EnemySprite).currentStats.xpValue ?? (payload.entity as EnemySprite).baseStats.xpValue ?? 10;
                    this.spawnXpOrbs(payload.entity.x, payload.entity.y, xpAmount);
                    
                    // ADDED: Increment kill count and update HUD
                    this.killCount++;
                    this.game.events.emit(GameEvent.UPDATE_HUD, { killCount: this.killCount });
                }
            } else if (payload.entity instanceof PlayerSprite && payload.entity === this.player) {
                const wavesSurvived = this.enemySpawner ? this.enemySpawner.getCurrentWaveNumber() - 1 : 0; 
                this.scene.stop('HudScene'); 
                this.scene.stop(this.scene.key); 
                this.scene.start('GameOverScene', { wavesSurvived: wavesSurvived, killCount: this.killCount }); // Pass killCount
            }
        });

        this.events.on(GameEvent.ENTITY_TAKE_DAMAGE, (payload: { target: EntitySprite, damage: number, newHp: number, source?: EntitySprite | ProjectileSprite | string }) => {
            if (payload.target instanceof PlayerSprite && this.player === payload.target) {
                this.game.events.emit(GameEvent.UPDATE_HUD, {
                    hp: payload.newHp,
                    maxHp: this.player.currentStats.maxHp
                });
            }
        });
        this.events.on(GameEvent.PROJECTILE_SPAWNED, (payload: { projectile: ProjectileSprite, ownerId: string }) => {
        });

        // Listen for XP orb collection to pass XP to ProgressionSystem
        this.events.on(GameEvent.XP_ORB_COLLECTED, (data: { amount: number }) => {
            if (this.progressionSystem) {
                this.progressionSystem.addXp(data.amount);
            }
        });

        // Listen to EnemySpawner events for logging (and later UI)
        this.events.on(GameEvent.WAVE_START, (data: { waveNumber: number, totalEnemies: number }) => {
            // Emit a global event for the HUD
            this.game.events.emit(GameEvent.UPDATE_WAVE_HUD, {
                waveNumber: data.waveNumber,
                enemiesRemaining: data.totalEnemies, // Initially, all enemies are remaining
                totalEnemiesInWave: data.totalEnemies
            });
            // Emit the new event specifically for the wave started message
            this.game.events.emit(GameEvent.NEW_WAVE_STARTED_HUD, { waveNumber: data.waveNumber });
        });
        this.events.on(GameEvent.ENEMY_DEFEATED_IN_WAVE, (data: { waveNumber: number, enemiesRemaining: number, totalSpawnedThisWave: number, totalToSpawnThisWave: number }) => {
            // Emit a global event for the HUD
            this.game.events.emit(GameEvent.UPDATE_WAVE_HUD, {
                waveNumber: data.waveNumber,
                enemiesRemaining: data.enemiesRemaining,
                totalEnemiesInWave: data.totalToSpawnThisWave
            });
        });
        this.events.on(GameEvent.WAVE_CLEAR, (data: { waveNumber: number }) => {
            // We no longer need to show upgrades on wave clear
            // as progression is now XP-based
            // Just update the HUD
            this.game.events.emit(GameEvent.WAVE_CLEAR_HUD, data);
        });
        this.events.on(GameEvent.ALL_WAVES_CLEARED, () => {
            // Optionally, tell HUD all waves are cleared
            this.game.events.emit(GameEvent.ALL_WAVES_CLEARED_HUD);
        });
        
        // Set up pause-related event listeners
        this.game.events.on(GameEvent.RESUME_GAME, this.resumeGame, this);
        this.game.events.on(GameEvent.QUIT_TO_MENU, this.quitToMenu, this);
    }

    private handleEntityShoot(payload: {
        shooter: EntitySprite,
        projectileType: string,
        direction: Phaser.Math.Vector2,
        targetPosition?: Phaser.Math.Vector2,
        damage: number,
        projectileSpeed: number,
        lifespan: number,
        projectileScale?: number,
        isCritical: boolean;
    }): void {
        const { shooter, projectileType, direction, damage, projectileSpeed, lifespan, isCritical } = payload;

        let spawnOffsetMagnitude: number;
        const projectileScale: number | undefined = payload.projectileScale;

        if (shooter instanceof PlayerSprite) {
            spawnOffsetMagnitude = 37;
        } else if (shooter instanceof EnemySprite) {
            const sWidth = typeof shooter.width === 'number' && Number.isFinite(shooter.width) ? shooter.width : 32;
            const sHeight = typeof shooter.height === 'number' && Number.isFinite(shooter.height) ? shooter.height : 32;
            spawnOffsetMagnitude = (Math.max(sWidth, sHeight) / 2) + 10;
        } else {
            const sWidth = typeof shooter.width === 'number' && Number.isFinite(shooter.width) ? shooter.width : 32;
            const sHeight = typeof shooter.height === 'number' && Number.isFinite(shooter.height) ? shooter.height : 32;
            spawnOffsetMagnitude = (Math.max(sWidth, sHeight) / 2) + 10;
        }

        const pType: ProjectileType = ProjectileType[projectileType as keyof typeof ProjectileType] || ProjectileType.BULLET;

        const projectile = new ProjectileSprite(
            this,
            shooter.x + direction.x * spawnOffsetMagnitude,
            shooter.y + direction.y * spawnOffsetMagnitude,
            pType,
            shooter.entityId,
            damage,
            projectileSpeed,
            lifespan,
            projectileScale,
            this.particleSystem,
            isCritical
        );

        this.projectiles.add(projectile);
        if (projectile.body instanceof Phaser.Physics.Arcade.Body) {
            projectile.body.setVelocity(direction.x * projectile.speed, direction.y * projectile.speed);
        }

        this.events.emit(GameEvent.PROJECTILE_SPAWNED, { projectile, ownerId: shooter.entityId });
    }

    update(time: number, delta: number) {
        if (!this.player || !this.inputController.cursors || !this.player.body) {
            return;
        }
        
        // Check for pause key press using InputController
        if (this.inputController.isPauseTogglePressed()) {
            this.togglePause();
            return;
        }
        
        // Skip updates if game is paused
        if (this.isPaused) return;

        // Update camera manager
        this.cameraManager.update();

        // Check for enemy debug toggle from input controller
        if (this.inputController.isDebugTogglePressed()) {
            this.enemyDebugDisplay.toggleVisibility();
            if (this.player) {
                this.playerDebugDisplay.toggleVisibility();
            }
        }

        // Update player movement - just handles input and movement
        this.player.updateMovement(this.inputController.cursors);

        // Give the player the current list of enemies for auto-targeting
        if (this.enemies) {
            this.player.updateEnemiesInRange(this.enemies.getChildren());
        }

        // Update enemy spawner
        if (this.enemySpawner) {
            this.enemySpawner.update(time, delta);
        }

        // MODIFIED: Update debug displays
        this.enemyDebugDisplay.update(this.enemies);
        if (this.player) {
            this.playerDebugDisplay.update([this.player]);
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
    
    /**
     * Toggle game pause state
     */
    private togglePause(): void {
        if (this.isPaused) {
            this.resumeGame();
        } else {
            this.pauseGame();
        }
    }
    
    /**
     * Pause the game and show pause menu
     */
    private pauseGame(): void {
        if (this.isPaused) return;
        
        this.isPaused = true;
        
        // Pause physics if initialized
        if (this.physics) {
            this.physics.pause();
        }
        
        // Pause any tweens if initialized
        if (this.tweens) {
            this.tweens.pauseAll();
        }
        
        // Launch the pause menu scene
        this.scene.launch('PauseMenuScene');
        this.scene.bringToTop('PauseMenuScene');
        
        // Emit pause event for any systems that need to know
        this.game.events.emit(GameEvent.PAUSE_GAME);
    }
    
    /**
     * Resume the game from pause state
     */
    private resumeGame(): void {
        if (!this.isPaused) return;
        
        this.isPaused = false;
        
        // Resume physics if initialized
        if (this.physics) {
            this.physics.resume();
        }
        
        // Resume any tweens if initialized
        if (this.tweens) {
            this.tweens.resumeAll();
        }
        
        // Stop the pause menu scene instead of sleeping it
        if (this.scene.isActive('PauseMenuScene')) {
            this.scene.stop('PauseMenuScene');
        }
        
        // Emit resume event for any systems that need to know
        this.game.events.emit(GameEvent.RESUME_GAME);
    }
    
    /**
     * Quit the current game and return to main menu
     */
    private quitToMenu(): void {
        // Clean up current game state
        this.scene.stop('PauseMenuScene');
        this.scene.stop('HudScene');
        
        // Return to main menu scene
        this.scene.start('MainMenuScene');
    }

    // Add shutdown method for cleanup
    shutdown() {
        // Clean up modular components
        if (this.cameraManager) {
            this.cameraManager.destroy();
        }
        
        if (this.inputController) {
            this.inputController.destroy();
        }

        if (this.particleSystem) {
            this.particleSystem.destroy();
        }

        // ADDED: Destroy enemy debug display and player debug display
        this.enemyDebugDisplay.destroy();
        this.playerDebugDisplay.destroy();

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

        // Remove listeners with specific handlers/context
        this.events.off(GameEvent.ENTITY_SHOOT_PROJECTILE, this.handleEntityShoot, this); 
        this.game.events.off(GameEvent.RESUME_GAME, this.resumeGame, this);
        this.game.events.off(GameEvent.QUIT_TO_MENU, this.quitToMenu, this);
        
        // Remove all listeners for events added with inline functions on this.events
        this.events.off(GameEvent.XP_UPDATED);
        this.events.off(GameEvent.PLAYER_LEVEL_UP);
        this.events.off(GameEvent.ENTITY_DIED);
        this.events.off(GameEvent.ENTITY_TAKE_DAMAGE);
        this.events.off(GameEvent.PROJECTILE_SPAWNED);
        this.events.off(GameEvent.XP_ORB_COLLECTED);
        this.events.off(GameEvent.WAVE_START);
        this.events.off(GameEvent.ENEMY_DEFEATED_IN_WAVE);
        this.events.off(GameEvent.WAVE_CLEAR);
        this.events.off(GameEvent.ALL_WAVES_CLEARED);
        // Note: this.game.events listeners (HUD_READY, RESUME_GAME, QUIT_TO_MENU) are handled separately or are self-removing (once).
        
        // If HUD scene is managed here, ensure it's stopped
        if (this.scene.isActive('HudScene')) {
            this.scene.stop('HudScene');
        }
        
        // Make sure pause menu is stopped
        if (this.scene.isActive('PauseMenuScene')) {
            this.scene.stop('PauseMenuScene');
        }
    }

    /**
     * Set up the network system for multiplayer mode
     */
    private setupNetworkSystem(): void {
        this.networkSystem = new NetworkSystem();

        // Set up network event listeners
        this.networkSystem.on(GameEvent.NETWORK_CONNECTED, () => {
            console.log('Successfully connected to game server!');

            // Send connect message to the server
            this.networkSystem?.sendConnectMessage(`Player_${Math.floor(Math.random() * 1000)}`);
        });

        this.networkSystem.on(GameEvent.NETWORK_MESSAGE_RECEIVED, (message: ServerMessage) => {
            this.handleNetworkMessage(message);
        });

        this.networkSystem.on(GameEvent.NETWORK_DISCONNECTED, (event: { code: number, reason: string }) => {
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
            remotePlayer = new PlayerSprite(
                this, 
                position.x, 
                position.y, 
                id, 
                position.characterId || '1', 
                this.particleSystem
            );

            // Mark as network controlled
            if (this.networkSystem) {
                remotePlayer.setNetworkMode(this.networkSystem, true);
            }

            // Add to physics system if needed
            this.physics.add.existing(remotePlayer);

            // Store in our map
            this.remotePlayers.set(id, remotePlayer);

            // Add any necessary colliders
            if (this.buildings) { // Collision with static buildings for remote players
                this.physics.add.collider(remotePlayer, this.buildings);
            }
        }

        // Update the remote player's position
        remotePlayer.updateFromNetwork(position.x, position.y);
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
        const size = 20; // Texture size (diameter of the orb)
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
} 