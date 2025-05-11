import Phaser from 'phaser';
import { EntitySprite } from './EntitySprite';
import type { PlayerSprite } from './PlayerSprite';
import { ProjectileType } from './ProjectileSprite'; // For defining enemy projectile types
import type ProjectileSprite from './ProjectileSprite'; // Import the class for type usage
import type { ParticleSystem } from '../systems/ParticleSystem'; // Added import
import ENEMY_DEFINITIONS from '../definitions/enemies.json'; // Import enemy definitions

const ENEMY_SPRITE_KEYS: string[] = [];
for (let i = 1; i <= 36; i++) {
    ENEMY_SPRITE_KEYS.push(`enemy_${i}`);
}

export class EnemySprite extends EntitySprite {
    private targetPlayer: PlayerSprite | null = null;
    private lastMeleeAttackTime = 0;
    public enemyType: string; // e.g., 'patrol_cop', 'security_guard', etc.
    public isRanged = false; // Initialized to false
    public xpValue = 10;
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
            console.error(`EnemySprite: No definition found for enemyType: ${enemyType}. Using fallback texture.`);
            super(scene, x, y, 'default_missing_texture', enemyId, 10, 10, 50, particleSystem);
            this.enemyType = enemyType;
            this.targetPlayer = targetPlayer;
            this.meleeAttackDamage = 5;
            this.meleeAttackRange = 30;
            this.rangedAttackRange = null;
            this.xpValue = 1;
            this.shootCooldown = 2000;
            return; 
        }

        const textureKey = definition.assetUrl; // This is now the ID string, e.g., "1"

        if (!textureKey) {
            console.error(`EnemySprite: No assetUrl (textureKey) found for enemyType: ${enemyType}. Using fallback texture.`);
            super(scene, x, y, 'default_missing_texture', enemyId, definition.defaultHp, definition.defaultHp, definition.defaultMaxSpeed, particleSystem);
            this.enemyType = enemyType;
            this.targetPlayer = targetPlayer;
            this.xpValue = definition.xpValue;
            this.meleeAttackDamage = definition.meleeAttackDamage;
            this.meleeAttackRange = definition.meleeAttackRange;
            this.rangedAttackRange = definition.isRanged ? definition.rangedAttackRange : null;
            this.shootCooldown = definition.attackCooldown;
            if (this.body instanceof Phaser.Physics.Arcade.Body) {
                this.body.setSize(definition.width, definition.height);
            }
            return;
        }

        if (!scene.textures.exists(textureKey)) {
            console.warn(`EnemySprite: Texture key '${textureKey}' not loaded for enemyType '${enemyType}'. Check GameScene preload. Using fallback texture.`);
            super(scene, x, y, 'default_missing_texture', enemyId, definition.defaultHp, definition.defaultHp, definition.defaultMaxSpeed, particleSystem);
        } else {
            super(scene, x, y, textureKey, enemyId, definition.defaultHp, definition.defaultHp, definition.defaultMaxSpeed, particleSystem);
        }
        
        this.enemyType = enemyType;
        this.targetPlayer = targetPlayer;
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
        this.playerPhysicsHeight = definition.height; // Set physics height from definition

        if (definition.isRanged) {
            // Convert string projectile type to enum
            if (definition.projectileType) {
                const projectileTypeKey = definition.projectileType as keyof typeof ProjectileType;
                if (ProjectileType[projectileTypeKey]) {
                    this.projectileType = definition.projectileType;
                } else {
                    console.warn(`Unknown projectile type '${definition.projectileType}' for enemy '${enemyType}', defaulting to BULLET`);
                    this.projectileType = 'BULLET';
                }
            } else {
                this.projectileType = 'BULLET'; // Default
            }
            
            // Apply enemy-specific projectile properties if needed
            switch(enemyType) {
                case 'caffeine_rookie':
                    this.projectileDamage = 10;
                    this.projectileSpeed = 450; // Faster than average
                    this.projectileLifespan = 2500;
                    break;
                case 'security_guard':
                    this.projectileDamage = 15;
                    this.projectileSpeed = 250; // Slower but more damage
                    this.projectileLifespan = 1000; // Shorter range
                    break;
                case 'janitor':
                    this.projectileDamage = 8;
                    this.projectileSpeed = 200; // Slow puddles
                    this.projectileLifespan = 2000;
                    break;
                case 'needle_dealer':
                    this.projectileDamage = 12;
                    this.projectileSpeed = 350;
                    this.projectileLifespan = 1800;
                    break;
                case 'street_arsonist':
                    this.projectileDamage = 18;
                    this.projectileSpeed = 300;
                    this.projectileLifespan = 1200;
                    break;
                case 'meter_maid':
                    this.projectileDamage = 10;
                    this.projectileSpeed = 280;
                    this.projectileLifespan = 1500;
                    break;
                case 'street_preacher':
                    this.projectileDamage = 14;
                    this.projectileSpeed = 240;
                    this.projectileLifespan = 1200;
                    break;
                case 'off_duty_cop':
                    this.projectileDamage = 22;
                    this.projectileSpeed = 500; // Very fast taser
                    this.projectileLifespan = 1000;
                    break;
                default:
                    // Use default values from the parent class
                    break;
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
            // Apply enemy-specific behavior based on type
            switch (this.enemyType) {
                case 'caffeine_rookie':
                    // Erratic movement, speeds up after misses
                    if (time % 1000 < 500) {
                        const jitterAngle = angleToPlayer + (Math.random() * 0.5 - 0.25);
                        this.body.setVelocityX(Math.cos(jitterAngle) * this.maxSpeed * 1.2);
                        this.body.setVelocityY(Math.sin(jitterAngle) * this.maxSpeed * 1.2);
                    } else {
                        this.body.setVelocityX(Math.cos(angleToPlayer) * this.maxSpeed);
                        this.body.setVelocityY(Math.sin(angleToPlayer) * this.maxSpeed);
                    }
                    break;
                    
                case 'tax_man':
                    // Moves slower but deals more damage
                    if (distanceToPlayer > this.meleeAttackRange) {
                        this.body.setVelocityX(Math.cos(angleToPlayer) * this.maxSpeed * 0.8);
                        this.body.setVelocityY(Math.sin(angleToPlayer) * this.maxSpeed * 0.8);
                    } else {
                        this.body.setVelocity(0, 0);
                        if (time > this.lastMeleeAttackTime + this.shootCooldown) { 
                            this.performMeleeAttack();
                            this.lastMeleeAttackTime = time;
                        }
                    }
                    break;
                    
                case 'repo_agent':
                    // Tries to hook player and drag them
                    if (distanceToPlayer > this.meleeAttackRange * 1.5) {
                        this.body.setVelocityX(Math.cos(angleToPlayer) * this.maxSpeed * 1.1);
                        this.body.setVelocityY(Math.sin(angleToPlayer) * this.maxSpeed * 1.1);
                    } else if (distanceToPlayer > this.meleeAttackRange) {
                        this.body.setVelocityX(Math.cos(angleToPlayer) * this.maxSpeed * 0.5);
                        this.body.setVelocityY(Math.sin(angleToPlayer) * this.maxSpeed * 0.5);
                    } else {
                        this.body.setVelocity(0, 0);
                        if (time > this.lastMeleeAttackTime + this.shootCooldown) { 
                            this.performMeleeAttack();
                            this.lastMeleeAttackTime = time;
                        }
                    }
                    break;
                    
                case 'guard_dog':
                    // Very fast movement
                    if (distanceToPlayer > this.meleeAttackRange) {
                        this.body.setVelocityX(Math.cos(angleToPlayer) * this.maxSpeed * 1.3);
                        this.body.setVelocityY(Math.sin(angleToPlayer) * this.maxSpeed * 1.3);
                    } else {
                        this.body.setVelocity(0, 0);
                        if (time > this.lastMeleeAttackTime + this.shootCooldown) { 
                            this.performMeleeAttack();
                            this.lastMeleeAttackTime = time;
                        }
                    }
                    break;
                    
                case 'bouncer':
                    // Slow but powerful
                    if (distanceToPlayer > this.meleeAttackRange * 1.2) {
                        this.body.setVelocityX(Math.cos(angleToPlayer) * this.maxSpeed * 0.7);
                        this.body.setVelocityY(Math.sin(angleToPlayer) * this.maxSpeed * 0.7);
                    } else {
                        this.body.setVelocity(0, 0);
                        if (time > this.lastMeleeAttackTime + this.shootCooldown) { 
                            this.performMeleeAttack();
                            this.lastMeleeAttackTime = time;
                        }
                    }
                    break;
                    
                case 'court_runner':
                    // Very fast, tries to tag player and then runs away briefly
                    if (distanceToPlayer > this.meleeAttackRange) {
                        // Run toward player at high speed
                        this.body.setVelocityX(Math.cos(angleToPlayer) * this.maxSpeed * 1.4);
                        this.body.setVelocityY(Math.sin(angleToPlayer) * this.maxSpeed * 1.4);
                    } else {
                        // After attack, run away briefly
                        if (time > this.lastMeleeAttackTime + this.shootCooldown) { 
                            this.performMeleeAttack();
                            this.lastMeleeAttackTime = time;
                            
                            // Run away after attacking
                            this.body.setVelocityX(-Math.cos(angleToPlayer) * this.maxSpeed);
                            this.body.setVelocityY(-Math.sin(angleToPlayer) * this.maxSpeed);
                        } else {
                            // Stay still briefly after attack
                            this.body.setVelocity(0, 0);
                        }
                    }
                    break;
                    
                case 'meter_maid':
                    // Keeps medium distance and shoots tickets
                    if (this.rangedAttackRange && distanceToPlayer < this.rangedAttackRange * 0.6) {
                        // Too close, back away
                        this.body.setVelocityX(-Math.cos(angleToPlayer) * this.maxSpeed * 0.8);
                        this.body.setVelocityY(-Math.sin(angleToPlayer) * this.maxSpeed * 0.8);
                    } else if (this.rangedAttackRange && distanceToPlayer > this.rangedAttackRange * 0.9) {
                        // Too far, approach
                        this.body.setVelocityX(Math.cos(angleToPlayer) * this.maxSpeed * 0.6);
                        this.body.setVelocityY(Math.sin(angleToPlayer) * this.maxSpeed * 0.6);
                    } else {
                        // In ideal range, stay still to shoot
                        this.body.setVelocity(0, 0);
                    }
                    break;
                    
                case 'street_preacher':
                    // Slow but long range shouts
                    if (this.rangedAttackRange && distanceToPlayer < this.rangedAttackRange * 0.5) {
                        // Too close, back away
                        this.body.setVelocityX(-Math.cos(angleToPlayer) * this.maxSpeed * 0.9);
                        this.body.setVelocityY(-Math.sin(angleToPlayer) * this.maxSpeed * 0.9);
                    } else if (this.rangedAttackRange && distanceToPlayer > this.rangedAttackRange * 0.9) {
                        // Too far, approach
                        this.body.setVelocityX(Math.cos(angleToPlayer) * this.maxSpeed * 0.7);
                        this.body.setVelocityY(Math.sin(angleToPlayer) * this.maxSpeed * 0.7);
                    } else {
                        // In ideal range, stay still to shoot
                        this.body.setVelocity(0, 0);
                    }
                    break;
                    
                case 'off_duty_cop':
                    // Strategic movement, maintains medium distance
                    if (this.rangedAttackRange && distanceToPlayer > this.rangedAttackRange * 0.8) {
                        // Approach at medium speed
                        this.body.setVelocityX(Math.cos(angleToPlayer) * this.maxSpeed * 0.9);
                        this.body.setVelocityY(Math.sin(angleToPlayer) * this.maxSpeed * 0.9);
                    } else if (this.rangedAttackRange && distanceToPlayer < this.rangedAttackRange * 0.3) {
                        // Too close, back away quickly
                        this.body.setVelocityX(-Math.cos(angleToPlayer) * this.maxSpeed);
                        this.body.setVelocityY(-Math.sin(angleToPlayer) * this.maxSpeed);
                    } else {
                        // Strafe sideways for harder-to-hit target
                        const strafeAngle = angleToPlayer + Math.PI / 2;
                        if (time % 4000 < 2000) {
                            this.body.setVelocityX(Math.cos(strafeAngle) * this.maxSpeed * 0.6);
                            this.body.setVelocityY(Math.sin(strafeAngle) * this.maxSpeed * 0.6);
                        } else {
                            this.body.setVelocityX(Math.cos(strafeAngle) * this.maxSpeed * -0.6);
                            this.body.setVelocityY(Math.sin(strafeAngle) * this.maxSpeed * -0.6);
                        }
                    }
                    break;
                    
                default:
                    // Default behavior for other enemies
                    if (this.isRanged) {
                        // Ranged enemy behavior
                        if (this.rangedAttackRange && distanceToPlayer > this.rangedAttackRange * 0.8 && distanceToPlayer <= this.rangedAttackRange * 1.5) {
                            this.body.setVelocityX(Math.cos(angleToPlayer) * this.maxSpeed * 0.7);
                            this.body.setVelocityY(Math.sin(angleToPlayer) * this.maxSpeed * 0.7);
                        } else if (this.rangedAttackRange && distanceToPlayer > this.rangedAttackRange * 1.5) {
                            this.body.setVelocityX(Math.cos(angleToPlayer) * this.maxSpeed);
                            this.body.setVelocityY(Math.sin(angleToPlayer) * this.maxSpeed);
                        } else {
                            this.body.setVelocity(0, 0);
                        }
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