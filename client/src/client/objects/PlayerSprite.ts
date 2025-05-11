import Phaser from 'phaser';
import { EntitySprite } from './EntitySprite'
import type { EnemySprite } from './EnemySprite';
import { type IPlayerStats, DEFAULT_PLAYER_STATS } from '../../common/PlayerStats';
import type NetworkSystem from '../systems/NetworkSystem'
import type { NetworkAware } from '../types/multiplayer';

const CHARACTER_SPRITE_KEYS = [
    'character_front_1', 'character_front_2', 'character_front_3', 'character_front_4',
    'character_front_5', 'character_front_6', 'character_front_7', 'character_front_8',
    'character_front_9', 'character_front_10', 'character_front_11', 'character_front_12',
    'character_front_13', 'character_front_14', 'character_front_15', 'character_front_16',
    'character_front_17', 'character_front_18', 'character_front_19', 'character_front_20'
];

const PLAYER_WIDTH = 128;
const PLAYER_HEIGHT = 128;

// Define dedicated physics size, smaller than visual texture
const PLAYER_PHYSICS_WIDTH = 32;
const PLAYER_PHYSICS_HEIGHT = 64;

const PLAYER_DASH_SPEED_MULTIPLIER = 2.5;
const PLAYER_DASH_DURATION = 150; // ms
const PLAYER_DASH_COOLDOWN = 800; // ms

// Constants for auto-shooting
const AUTO_SHOOT_RANGE = 300; // Maximum range to auto-target enemies
const MINIMUM_SHOOT_COOLDOWN_MS = 50; // Minimum time in ms between shots

// Position threshold for sending network updates (to avoid flooding the server)
const POSITION_UPDATE_THRESHOLD = 0.5;

export class PlayerSprite extends EntitySprite implements NetworkAware {
    public playerId: string;
    public dashCooldown: number;
    public accelerationFactor: number;
    public decelerationFactor: number;
    private isDashing = false;
    private dashEndTime = 0;
    private lastDashTime = 0;

    // Auto-shooting properties
    private targetEnemy: EnemySprite | null = null;
    private shootingTimer: Phaser.Time.TimerEvent | null = null;
    private enemies: Phaser.GameObjects.GameObject[] = [];

    // Stats that can be upgraded
    private currentProjectileScale = 1.0;
    private currentDefense = 0;

    // Network-related properties
    private networkSystem: NetworkSystem | null = null;
    private isNetworkControlled = false;
    private lastSentPosition = { x: 0, y: 0 };
    private positionUpdateDelay = 100;
    private lastPositionUpdateTime = 0;

    // Properties for WASD input
    private keyW: Phaser.Input.Keyboard.Key | undefined;
    private keyA: Phaser.Input.Keyboard.Key | undefined;
    private keyS: Phaser.Input.Keyboard.Key | undefined;
    private keyD: Phaser.Input.Keyboard.Key | undefined;

    constructor(scene: Phaser.Scene, x: number, y: number, playerId: string) {
        // Select a random sprite key
        const randomSpriteKey = Phaser.Math.RND.pick(CHARACTER_SPRITE_KEYS);

        // Initialize with default stats that will be soon updated by ProgressionSystem
        super(scene, x, y, randomSpriteKey, playerId,
            DEFAULT_PLAYER_STATS.maxHealth, // Use from DEFAULT_PLAYER_STATS
            DEFAULT_PLAYER_STATS.maxHealth, // Use from DEFAULT_PLAYER_STATS
            DEFAULT_PLAYER_STATS.movementSpeed); // Use from DEFAULT_PLAYER_STATS
        this.playerId = playerId; // entityId from EntitySprite is already set to playerId by super call
        this.dashCooldown = 0; // Default dash cooldown
        this.accelerationFactor = 0.1; // Default acceleration factor
        this.decelerationFactor = 0.1; // Default deceleration factor, can be tuned
        // this.remoteStateRef = {}; // Initialize appropriately

        // Set the physics body size and offset
        if (this.body instanceof Phaser.Physics.Arcade.Body) {
            // Calculate offsets to center the smaller physics body
            const offsetX = (PLAYER_WIDTH - PLAYER_PHYSICS_WIDTH) / 2;
            const offsetY = (PLAYER_HEIGHT - PLAYER_PHYSICS_HEIGHT) / 2;

            this.body.setSize(PLAYER_PHYSICS_WIDTH, PLAYER_PHYSICS_HEIGHT);
            this.body.setOffset(offsetX, offsetY);
            // setCollideWorldBounds(true) is handled by EntitySprite ancsestor
        }

        // Initialize with values from DEFAULT_PLAYER_STATS directly
        this.projectileType = 'BULLET';
        this.projectileDamage = DEFAULT_PLAYER_STATS.projectileDamage;
        this.projectileSpeed = DEFAULT_PLAYER_STATS.projectileSpeed;
        this.shootCooldown = DEFAULT_PLAYER_STATS.attackSpeed;
        this.currentProjectileScale = DEFAULT_PLAYER_STATS.projectileSize;
        this.currentDefense = DEFAULT_PLAYER_STATS.defense;
        this.defense = DEFAULT_PLAYER_STATS.defense; // Initialize EntitySprite's defense property

        // Set up auto-shooting timer - completely separate from movement
        this.initAutoShooting();

        // Initialize WASD keys
        if (scene.input.keyboard) {
            this.keyW = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
            this.keyA = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
            this.keyS = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
            this.keyD = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
        } else {
            console.warn('PlayerSprite: Keyboard input system not available in the scene. WASD keys will not work.');
        }

        // Listen for stat updates from ProgressionSystem
        this.scene.events.on('playerStatsUpdated', this.updateStats, this);
    }

    public updateStats(newStats: IPlayerStats): void {
        this.maxSpeed = newStats.movementSpeed;
        this.projectileSpeed = newStats.projectileSpeed;
        this.projectileDamage = newStats.projectileDamage;
        this.currentProjectileScale = newStats.projectileSize;

        this.currentDefense = newStats.defense; // Update local cache
        this.defense = newStats.defense; // Update EntitySprite's defense property

        if (this.maxHp !== newStats.maxHealth) {
            const oldHpPercentage = this.hp / this.maxHp;
            this.maxHp = newStats.maxHealth;
            this.hp = Math.min(this.hp, this.maxHp);
        }
        // If only current HP can be upgraded (e.g. heal upgrade, not maxHP up), that'd be separate logic.

        // Original value from newStats
        let newAttackSpeedValue = newStats.attackSpeed;

        // Clamp the attack speed to a minimum
        if (newAttackSpeedValue < MINIMUM_SHOOT_COOLDOWN_MS) {
            console.warn(`PlayerSprite: attackSpeed ${newAttackSpeedValue}ms too low, clamping to ${MINIMUM_SHOOT_COOLDOWN_MS}ms`);
            newAttackSpeedValue = MINIMUM_SHOOT_COOLDOWN_MS;
        }

        if (this.shootCooldown !== newAttackSpeedValue) {
            this.shootCooldown = newAttackSpeedValue;
            // Re-initialize or update the shooting timer with the new cooldown
            if (this.shootingTimer) {
                this.shootingTimer.destroy(); // Stop existing timer
            }
            this.initAutoShooting(); // Re-create with new cooldown
        }
        // Note: defense is stored, EntitySprite.takeDamage needs to use it.
        // Note: projectileSize is stored, ProjectileSprite needs to use it on creation.
    }

    public getProjectileScale(): number {
        return this.currentProjectileScale;
    }

    // Initialize auto-shooting system
    private initAutoShooting(): void {
        if (this.shootingTimer) {
            this.shootingTimer.destroy();
        }
        this.shootingTimer = this.scene.time.addEvent({
            delay: this.shootCooldown, // Uses the current shootCooldown
            callback: this.attemptAutoShoot,
            callbackScope: this,
            loop: true
        });
    }

    // Update the list of enemies to target
    public updateEnemiesInRange(enemies: Phaser.GameObjects.GameObject[]): void {
        this.enemies = enemies;
    }

    // Find and target the nearest enemy
    private findNearestEnemy(): EnemySprite | null {
        if (!this.enemies || this.enemies.length === 0) return null;

        let nearestEnemy: EnemySprite | null = null;
        let shortestDistance = AUTO_SHOOT_RANGE;

        for (const enemyObj of this.enemies) {
            const enemy = enemyObj as EnemySprite;
            if (!enemy.active) continue;

            const distance = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
            if (distance < shortestDistance) {
                shortestDistance = distance;
                nearestEnemy = enemy;
            }
        }

        return nearestEnemy;
    }

    // Automatically shoot at the nearest enemy
    private attemptAutoShoot(): void {
        if (!this.active) return;

        // Always find the nearest enemy every time
        this.targetEnemy = this.findNearestEnemy();

        // If we have a target, shoot at it
        if (this.targetEnemy?.active) {
            const targetPosition = new Phaser.Math.Vector2(this.targetEnemy.x, this.targetEnemy.y);
            this.attemptShoot(targetPosition);

            // Flip player based on target direction
            if (this.targetEnemy.x < this.x) {
                this.setFlipX(true);
            } else {
                this.setFlipX(false);
            }
        }
    }

    /**
     * Sets the network mode for this player
     * @param networkSystem The network system to use for multiplayer
     * @param isNetworkControlled Whether this player is controlled by the network (remote player)
     */
    public setNetworkMode(networkSystem: NetworkSystem | null, isNetworkControlled = false): void {
        this.networkSystem = networkSystem;
        this.isNetworkControlled = isNetworkControlled;

        // Reset last sent position
        if (networkSystem && !isNetworkControlled) {
            this.lastSentPosition = { x: this.x, y: this.y };
            // If this is a local player in network mode, send initial position
            this.sendPositionUpdate(true);
        }
    }

    /**
     * Updates player movement based on input
     * For local players only (not network controlled)
     */
    public updateMovement(cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined): void {
        // Don't process movement for network-controlled players
        if (this.isNetworkControlled) return;

        if (!this.body) {
            return;
        }

        const body = this.body as Phaser.Physics.Arcade.Body;
        let inputTargetVelocityX = 0;
        let inputTargetVelocityY = 0;

        // Check for pressed keys (Arrow keys OR WASD)
        const leftPressed = (cursors?.left.isDown || this.keyA?.isDown) ?? false;
        const rightPressed = (cursors?.right.isDown || this.keyD?.isDown) ?? false;
        const upPressed = (cursors?.up.isDown || this.keyW?.isDown) ?? false;
        const downPressed = (cursors?.down.isDown || this.keyS?.isDown) ?? false;

        if (leftPressed) {
            inputTargetVelocityX = -this.maxSpeed;
            this.setFlipX(true); // Face left
        } else if (rightPressed) {
            inputTargetVelocityX = this.maxSpeed;
            this.setFlipX(false); // Face right
        }
        // If no horizontal movement input, flipX remains as is (allowing auto-shoot to control it)

        if (upPressed) {
            inputTargetVelocityY = -this.maxSpeed;
        } else if (downPressed) {
            inputTargetVelocityY = this.maxSpeed;
        }

        // Normalize diagonal speed for input target
        if (inputTargetVelocityX !== 0 && inputTargetVelocityY !== 0) {
            const diagonalFactor = Math.sqrt(0.5);
            inputTargetVelocityX *= diagonalFactor;
            inputTargetVelocityY *= diagonalFactor;
        }

        // Smoothly interpolate current velocity towards target velocity
        // Use accelerationFactor if there's input, otherwise use decelerationFactor
        const horizontalInputActive = leftPressed || rightPressed;
        const xFactor = (inputTargetVelocityX !== 0 || horizontalInputActive) ? this.accelerationFactor : this.decelerationFactor;
        body.velocity.x = Phaser.Math.Linear(body.velocity.x, inputTargetVelocityX, xFactor);

        const verticalInputActive = upPressed || downPressed;
        const yFactor = (inputTargetVelocityY !== 0 || verticalInputActive) ? this.accelerationFactor : this.decelerationFactor;
        body.velocity.y = Phaser.Math.Linear(body.velocity.y, inputTargetVelocityY, yFactor);

        // If very close to zero, set velocity to zero to prevent endless drifting
        const stopThreshold = 1;
        if (Math.abs(body.velocity.x) < stopThreshold && inputTargetVelocityX === 0 && !horizontalInputActive) {
            body.velocity.x = 0;
        }
        if (Math.abs(body.velocity.y) < stopThreshold && inputTargetVelocityY === 0 && !verticalInputActive) {
            body.velocity.y = 0;
        }

        // Send position update if connected to network and position has changed significantly
        this.checkAndSendPositionUpdate();
    }

    /**
     * Updates the player's position from network data (for remote players)
     */
    public updateFromNetwork(x: number, y: number): void {
        if (!this.isNetworkControlled) return;

        // For remote players, directly set position
        this.x = x;
        this.y = y;

        // If using physics, update body position too
        if (this.body instanceof Phaser.Physics.Arcade.Body) {
            this.body.x = x;
            this.body.y = y;
        }
    }

    /**
     * Checks if position has changed enough to send an update
     */
    private checkAndSendPositionUpdate(): void {
        if (!this.networkSystem || this.isNetworkControlled) return;

        const currentTime = this.scene.time.now;
        if (currentTime - this.lastPositionUpdateTime < this.positionUpdateDelay) return;

        const dx = Math.abs(this.x - this.lastSentPosition.x);
        const dy = Math.abs(this.y - this.lastSentPosition.y);

        if (dx > POSITION_UPDATE_THRESHOLD || dy > POSITION_UPDATE_THRESHOLD) {
            this.sendPositionUpdate();
            this.lastPositionUpdateTime = currentTime;
        }
    }

    /**
     * Sends current position to the server
     */
    private sendPositionUpdate(force = false): void {
        if (!this.networkSystem || this.isNetworkControlled) return;

        // Only send if position has changed or force is true
        if (force ||
            this.x !== this.lastSentPosition.x ||
            this.y !== this.lastSentPosition.y) {

            // Round positions to reduce network traffic
            const roundedX = Math.round(this.x * 100) / 100;
            const roundedY = Math.round(this.y * 100) / 100;

            this.networkSystem.sendPositionUpdate(roundedX, roundedY);
            this.lastSentPosition.x = this.x;
            this.lastSentPosition.y = this.y;
        }
    }

    // Clean up resources when destroyed
    destroy(fromScene?: boolean): void {
        if (this.shootingTimer) {
            this.shootingTimer.destroy();
            this.shootingTimer = null;
        }
        // Ensure scene context still exists before trying to remove listeners
        if (this.scene) {
            this.scene.events.off('playerStatsUpdated', this.updateStats, this); // Clean up listener
        }
        super.destroy(fromScene);
    }
} 