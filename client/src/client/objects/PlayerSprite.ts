import Phaser from 'phaser';
import { EntitySprite } from './EntitySprite'
import type { EnemySprite } from './EnemySprite';
import { type IPlayerStats, DEFAULT_PLAYER_STATS } from '../../common/PlayerStats';
import type NetworkSystem from '../systems/NetworkSystem'
import type { NetworkAware } from '../types/multiplayer';

const PLAYER_WIZARD_TEXTURE_KEY = 'player_wizard_texture';
const PLAYER_WIDTH = 48;
const PLAYER_HEIGHT = 72;

// Define dedicated physics size, smaller than visual texture
const PLAYER_PHYSICS_WIDTH = 32;
const PLAYER_PHYSICS_HEIGHT = 48;

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
        // Generate texture if it doesn't exist
        if (!scene.textures.exists(PLAYER_WIZARD_TEXTURE_KEY)) {
            PlayerSprite.generatePlayerTexture(scene);
        }

        // Initialize with default stats that will be soon updated by ProgressionSystem
        super(scene, x, y, PLAYER_WIZARD_TEXTURE_KEY, playerId,
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
    public setNetworkMode(networkSystem: NetworkSystem | null, isNetworkControlled: boolean = false): void {
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
        } else if (rightPressed) {
            inputTargetVelocityX = this.maxSpeed;
        }

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
    private sendPositionUpdate(force: boolean = false): void {
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

    static generatePlayerTexture(scene: Phaser.Scene): void {
        const canvas = scene.textures.createCanvas(PLAYER_WIZARD_TEXTURE_KEY, PLAYER_WIDTH, PLAYER_HEIGHT);
        if (!canvas) {
            console.error('PlayerSprite: Failed to create canvas texture for player.');
            return;
        }
        const ctx = canvas.context;

        // Robe base
        ctx.fillStyle = '#3A4D8F'; // Dark blue
        ctx.beginPath();
        // More detailed robe shape
        ctx.moveTo(PLAYER_WIDTH * 0.2, PLAYER_HEIGHT * 0.35); // Start a bit lower for neck
        ctx.lineTo(PLAYER_WIDTH * 0.1, PLAYER_HEIGHT * 0.4);  // Left shoulder
        ctx.quadraticCurveTo(PLAYER_WIDTH * 0.05, PLAYER_HEIGHT * 0.7, PLAYER_WIDTH * 0.15, PLAYER_HEIGHT * 0.95); // Left sleeve opening
        ctx.lineTo(PLAYER_WIDTH * 0.2, PLAYER_HEIGHT); // Bottom left
        ctx.lineTo(PLAYER_WIDTH * 0.8, PLAYER_HEIGHT); // Bottom right
        ctx.lineTo(PLAYER_WIDTH * 0.85, PLAYER_HEIGHT * 0.95); // Right sleeve opening
        ctx.quadraticCurveTo(PLAYER_WIDTH * 0.95, PLAYER_HEIGHT * 0.7, PLAYER_WIDTH * 0.9, PLAYER_HEIGHT * 0.4); // Right shoulder
        ctx.lineTo(PLAYER_WIDTH * 0.8, PLAYER_HEIGHT * 0.35); // Back to top right
        ctx.closePath();
        ctx.fill();

        // Robe shading - attempt at more subtle folds
        ctx.fillStyle = '#2A3B6D'; // Darker blue for shading

        // Left side shading (simulating a fold or shadow)
        ctx.beginPath();
        ctx.moveTo(PLAYER_WIDTH * 0.25, PLAYER_HEIGHT * 0.4);
        ctx.quadraticCurveTo(PLAYER_WIDTH * 0.2, PLAYER_HEIGHT * 0.7, PLAYER_WIDTH * 0.3, PLAYER_HEIGHT * 0.95);
        ctx.lineTo(PLAYER_WIDTH * 0.35, PLAYER_HEIGHT * 0.95);
        ctx.quadraticCurveTo(PLAYER_WIDTH * 0.3, PLAYER_HEIGHT * 0.65, PLAYER_WIDTH * 0.3, PLAYER_HEIGHT * 0.4);
        ctx.closePath();
        ctx.fill();

        // Right side shading
        ctx.beginPath();
        ctx.moveTo(PLAYER_WIDTH * 0.75, PLAYER_HEIGHT * 0.4);
        ctx.quadraticCurveTo(PLAYER_WIDTH * 0.8, PLAYER_HEIGHT * 0.7, PLAYER_WIDTH * 0.7, PLAYER_HEIGHT * 0.95);
        ctx.lineTo(PLAYER_WIDTH * 0.65, PLAYER_HEIGHT * 0.95);
        ctx.quadraticCurveTo(PLAYER_WIDTH * 0.7, PLAYER_HEIGHT * 0.65, PLAYER_WIDTH * 0.7, PLAYER_HEIGHT * 0.4);
        ctx.closePath();
        ctx.fill();

        // Central deeper shadow
        ctx.fillStyle = '#1F2C57'; // Even darker blue
        ctx.beginPath();
        ctx.moveTo(PLAYER_WIDTH * 0.45, PLAYER_HEIGHT * 0.35);
        ctx.quadraticCurveTo(PLAYER_WIDTH * 0.4, PLAYER_HEIGHT * 0.6, PLAYER_WIDTH * 0.45, PLAYER_HEIGHT * 0.98);
        ctx.lineTo(PLAYER_WIDTH * 0.55, PLAYER_HEIGHT * 0.98);
        ctx.quadraticCurveTo(PLAYER_WIDTH * 0.6, PLAYER_HEIGHT * 0.6, PLAYER_WIDTH * 0.55, PLAYER_HEIGHT * 0.35);
        ctx.closePath();
        ctx.fill();

        // Head - slightly more defined shape
        ctx.fillStyle = '#F0DBC1'; // Light skin tone
        ctx.beginPath();
        // Slightly larger head for better face visibility
        ctx.arc(PLAYER_WIDTH / 2, PLAYER_HEIGHT * 0.25, PLAYER_WIDTH * 0.17, 0, Math.PI * 2);
        ctx.fill();

        // Eyes (simple dots, slightly larger)
        ctx.fillStyle = '#222222'; // Dark color for eyes
        ctx.beginPath();
        ctx.arc(PLAYER_WIDTH * 0.44, PLAYER_HEIGHT * 0.24, PLAYER_WIDTH * 0.03, 0, Math.PI * 2); // Left eye
        ctx.arc(PLAYER_WIDTH * 0.56, PLAYER_HEIGHT * 0.24, PLAYER_WIDTH * 0.03, 0, Math.PI * 2); // Right eye
        ctx.fill();

        // Nose (subtle shading, slightly more prominent)
        ctx.fillStyle = '#D8C3A9'; // Darker skin tone for nose/shading
        ctx.beginPath();
        ctx.moveTo(PLAYER_WIDTH * 0.47, PLAYER_HEIGHT * 0.26);
        ctx.lineTo(PLAYER_WIDTH * 0.53, PLAYER_HEIGHT * 0.26);
        ctx.lineTo(PLAYER_WIDTH * 0.50, PLAYER_HEIGHT * 0.29);
        ctx.closePath();
        ctx.fill();

        // Face shading (cheek emphasis)
        ctx.fillStyle = '#D8C3A9'; // Darker skin tone
        ctx.beginPath();
        ctx.arc(PLAYER_WIDTH * 0.55, PLAYER_HEIGHT * 0.25, PLAYER_WIDTH * 0.08, 0, Math.PI * 2);
        ctx.fill();

        // Hat base - aiming for a more traditional pointy wizard hat
        ctx.fillStyle = '#6A0DAD'; // Purple

        // Brim - more elliptical and consistent
        ctx.beginPath();
        ctx.ellipse(PLAYER_WIDTH / 2, PLAYER_HEIGHT * 0.23, PLAYER_WIDTH * 0.35, PLAYER_HEIGHT * 0.05, 0, 0, Math.PI * 2);
        ctx.fill();

        // Hat cone - sharper point
        ctx.beginPath();
        ctx.moveTo(PLAYER_WIDTH * 0.3, PLAYER_HEIGHT * 0.22); // Left base of cone
        ctx.lineTo(PLAYER_WIDTH * 0.5, PLAYER_HEIGHT * -0.05); // Point of the hat (higher for sharper point)
        ctx.lineTo(PLAYER_WIDTH * 0.7, PLAYER_HEIGHT * 0.22); // Right base of cone
        ctx.closePath();
        ctx.fill();

        // Hat band
        ctx.fillStyle = '#4A0B77'; // Darker purple for band and shading
        // Adjust band to fit new brim shape
        const bandHeight = PLAYER_HEIGHT * 0.03;
        const bandY = PLAYER_HEIGHT * 0.23 - bandHeight / 2; // Center on the brim edge
        ctx.fillRect(PLAYER_WIDTH * 0.25, bandY, PLAYER_WIDTH * 0.5, bandHeight);

        // Hat shading on the cone - simplified for a conical shape
        ctx.beginPath();
        ctx.moveTo(PLAYER_WIDTH * 0.5, PLAYER_HEIGHT * -0.05); // Tip of the hat
        ctx.lineTo(PLAYER_WIDTH * 0.3, PLAYER_HEIGHT * 0.22); // Bottom-left of cone
        ctx.lineTo(PLAYER_WIDTH * 0.4, PLAYER_HEIGHT * 0.22); // Create a sliver for shading on one side
        ctx.closePath();
        ctx.fill();

        // Wand - making it bigger
        // Position the wand to look like it is held or emerging from the right sleeve area
        const wandX = PLAYER_WIDTH * 0.75; // Keep X position, or adjust slightly if needed
        const wandY = PLAYER_HEIGHT * 0.45; // Adjust Y to account for shorter beard / different pose
        const wandWidth = PLAYER_WIDTH * 0.08; // Increased width
        const wandLength = PLAYER_HEIGHT * 0.5; // Increased length

        // Wand shaft
        ctx.fillStyle = '#8B4513'; // SaddleBrown
        ctx.beginPath();
        ctx.rect(wandX, wandY, wandWidth, wandLength);
        ctx.fill();

        // Wand tip (slightly lighter or different color)
        ctx.fillStyle = '#D2B48C'; // Tan or a light magical color
        const tipHeight = PLAYER_HEIGHT * 0.05;
        ctx.beginPath();
        ctx.ellipse(wandX + wandWidth / 2, wandY + tipHeight / 2, wandWidth * 0.7, tipHeight / 2, 0, 0, Math.PI * 2); // Small sphere/orb at the tip
        // Or a simpler square tip:
        // ctx.rect(wandX - wandWidth * 0.1, wandY - tipHeight, wandWidth * 1.2, tipHeight);
        ctx.fill();

        // Beard - shorter and slightly less wide to show more face
        ctx.fillStyle = '#AAAAAA'; // Grey
        ctx.beginPath();
        // Adjust curves for a shorter, less voluminous beard
        ctx.moveTo(PLAYER_WIDTH * 0.35, PLAYER_HEIGHT * 0.28); // Start a bit narrower
        ctx.quadraticCurveTo(PLAYER_WIDTH * 0.3, PLAYER_HEIGHT * 0.4, PLAYER_WIDTH * 0.4, PLAYER_HEIGHT * 0.45); // Shorter left curve
        ctx.quadraticCurveTo(PLAYER_WIDTH * 0.5, PLAYER_HEIGHT * 0.5, PLAYER_WIDTH * 0.6, PLAYER_HEIGHT * 0.45); // Shorter bottom curve
        ctx.quadraticCurveTo(PLAYER_WIDTH * 0.7, PLAYER_HEIGHT * 0.4, PLAYER_WIDTH * 0.65, PLAYER_HEIGHT * 0.28); // Shorter right curve
        ctx.closePath();
        ctx.fill();

        // Beard highlights - adjust to shorter beard
        ctx.fillStyle = '#CCCCCC'; // Lighter grey
        // Strand 1 (left)
        ctx.beginPath();
        ctx.moveTo(PLAYER_WIDTH * 0.40, PLAYER_HEIGHT * 0.3);
        ctx.quadraticCurveTo(PLAYER_WIDTH * 0.42, PLAYER_HEIGHT * 0.4, PLAYER_WIDTH * 0.42, PLAYER_HEIGHT * 0.42);
        ctx.quadraticCurveTo(PLAYER_WIDTH * 0.45, PLAYER_HEIGHT * 0.38, PLAYER_WIDTH * 0.44, PLAYER_HEIGHT * 0.3);
        ctx.closePath();
        ctx.fill();

        // Strand 2 (center)
        ctx.beginPath();
        ctx.moveTo(PLAYER_WIDTH * 0.48, PLAYER_HEIGHT * 0.32);
        ctx.quadraticCurveTo(PLAYER_WIDTH * 0.5, PLAYER_HEIGHT * 0.43, PLAYER_WIDTH * 0.52, PLAYER_HEIGHT * 0.42);
        ctx.quadraticCurveTo(PLAYER_WIDTH * 0.55, PLAYER_HEIGHT * 0.40, PLAYER_WIDTH * 0.5, PLAYER_HEIGHT * 0.32);
        ctx.closePath();
        ctx.fill();

        // Strand 3 (right)
        ctx.beginPath();
        ctx.moveTo(PLAYER_WIDTH * 0.56, PLAYER_HEIGHT * 0.3);
        ctx.quadraticCurveTo(PLAYER_WIDTH * 0.58, PLAYER_HEIGHT * 0.4, PLAYER_WIDTH * 0.58, PLAYER_HEIGHT * 0.42);
        ctx.quadraticCurveTo(PLAYER_WIDTH * 0.55, PLAYER_HEIGHT * 0.38, PLAYER_WIDTH * 0.54, PLAYER_HEIGHT * 0.3);
        ctx.closePath();
        ctx.fill();

        canvas.refresh();
    }

    // update(time: number, delta: number): void {
    // Movement and other updates will be handled by PredictionSystem or game scene
    // }
} 