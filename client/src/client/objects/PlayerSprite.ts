import Phaser from 'phaser';
import { EntitySprite } from './EntitySprite'
import type { EnemySprite } from './EnemySprite';
import { type IPlayerStats, DEFAULT_PLAYER_STATS } from '../../common/PlayerStats';
import type NetworkSystem from '../systems/NetworkSystem'
import type { NetworkAware } from '../types/multiplayer';
import type { ParticleSystem } from '../systems/ParticleSystem';

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

    constructor(scene: Phaser.Scene, x: number, y: number, playerId: string, particleSystem?: ParticleSystem) {
        const randomSpriteKey = Phaser.Math.RND.pick(CHARACTER_SPRITE_KEYS);

        super(scene, x, y, randomSpriteKey, playerId,
            DEFAULT_PLAYER_STATS.maxHealth, 
            DEFAULT_PLAYER_STATS.movementSpeed, 
            DEFAULT_PLAYER_STATS.defense, // Pass defense to EntitySprite constructor
            particleSystem 
            );
        this.playerId = playerId; 
        this.dashCooldown = 0; 
        this.accelerationFactor = 0.1; 
        this.decelerationFactor = 0.1; 

        // Further initialize baseStats with player-specific defaults from PlayerStats.ts
        // EntitySprite constructor already sets defaults for attackCooldown, projectileDamage, projectileSpeed.
        // We override them here for the player specifically.
        this.baseStats.attackCooldown = DEFAULT_PLAYER_STATS.attackSpeed;
        this.baseStats.projectileDamage = DEFAULT_PLAYER_STATS.projectileDamage;
        this.baseStats.projectileSpeed = DEFAULT_PLAYER_STATS.projectileSpeed;
        this.baseStats.projectileSize = DEFAULT_PLAYER_STATS.projectileSize; // New stat
        // Add other player-specific base stats if any, e.g., this.baseStats.pickupRadius = X;

        if (this.body instanceof Phaser.Physics.Arcade.Body) {
            const offsetX = (PLAYER_WIDTH - PLAYER_PHYSICS_WIDTH) / 2;
            const offsetY = (PLAYER_HEIGHT - PLAYER_PHYSICS_HEIGHT) / 2;
            this.body.setSize(PLAYER_PHYSICS_WIDTH, PLAYER_PHYSICS_HEIGHT);
            this.body.setOffset(offsetX, offsetY);
        }

        // Removed direct assignments like this.projectileDamage, this.shootCooldown etc.
        // They are now managed by baseStats and currentStats via EntitySprite.

        this.initAutoShooting();

        if (scene.input.keyboard) {
            this.keyW = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
            this.keyA = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
            this.keyS = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
            this.keyD = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
        } else {
            console.warn('PlayerSprite: Keyboard input system not available in the scene. WASD keys will not work.');
        }

        this.scene.events.on('playerStatsUpdated', this.updateStats, this);
        this.playerPhysicsHeight = PLAYER_PHYSICS_HEIGHT; 

        this.recalculateStats(); // Important: Calculate currentStats after all baseStats are set.
    }

    public updateStats(newStats: IPlayerStats): void {
        // Store previous maxHp to see if we need to heal
        const previousMaxHp = this.baseStats.maxHp;

        this.baseStats.maxSpeed = newStats.movementSpeed;
        this.baseStats.projectileSpeed = newStats.projectileSpeed;
        this.baseStats.projectileDamage = newStats.projectileDamage;
        this.baseStats.projectileSize = newStats.projectileSize; 
        this.baseStats.defense = newStats.defense;
        this.baseStats.maxHp = newStats.maxHealth;

        let newAttackSpeedValue = newStats.attackSpeed;
        if (newAttackSpeedValue < MINIMUM_SHOOT_COOLDOWN_MS) {
            console.warn(`PlayerSprite: attackSpeed ${newAttackSpeedValue}ms too low, clamping to ${MINIMUM_SHOOT_COOLDOWN_MS}ms`);
            newAttackSpeedValue = MINIMUM_SHOOT_COOLDOWN_MS;
        }
        
        const attackCooldownChanged = this.baseStats.attackCooldown !== newAttackSpeedValue;
        this.baseStats.attackCooldown = newAttackSpeedValue;

        this.recalculateStats(); // Recalculate currentStats based on new baseStats

        // If maxHp increased, heal the player to the new maxHp
        // Also handles the initial case where hp might not be at max after recalculateStats
        if (this.baseStats.maxHp > previousMaxHp || this.currentStats.hp < this.currentStats.maxHp) {
             // Heal to full if maxHP increased or current HP is less than current maxHP for any other reason.
            this.currentStats.hp = this.currentStats.maxHp; 
        }
        // Ensure health bar reflects the (potentially) new HP value immediately after healing
        this.updateHealthBar(); 

        if (attackCooldownChanged) {
            if (this.shootingTimer) {
                this.shootingTimer.destroy(); 
            }
            this.initAutoShooting(); 
        }
    }

    public getProjectileScale(): number {
        return this.currentStats.projectileSize ?? 1.0;
    }

    // Initialize auto-shooting system
    private initAutoShooting(): void {
        if (this.shootingTimer) {
            this.shootingTimer.destroy();
        }
        this.shootingTimer = this.scene.time.addEvent({
            delay: this.currentStats.attackCooldown || DEFAULT_PLAYER_STATS.attackSpeed,
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
        if (this.isNetworkControlled) return;
        if (!this.body) return;

        const body = this.body as Phaser.Physics.Arcade.Body;
        const speed = this.currentStats.maxSpeed || DEFAULT_PLAYER_STATS.movementSpeed; // Use currentStats

        let targetVelocityX = 0;
        let targetVelocityY = 0;

        // WASD keys for movement
        const upPressed = this.keyW?.isDown;
        const downPressed = this.keyS?.isDown;
        const leftPressed = this.keyA?.isDown;
        const rightPressed = this.keyD?.isDown;

        if (leftPressed) {
            targetVelocityX = -speed;
            this.setFlipX(true);
        } else if (rightPressed) {
            targetVelocityX = speed;
            this.setFlipX(false);
        }

        if (upPressed) {
            targetVelocityY = -speed;
        } else if (downPressed) {
            targetVelocityY = speed;
        }

        // Diagonal movement normalization (optional but good for fairness)
        if (targetVelocityX !== 0 && targetVelocityY !== 0) {
            targetVelocityX *= Math.sqrt(0.5);
            targetVelocityY *= Math.sqrt(0.5);
        }

        // Apply acceleration/deceleration for smoother movement
        body.setVelocityX(Phaser.Math.Linear(body.velocity.x, targetVelocityX, this.accelerationFactor));
        body.setVelocityY(Phaser.Math.Linear(body.velocity.y, targetVelocityY, this.accelerationFactor));

        // Dash logic (Space key)
        const spaceJustDown = Phaser.Input.Keyboard.JustDown(cursors?.space as Phaser.Input.Keyboard.Key);
        const currentTime = this.scene.time.now;

        if (this.isDashing) {
            if (currentTime >= this.dashEndTime) {
                this.isDashing = false;
                // Speed is already being managed by the setVelocityX/Y above, will naturally return to normal.
            }
        } else if (spaceJustDown && currentTime > this.lastDashTime + PLAYER_DASH_COOLDOWN) {
            this.isDashing = true;
            this.dashEndTime = currentTime + PLAYER_DASH_DURATION;
            this.lastDashTime = currentTime;

            const dashSpeed = speed * PLAYER_DASH_SPEED_MULTIPLIER;
            let dashDirectionX = 0;
            let dashDirectionY = 0;

            if (targetVelocityX !== 0 || targetVelocityY !== 0) {
                // Dash in the direction of current movement input
                const mag = Math.sqrt(targetVelocityX * targetVelocityX + targetVelocityY * targetVelocityY);
                dashDirectionX = (targetVelocityX / mag) * dashSpeed;
                dashDirectionY = (targetVelocityY / mag) * dashSpeed;
            } else {
                // Dash in the direction player is facing if no movement input
                dashDirectionX = (this.flipX ? -1 : 1) * dashSpeed;
            }
            body.setVelocity(dashDirectionX, dashDirectionY);
            
            if (this.particleSystem) {
                this.particleSystem.playDashEffect(this.x, this.y, this.flipX ? -1 : 1);
            }
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