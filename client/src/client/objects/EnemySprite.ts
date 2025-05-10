import Phaser from 'phaser';
import { EntitySprite } from './EntitySprite';
import type { PlayerSprite } from './PlayerSprite';
import { ProjectileType } from './ProjectileSprite'; // For defining enemy projectile types
import type ProjectileSprite from './ProjectileSprite'; // Import the class for type usage
import type { ParticleSystem } from '../systems/ParticleSystem'; // Added import
import ENEMY_DEFINITIONS from '../definitions/enemies.json'; // Import enemy definitions

export class EnemySprite extends EntitySprite {
    private targetPlayer: PlayerSprite | null = null;
    private lastMeleeAttackTime = 0;
    public enemyType: string; // e.g., 'slime', 'goblin'
    public isRanged = false; // Initialized to false
    public xpValue = 10;
    private particleSystem?: ParticleSystem;
    private shootingTimer: Phaser.Time.TimerEvent | null = null;

    private meleeAttackDamage: number;
    private meleeAttackRange: number;
    private rangedAttackRange: number | null;

    constructor(
        scene: Phaser.Scene, 
        x: number, 
        y: number, 
        enemyId: string, 
        enemyType: string, 
        targetPlayer: PlayerSprite | null, 
        particleSystem?: ParticleSystem
    ) {
        const definition = ENEMY_DEFINITIONS.find(def => def.name === enemyType);
        if (!definition) {
            console.error(`EnemySprite: No definition found for enemyType: ${enemyType}`);
            // Fallback or throw error - for now, let's use a default or error out
            // For simplicity, we'll proceed with some defaults but this should be handled robustly
            super(scene, x, y, 'default_missing_texture', enemyId, 10, 10, 50);
            this.enemyType = enemyType;
            this.targetPlayer = targetPlayer;
            this.particleSystem = particleSystem;
            this.meleeAttackDamage = 5;
            this.meleeAttackRange = 30;
            this.rangedAttackRange = null;
            this.xpValue = 1;
            this.shootCooldown = 2000;
            return; 
        }

        const textureKey = definition.assetUrl; 
        if (!scene.textures.exists(textureKey)) {
            EnemySprite.generateEnemyTexture(scene, textureKey, enemyType, definition.width, definition.height);
        }

        super(scene, x, y, textureKey, enemyId, definition.defaultHp, definition.defaultHp, definition.defaultMaxSpeed);
        this.enemyType = enemyType;
        this.targetPlayer = targetPlayer;
        this.particleSystem = particleSystem;
        this.xpValue = definition.xpValue;

        // Set isRanged based on definition
        this.isRanged = definition.isRanged;

        // Store definition-based attack properties
        this.meleeAttackDamage = definition.meleeAttackDamage;
        this.meleeAttackRange = definition.meleeAttackRange;
        this.rangedAttackRange = definition.isRanged ? definition.rangedAttackRange : null;
        this.shootCooldown = definition.attackCooldown;

        if (this.body instanceof Phaser.Physics.Arcade.Body) {
            this.body.setSize(definition.width, definition.height);
        }

        if (definition.isRanged) {
            this.projectileType = definition.projectileType || 'BULLET'; // Assign string type from definition or default
            // Assuming projectile stats like damage, speed, lifespan might also come from definition or be base EntitySprite stats
            // For now, keep existing specific overrides for goblin/ranged as example, or abstract further
            if (enemyType === 'goblin') { // Example of specific override if needed
                this.projectileDamage = 8; 
                this.projectileSpeed = 400;
                this.projectileLifespan = 3000;
            }
            this.initAutoShooting();
        }
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

    // Automatically shoot at the player
    private attemptAutoShoot(): void {
        if (!this.active || !this.targetPlayer?.active) return;

        const distanceToPlayer = Phaser.Math.Distance.Between(this.x, this.y, this.targetPlayer.x, this.targetPlayer.y);
        
        // Attempt to shoot if within attack range
        if (this.rangedAttackRange && distanceToPlayer <= this.rangedAttackRange) {
            // Target player directly for ranged attack
            const targetPos = new Phaser.Math.Vector2(this.targetPlayer.x, this.targetPlayer.y);
            this.attemptShoot(targetPos); // attemptShoot handles its own cooldown via lastShotTime
        }
    }

    static generateEnemyTexture(scene: Phaser.Scene, textureKey: string, enemyType: string, width: number, height: number): void {
        const canvas = scene.textures.createCanvas(textureKey, width, height);
        if (!canvas) {
            console.error(`EnemySprite: Failed to create canvas texture for ${textureKey}.`);
            return;
        }
        const ctx = canvas.context;
        const W = width;
        const H = height;
        const centerX = W / 2;
        const centerY = H / 2;
        const baseRadius = Math.min(W, H) / 2.2;

        switch (enemyType) {
            case 'slime': {
                const bodyGradient = ctx.createRadialGradient(centerX - W * 0.1, centerY - H * 0.1, baseRadius * 0.2, centerX, centerY, baseRadius);
                bodyGradient.addColorStop(0, 'rgba(100, 255, 150, 0.7)');
                bodyGradient.addColorStop(1, 'rgba(0, 180, 50, 0.8)');
                ctx.fillStyle = bodyGradient;
                ctx.beginPath();
                ctx.moveTo(centerX + baseRadius, centerY);
                for (let i = 1; i <= 16; i++) {
                    const angle = (i / 16) * Math.PI * 2;
                    const radiusVariation = baseRadius * (1 + (Math.sin(angle * 3 + i) * 0.07));
                    ctx.lineTo(centerX + radiusVariation * Math.cos(angle), centerY + radiusVariation * Math.sin(angle));
                }
                ctx.closePath();
                ctx.fill();

                const highlight1Gradient = ctx.createRadialGradient(centerX - W * 0.15, centerY - H * 0.25, baseRadius * 0.05, centerX - W*0.1, centerY - H*0.1, baseRadius * 0.35);
                highlight1Gradient.addColorStop(0, 'rgba(220, 255, 220, 0.8)');
                highlight1Gradient.addColorStop(1, 'rgba(200, 255, 200, 0)');
                ctx.fillStyle = highlight1Gradient;
                ctx.beginPath();
                ctx.ellipse(centerX - W * 0.12, centerY - H * 0.18, baseRadius * 0.4, baseRadius * 0.25, Math.PI / 4, 0, Math.PI * 2);
                ctx.fill();

                const highlight2Gradient = ctx.createRadialGradient(centerX + W * 0.2, centerY - H * 0.15, baseRadius * 0.02, centerX + W*0.15, centerY - H*0.1, baseRadius * 0.2);
                highlight2Gradient.addColorStop(0, 'rgba(200, 255, 200, 0.6)');
                highlight2Gradient.addColorStop(1, 'rgba(180, 255, 180, 0)');
                ctx.fillStyle = highlight2Gradient;
                ctx.beginPath();
                ctx.ellipse(centerX + W * 0.18, centerY - H * 0.12, baseRadius * 0.25, baseRadius * 0.15, -Math.PI / 6, 0, Math.PI * 2);
                ctx.fill();

                const coreGradient = ctx.createRadialGradient(centerX + W * 0.05, centerY + H * 0.05, baseRadius * 0.1, centerX, centerY, baseRadius * 0.8);
                coreGradient.addColorStop(0, 'rgba(0, 80, 20, 0.6)');
                coreGradient.addColorStop(1, 'rgba(0, 120, 30, 0.2)');
                ctx.fillStyle = coreGradient;
                ctx.beginPath();
                ctx.arc(centerX, centerY, baseRadius * 0.75, 0, Math.PI * 2);
                ctx.fill();

                const numBubbles = 3 + Math.floor(Math.random() * 3);
                for (let i = 0; i < numBubbles; i++) {
                    const bubbleRadius = baseRadius * (0.05 + Math.random() * 0.1);
                    const angle = Math.random() * Math.PI * 2;
                    const distFromCenter = Math.random() * baseRadius * 0.5;
                    const bx = centerX + Math.cos(angle) * distFromCenter;
                    const by = centerY + Math.sin(angle) * distFromCenter;
                    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(50, 150, 80, 0.7)' : 'rgba(150, 220, 180, 0.6)';
                    ctx.beginPath();
                    ctx.arc(bx, by, bubbleRadius, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            }
            case 'goblin':
                ctx.fillStyle = '#8B4513'; // Brown for goblin
                ctx.fillRect(0, 0, W, H);
                // TODO: Add more detailed goblin texture later if needed
                break;
            default:
                ctx.fillStyle = '#FF00FF'; // Default magenta
                ctx.fillRect(0, 0, W, H);
        }
        canvas.refresh();
    }

    update(time: number, delta: number): void {
        if (!this.active || !this.targetPlayer?.active) {
            if (this.body instanceof Phaser.Physics.Arcade.Body) {
                this.body.setVelocity(0, 0);
            }
            return;
        }

        if (!this.targetPlayer) return;

        const distanceToPlayer = Phaser.Math.Distance.Between(this.x, this.y, this.targetPlayer.x, this.targetPlayer.y);
        const angleToPlayer = Phaser.Math.Angle.Between(this.x, this.y, this.targetPlayer.x, this.targetPlayer.y);

        if (this.body instanceof Phaser.Physics.Arcade.Body) {
            if (this.isRanged) {
                // Ranged enemy behavior
                if (this.rangedAttackRange && distanceToPlayer > this.rangedAttackRange * 0.8 && distanceToPlayer <= this.rangedAttackRange * 1.5) {
                    this.body.setVelocityX(Math.cos(angleToPlayer) * this.maxSpeed * 0.7);
                    this.body.setVelocityY(Math.sin(angleToPlayer) * this.maxSpeed * 0.7);
                } else if (distanceToPlayer > this.rangedAttackRange * 1.5) {
                    this.body.setVelocityX(Math.cos(angleToPlayer) * this.maxSpeed);
                    this.body.setVelocityY(Math.sin(angleToPlayer) * this.maxSpeed);
                } else {
                    this.body.setVelocity(0, 0);
                }

                // Shooting is now handled by the timer-based auto-shooting system
            } else {
                // Melee enemy behavior (original logic)
                if (distanceToPlayer > this.meleeAttackRange) {
                    // Move towards player
                    this.body.setVelocityX(Math.cos(angleToPlayer) * this.maxSpeed);
                    this.body.setVelocityY(Math.sin(angleToPlayer) * this.maxSpeed);
                } else {
                    // Close enough to attack (melee)
                    this.body.setVelocity(0, 0); // Stop moving
                    // Use separate melee attack timer
                    if (time > this.lastMeleeAttackTime + this.shootCooldown) { 
                        this.performMeleeAttack();
                        this.lastMeleeAttackTime = time;
                    }
                }
            }
        }

        // Flip sprite based on player position
        if (this.targetPlayer.x < this.x) {
            this.setFlipX(true);
        } else {
            this.setFlipX(false);
        }
    }

    private performMeleeAttack(): void {
        if (this.targetPlayer?.active) {
            this.targetPlayer.takeDamage(this.meleeAttackDamage, this);
        }
    }

    // Override the die method from EntitySprite
    protected override die(killer?: EntitySprite | ProjectileSprite | string): void {
        // Play enemy death particle effect
        if (this.particleSystem) {
            this.particleSystem.playEnemyDeath(this.x, this.y);
        }
        
        // Clean up resources when destroyed
        if (this.shootingTimer) {
            this.shootingTimer.destroy();
            this.shootingTimer = null;
        }

        super.die(killer);
    }
    
    // Clean up resources when destroyed
    destroy(fromScene?: boolean): void {
        if (this.shootingTimer) {
            this.shootingTimer.destroy();
            this.shootingTimer = null;
        }
        super.destroy(fromScene);
    }
} 