import Phaser from 'phaser';
import { EntitySprite } from './EntitySprite';
import type { PlayerSprite } from './PlayerSprite';
import { ProjectileType } from './ProjectileSprite'; // For defining enemy projectile types
import type ProjectileSprite from './ProjectileSprite'; // Import the class for type usage
import type { ParticleSystem } from '../systems/ParticleSystem'; // Added import
import ENEMY_DEFINITIONS from '../definitions/enemies.json'; // Import enemy definitions

import { StateMachine } from '../systems/StateMachine';
import type { IBehavior } from '../interfaces/IBehavior';
import { BehaviorState } from '../interfaces/IBehavior';
import { IdleBehavior } from '../behaviors/IdleBehavior';
import { ChaseTargetBehavior } from '../behaviors/ChaseTargetBehavior';
import { AttackingMeleeBehavior } from '../behaviors/AttackingMeleeBehavior';
import { AttackingRangedBehavior } from '../behaviors/AttackingRangedBehavior';
import { FleeBehavior } from '../behaviors/FleeBehavior'; // Added import

const ENEMY_SPRITE_KEYS: string[] = [];
for (let i = 1; i <= 36; i++) {
    ENEMY_SPRITE_KEYS.push(`enemy_${i}`);
}

export class EnemySprite extends EntitySprite {
    public targetPlayer: PlayerSprite | null = null; // Made public for behaviors
    private lastMeleeAttackTime = 0;
    public enemyType: string; // e.g., 'patrol_cop', 'security_guard', etc.
    public isRanged = false; // Initialized to false
    public meleeAttackRange: number;
    public rangedAttackRange: number | null;
    public sightRange: number; // Added for behavior decisions

    public isFleeing = false; // Added for flee behavior state

    private shootingTimer: Phaser.Time.TimerEvent | null = null;
    public behaviorStateMachine: StateMachine<EnemySprite, IBehavior>; // Made public

    // State for scam_charity_picker fleeing behavior
    // This will likely be managed by a FleeBehavior or similar state logic
    // public isFleeing = false; 
    // public fleeEndTime = 0;

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
            // Call new EntitySprite constructor: initialMaxHp, initialMaxSpeed, initialDefense
            super(scene, x, y, 'default_missing_texture', enemyId, 10, 50, 0, particleSystem);
            this.enemyType = enemyType;
            this.targetPlayer = targetPlayer;
            
            // Set fallback baseStats for this specific non-definition case
            this.baseStats.meleeDamage = 5;
            this.baseStats.attackCooldown = 2000;
            this.baseStats.xpValue = 1;
            // EntitySprite constructor sets defaults for projectileDamage, projectileSpeed which are fine for non-ranged fallback.

            // Fallback ranges (not stats, but configuration)
            this.meleeAttackRange = 30;
            this.rangedAttackRange = null;
            this.sightRange = 200;
            this.isRanged = false; // Ensure isRanged is false for this fallback

            this.behaviorStateMachine = new StateMachine<EnemySprite, IBehavior>(this);
            this.behaviorStateMachine.addState(BehaviorState.IDLE, new IdleBehavior());
            this.behaviorStateMachine.addState(BehaviorState.CHASING, new ChaseTargetBehavior()); 
            this.behaviorStateMachine.addState(BehaviorState.ATTACKING_MELEE, new AttackingMeleeBehavior());
            this.behaviorStateMachine.addState(BehaviorState.FLEEING, new FleeBehavior()); // Added FleeBehavior
            this.behaviorStateMachine.setState(BehaviorState.IDLE, this.targetPlayer);
            this.recalculateStats(); // Recalculate after setting base stats
            return; 
        }

        // Definition exists, proceed with it.
        // Call new EntitySprite constructor: initialMaxHp, initialMaxSpeed, initialDefense
        super(scene, x, y, definition.assetUrl || 'default_missing_texture', enemyId, 
              definition.defaultHp, definition.defaultMaxSpeed, definition.defense ?? 0, particleSystem);

        this.enemyType = enemyType;
        this.targetPlayer = targetPlayer;
        this.isRanged = definition.isRanged;

        // Set baseStats from definition
        this.baseStats.xpValue = definition.xpValue;
        this.baseStats.meleeDamage = definition.meleeAttackDamage;
        this.baseStats.attackCooldown = definition.attackCooldown; 
        // EntitySprite constructor sets initial projectileDamage/Speed. Override if ranged.

        // Ranges (configuration, not dynamic stats typically)
        this.meleeAttackRange = definition.meleeAttackRange;
        this.rangedAttackRange = definition.isRanged ? definition.rangedAttackRange : null;
        this.sightRange = definition.sightRange ?? 300;

        if (this.body instanceof Phaser.Physics.Arcade.Body) {
            this.body.setSize(definition.width, definition.height);
        }
        this.playerPhysicsHeight = definition.height;

        if (definition.isRanged) {
            if (definition.projectileType) {
                const projectileTypeKey = definition.projectileType as keyof typeof ProjectileType;
                if (ProjectileType[projectileTypeKey]) {
                    this.projectileType = definition.projectileType;
                } else {
                    this.projectileType = 'BULLET';
                }
            } else {
                this.projectileType = 'BULLET';
            }
            
            // Override default projectileDamage and projectileSpeed from EntitySprite with enemy-specific ones
            // These are now set into baseStats
            let specificProjectileDamage = this.baseStats.projectileDamage; // Start with default from EntitySprite
            let specificProjectileSpeed = this.baseStats.projectileSpeed;  // Start with default

            switch(enemyType) {
                case 'caffeine_rookie':
                    specificProjectileDamage = 10;
                    specificProjectileSpeed = 450;
                    this.projectileLifespan = 2500;
                    break;
                case 'security_guard':
                    specificProjectileDamage = 15;
                    specificProjectileSpeed = 250;
                    this.projectileLifespan = 1000;
                    break;
                case 'janitor':
                    specificProjectileDamage = 8;
                    specificProjectileSpeed = 200;
                    this.projectileLifespan = 2000;
                    break;
                case 'needle_dealer':
                    specificProjectileDamage = 12;
                    specificProjectileSpeed = 350;
                    this.projectileLifespan = 1800;
                    break;
                case 'street_arsonist':
                    specificProjectileDamage = 18;
                    specificProjectileSpeed = 300;
                    this.projectileLifespan = 1200;
                    break;
                case 'meter_maid':
                    specificProjectileDamage = 10;
                    specificProjectileSpeed = 280;
                    this.projectileLifespan = 1500;
                    break;
                case 'street_preacher':
                    specificProjectileDamage = 14;
                    specificProjectileSpeed = 240;
                    this.projectileLifespan = 1200;
                    break;
                case 'off_duty_cop':
                    specificProjectileDamage = 22;
                    specificProjectileSpeed = 500;
                    this.projectileLifespan = 1000;
                    break;
                case 'community_watch':
                    specificProjectileDamage = 8;
                    specificProjectileSpeed = 350;
                    this.projectileLifespan = 800;
                    break;
                case 'dumpster_defender':
                    specificProjectileDamage = 16;
                    specificProjectileSpeed = 300;
                    this.projectileLifespan = 1200;
                    break;
                case 'college_kid':
                    specificProjectileDamage = 10;
                    specificProjectileSpeed = 280;
                    this.projectileLifespan = 1600;
                    break;
                case 'street_sweeper_crew':
                    specificProjectileDamage = 5;
                    specificProjectileSpeed = 300;
                    this.projectileLifespan = 1000;
                    break;
                case 'predatory_recruiter':
                    specificProjectileDamage = 7;
                    specificProjectileSpeed = 400;
                    this.projectileLifespan = 1200;
                    break;
                case 'animal_control_officer':
                    specificProjectileDamage = 10;
                    specificProjectileSpeed = 350;
                    this.projectileLifespan = 800;
                    break;
                case 'bus_shelter_heckler':
                    specificProjectileDamage = 12;
                    specificProjectileSpeed = 250;
                    this.projectileLifespan = 1500;
                    break;
                default:
                    // If not in switch, specificProjectileDamage/Speed remain EntitySprite defaults or definition based if we add those fields to JSON
                    // For now, relies on EntitySprite defaults if not specified here.
                    break;
            }
            this.baseStats.projectileDamage = specificProjectileDamage;
            this.baseStats.projectileSpeed = specificProjectileSpeed;
            
            this.initAutoShooting();
        }

        this.behaviorStateMachine = new StateMachine<EnemySprite, IBehavior>(this);
        this.behaviorStateMachine.addState(BehaviorState.IDLE, new IdleBehavior());
        this.behaviorStateMachine.addState(BehaviorState.CHASING, new ChaseTargetBehavior());
        this.behaviorStateMachine.addState(BehaviorState.ATTACKING_MELEE, new AttackingMeleeBehavior());
        this.behaviorStateMachine.addState(BehaviorState.FLEEING, new FleeBehavior()); // Added FleeBehavior
        if (this.isRanged) {
            this.behaviorStateMachine.addState(BehaviorState.ATTACKING_RANGED, new AttackingRangedBehavior());
        }
        this.behaviorStateMachine.setState(BehaviorState.IDLE, this.targetPlayer);
        this.recalculateStats(); // Recalculate after all base stats are set
    }

    // Initialize auto-shooting system
    private initAutoShooting(): void {
        if (this.shootingTimer) {
            this.shootingTimer.destroy();
        }
        // Use currentStats for the delay, with a fallback
        const cooldown = this.currentStats.attackCooldown ?? 2000; 
        this.shootingTimer = this.scene.time.addEvent({
            delay: cooldown, 
            callback: this.attemptAutoShoot,
            callbackScope: this,
            loop: true
        });
    }

    // Automatically shoot at the player
    public attemptAutoShoot(): void {
        if (!this.active || !this.targetPlayer?.active) return;

        const currentTime = this.scene.time.now;
        // Check if enough time has passed since the last shot
        if (currentTime < this.lastShotTime + this.currentStats.attackCooldown) {
            return; // Still on cooldown, can't shoot yet
        }

        const distanceToPlayer = Phaser.Math.Distance.Between(this.x, this.y, this.targetPlayer.x, this.targetPlayer.y);
        
        // Attempt to shoot if within attack range
        if (this.rangedAttackRange && distanceToPlayer <= this.rangedAttackRange) {
            // Target player directly for ranged attack
            const targetPos = new Phaser.Math.Vector2(this.targetPlayer.x, this.targetPlayer.y);
            // Update lastShotTime before attempting to shoot
            this.lastShotTime = currentTime;
            this.attemptShoot(targetPos);
        }
    }

    update(time: number, delta: number): void {
        if (!this.active) {
            if (this.body instanceof Phaser.Physics.Arcade.Body) {
                this.body.setVelocity(0,0); // Ensure inactive enemies don't move
            }
            return;
        }

        // Update isFleeing based on current behavior state
        this.isFleeing = this.behaviorStateMachine.currentState?.id === BehaviorState.FLEEING;

        // targetPlayer is passed to the behavior's update method
        this.behaviorStateMachine.update(time, delta, this.targetPlayer);
    }

    public performMeleeAttack(): void {
        if (this.targetPlayer?.active) {
            const currentTime = this.scene.time.now;
            // Use currentStats for cooldown and damage, with fallbacks
            const attackCooldown = this.currentStats.attackCooldown ?? 1000;
            const meleeDamage = this.currentStats.meleeDamage ?? 5;

            if (currentTime > this.lastMeleeAttackTime + attackCooldown) { 
                this.targetPlayer.takeDamage(meleeDamage, this);
                this.lastMeleeAttackTime = currentTime; 
            }
        }
    }

    // Override the die method from EntitySprite
    protected override die(killer?: EntitySprite | ProjectileSprite | string): void {
        // Clean up shooting timer
        if (this.shootingTimer) {
            this.shootingTimer.destroy();
            this.shootingTimer = null;
        }
        
        // Play enemy death particle effect
        if (this.particleSystem) {
            this.particleSystem.playEnemyDeath(this.x, this.y);
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