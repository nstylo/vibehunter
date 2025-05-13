import Phaser from 'phaser';
import { EntitySprite } from './EntitySprite';
import type { PlayerSprite } from './PlayerSprite';
import { ProjectileType } from './ProjectileSprite'; // For defining enemy projectile types
import type ProjectileSprite from './ProjectileSprite'; // Import the class for type usage
import type { ParticleSystem } from '../systems/ParticleSystem'; // Added import
import ENEMY_DEFINITIONS from '../definitions/enemies.json'; // Import enemy definitions
import DataManager from '../systems/DataManager'; // Import DataManager
import type { IEnemyDefinition } from '../interfaces/IEnemyDefinition';
import type { IAttackInstance } from '../interfaces/IAttackInstance';
import type { IAttackDefinition } from '../interfaces/IAttackDefinition';

import { StateMachine } from '../systems/StateMachine';
import type { IBehavior } from '../interfaces/IBehavior';
import { BehaviorState } from '../interfaces/IBehavior';
import { IdleBehavior } from '../behaviors/IdleBehavior';
import { ChaseTargetBehavior } from '../behaviors/ChaseTargetBehavior';
import { AttackingMeleeBehavior } from '../behaviors/AttackingMeleeBehavior';
import { AttackingRangedBehavior } from '../behaviors/AttackingRangedBehavior';
import { FleeBehavior } from '../behaviors/FleeBehavior'; // Added import
import { GameEvent } from '../../common/events'; // Corrected import

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

    // private shootingTimer: Phaser.Time.TimerEvent | null = null; // Commented out - using behavior-driven attacks
    public behaviorStateMachine: StateMachine<EnemySprite, IBehavior>; // Made public

    // Attack management
    public activeAttacks: IAttackInstance[] = [];
    private attackCooldowns = new Map<string, number>();

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
        // Get enemy definition from DataManager
        const definition = DataManager.getEnemyDefinition(enemyType);
        
        if (!definition) {
            console.error(`EnemySprite: No definition found for enemyType: ${enemyType}. Using fallback texture.`);
            // Call new EntitySprite constructor: initialMaxHp, initialMaxSpeed, initialDefense
            super(scene, x, y, 'default_missing_texture', enemyId, 10, 50, 0, particleSystem);
            this.enemyType = enemyType;
            this.targetPlayer = targetPlayer;
            
            // Set fallback baseStats for this specific non-definition case
            this.baseStats = {
                ...this.baseStats,
                maxHp: 10,
                hp: 10, // Should be currentHp, EntitySprite usually handles this
                maxSpeed: 50,
                defense: 0,
                attackCooldownModifier: 1.0,
                damageModifier: 1.0,
                projectileSpeedModifier: 1.0,
                projectileSizeModifier: 1.0,
                areaOfEffectModifier: 1.0,
                effectDurationModifier: 1.0,
                xpValue: 1, // IEnemyStats specific
                // Add new stats with fallback defaults
                meleeDamage: 5,
                attackCooldown: 2000,
                projectileDamage: 0, // No projectiles by default for fallback
                projectileSpeed: 0,  // No projectiles by default for fallback
            };

            // Apply physics body properties for better collision handling even in fallback case
            if (this.body instanceof Phaser.Physics.Arcade.Body) {
                this.body.setBounce(0.1);
                this.body.setCollideWorldBounds(true);
                this.body.setFriction(0.5, 0.5);
                this.body.useDamping = true;
                this.body.setDrag(0.2);
                this.body.setMass(1.5);
            }

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
        super(scene, x, y, definition.assetUrl || 'default_missing_texture', enemyId, 
              definition.maxHp ?? 10, // Use maxHp instead of defaultHp
              definition.maxSpeed ?? 50, // Use maxSpeed instead of defaultMaxSpeed
              definition.defense ?? 0, // Provide default if undefined
              particleSystem);

        this.enemyType = enemyType;
        this.targetPlayer = targetPlayer;
        
        // Explicitly read isRanged from definition - this is important!
        this.isRanged = definition.isRanged === true;

        // Set baseStats from definition
        // EntitySprite's constructor (via super) has already initialized:
        // maxHp, currentHp (to maxHp), maxSpeed, defense, and default modifiers (e.g., attackCooldownModifier: 1.0)
        // Now, we supplement with IEnemyStats specific fields and other enemy-specific base values.
        this.baseStats = {
            ...this.baseStats, // Carry over from EntitySprite's initialization
            xpValue: definition.xpValue ?? 0, // IEnemyStats specific, provide default

            // Initialize new stats. These might be general defaults or from definition if available.
            // The switch-case below will further specialize projectileDamage and projectileSpeed.
            meleeDamage: definition.meleeDamage ?? 10, // Assuming definition might have 'meleeDamage', or use a default
            attackCooldown: definition.attackCooldown ?? 2000, // Assuming definition might have 'attackCooldown', or use a default
            
            // projectileDamage and projectileSpeed will be set by EntitySprite to some default,
            // or use a fallback here if not. The switch-case below is the primary source for these for ranged enemies.
            projectileDamage: this.baseStats.projectileDamage ?? (definition.isRanged ? 5 : 0), // Default if ranged
            projectileSpeed: this.baseStats.projectileSpeed ?? (definition.isRanged ? 300 : 0), // Default if ranged
        };
        // Modifiers (damageModifier, attackCooldownModifier, etc.) are expected to be set to 1.0 by EntitySprite.
        // If specific enemies need different base modifiers, it could be definition.damageModifier ?? 1.0, etc.

        // Ranges (configuration, not dynamic stats typically) - explicitly read from definition
        this.meleeAttackRange = definition.meleeAttackRange ?? 60; // Default to 60 if undefined
        this.rangedAttackRange = this.isRanged ? (definition.rangedAttackRange ?? 300) : null; // Default to 300 if ranged but range undefined
        this.sightRange = definition.sightRange ?? 300;

        if (this.body instanceof Phaser.Physics.Arcade.Body) {
            this.body.setSize(definition.width, definition.height);
            // Enhanced physics body configuration for better collisions
            this.body.setBounce(0.1);
            this.body.setCollideWorldBounds(true);
            this.body.setFriction(0.5, 0.5);
            this.body.useDamping = true;
            this.body.setDrag(0.2);
            this.body.setMass(1.5); // Slightly heavier to resist being pushed easily
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
            let specificProjectileDamage = this.baseStats.projectileDamage ?? 0; // Start with current baseStat or 0
            let specificProjectileSpeed = this.baseStats.projectileSpeed ?? 0;  // Start with current baseStat or 0

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
            
            // this.initAutoShooting(); // Commented out - using behavior-driven attacks
        }

        // Initialize the enemy's attacks from its definition
        this.initializeAttacks(definition);

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
    /* // Commenting out the old auto-shooting system
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
    */

    // Automatically shoot at the player
    /* // Commenting out the old auto-shooting system
    public attemptAutoShoot(): void {
        if (!this.active || !this.targetPlayer?.active) return;

        const currentTime = this.scene.time.now;
        const baseCooldown = this.currentStats.attackCooldown ?? 2000; // Use stat
        // Check if enough time has passed since the last shot
        if (currentTime < this.lastShotTime + baseCooldown) {
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
    */

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
            const attackCooldown = this.currentStats.attackCooldown ?? 1000; // From IBaseEntityStats
            const meleeDamage = this.currentStats.meleeDamage ?? 5; // From IBaseEntityStats

            if (currentTime > this.lastMeleeAttackTime + attackCooldown) { 
                this.targetPlayer.takeDamage(meleeDamage, this);
                this.lastMeleeAttackTime = currentTime; 
            }
        }
    }

    // Override the die method from EntitySprite
    protected override die(killer?: EntitySprite | ProjectileSprite | string): void {
        // Clean up shooting timer
        /* // Commenting out the old auto-shooting system related cleanup
        if (this.shootingTimer) {
            this.shootingTimer.destroy();
            this.shootingTimer = null;
        }
        */
        
        // Play enemy death particle effect
        if (this.particleSystem) {
            this.particleSystem.playEnemyDeath(this.x, this.y);
        }
        
        super.die(killer);
    }
    
    // Clean up resources when destroyed
    destroy(fromScene?: boolean): void {
        /* // Commenting out the old auto-shooting system related cleanup
        if (this.shootingTimer) {
            this.shootingTimer.destroy();
            this.shootingTimer = null;
        }
        */
        super.destroy(fromScene);
    }

    /**
     * Initialize the enemy's attacks from its definition
     */
    private initializeAttacks(definition: IEnemyDefinition): void {
        // Clear any existing attacks
        this.activeAttacks = [];
        
        // Choose a subset of attacks if there are many available
        let attacksToUse = [...(definition.attacks || [])]; // Ensure definition.attacks is not undefined
        if (attacksToUse.length > 3) {
            // Randomly select up to 3 attacks for this enemy instance
            attacksToUse = Phaser.Utils.Array.Shuffle(attacksToUse).slice(0, 3);
        }
        
        // Add each selected attack
        for (const attackId of attacksToUse) {
            const attackDef = DataManager.getAttackDefinition(attackId);
            if (attackDef) {
                this.activeAttacks.push({
                    definition: attackDef,
                    currentCooldown: 0,
                    lastFiredTimestamp: 0
                });
            } else {
                console.warn(`EnemySprite: Attack definition not found for ID: ${attackId}`);
            }
        }
        
        // Initialize attack cooldowns
        for (const attack of this.activeAttacks) {
            this.attackCooldowns.set(attack.definition.id, 0);
        }
    }

    /**
     * Attempt to use an attack
     * This can be called by the behavior classes when in range
     */
    public attemptAttack(attackType: 'MELEE' | 'RANGED', targetPos?: Phaser.Math.Vector2): boolean {
        if (!this.active || !this.targetPlayer?.active) return false;
        
        // Find an appropriate attack of the requested type that is off cooldown
        const currentTime = this.scene.time.now;
        
        for (const attack of this.activeAttacks) {
            // Skip if wrong type
            if (!attack.definition.type.includes(attackType)) continue;
            
            // Skip if on cooldown
            const cooldown = this.attackCooldowns.get(attack.definition.id) || 0;
            if (cooldown > currentTime) continue;
            
            // Execute the attack based on its type
            switch (attack.definition.type) {
                case 'MELEE':
                    this.executeMeleeAttack(attack);
                    break;
                case 'RANGED':
                    this.executeRangedAttack(attack, targetPos);
                    break;
                case 'RANGED_AREA_DENIAL':
                    this.executeRangedAreaDenialAttack(attack, targetPos);
                    break;
                case 'MELEE_AREA_CONTINUOUS':
                    this.executeMeleeAreaContinuousAttack(attack);
                    break;
                default:
                    console.warn(`EnemySprite: Unknown attack type: ${attack.definition.type}`);
                    continue;
            }
            
            // Set cooldown for this attack
            this.attackCooldowns.set(
                attack.definition.id,
                currentTime + (attack.definition.attackCooldown * (this.currentStats.attackCooldownModifier ?? 1.0))
            );
            
            // Attack executed successfully
            return true;
        }
        
        // No suitable attack found
        return false;
    }

    /**
     * Check if the enemy has a specific type of attack available
     */
    public hasAttackType(attackType: string): boolean {
        return this.activeAttacks.some(attack => attack.definition.type.includes(attackType));
    }

    /**
     * Get a summary of the enemy's attack capabilities for behavior decisions
     */
    public getAttackCapabilities(): { 
        hasMelee: boolean;
        hasRanged: boolean;
        meleeRange: number;
        rangedRange: number;
    } {
        let hasMelee = false;
        let hasRanged = false;
        let meleeRange = 0;
        let rangedRange = 0;
        
        for (const attack of this.activeAttacks) {
            if (attack.definition.type.includes('MELEE')) {
                hasMelee = true;
                meleeRange = Math.max(meleeRange, attack.definition.range);
            }
            
            if (attack.definition.type.includes('RANGED')) {
                hasRanged = true;
                rangedRange = Math.max(rangedRange, attack.definition.range);
            }
        }
        
        return {
            hasMelee,
            hasRanged,
            meleeRange,
            rangedRange
        };
    }

    /**
     * Execute a melee attack
     */
    private executeMeleeAttack(attack: IAttackInstance): void {
        if (!this.targetPlayer?.active) return;
        
        // Check if player is in range
        const distanceToPlayer = Phaser.Math.Distance.Between(
            this.x, this.y, this.targetPlayer.x, this.targetPlayer.y
        );
        
        if (distanceToPlayer > attack.definition.range) {
            return; // Player is out of range
        }
        
        // Calculate effective damage
        const baseDamage = attack.definition.damage || 0;
        const effectiveDamage = baseDamage * (this.currentStats.damageModifier ?? 1.0);
        
        // Apply damage to player
        this.targetPlayer.takeDamage(effectiveDamage, this);
        
        // Apply knockback if specified
        if (attack.definition.knockbackForce) {
            const direction = new Phaser.Math.Vector2(
                this.targetPlayer.x - this.x, 
                this.targetPlayer.y - this.y
            ).normalize();
            
            this.targetPlayer.applyKnockback(direction, attack.definition.knockbackForce);
        }
        
        // Apply status effect if specified
        if (attack.definition.statusEffectOnHit) {
            const effectData = attack.definition.statusEffectOnHit;
            this.targetPlayer.applyStatusEffect({
                id: `${effectData.effectType}_${Date.now()}`, // Generate unique ID
                type: effectData.effectType,
                duration: effectData.duration,
                potency: effectData.potency,
                name: effectData.effectType // Adding name to satisfy IStatusEffectData
            }, this);
        }
        
        // Play attack particle effect if available
        if (this.particleSystem && attack.definition.hitParticleEffect) {
            this.particleSystem.playEnemyAttack(
                this.x,
                this.y,
                attack.definition.hitParticleEffect // Pass the effect key
            );
        }
        
        // Play attack sound if available
        if (attack.definition.hitSoundKey) {
            // this.scene.sound.play(attack.definition.hitSoundKey);
        }

        // Lunge Tween Logic
        if (this.targetPlayer) { // Ensure targetPlayer is still valid
            const lungeDistance = 25; // Distance in pixels for the lunge
            const lungeDuration = 100; // Duration in milliseconds for the lunge forward

            // Store original position to return to if yoyo doesn't perfectly reset
            // const originalX = this.x;
            // const originalY = this.y;

            const direction = new Phaser.Math.Vector2(
                this.targetPlayer.x - this.x,
                this.targetPlayer.y - this.y
            ).normalize();

            const lungeTargetX = this.x + direction.x * lungeDistance;
            const lungeTargetY = this.y + direction.y * lungeDistance;

            // Stop any existing tweens on this sprite to prevent conflicts
            this.scene.tweens.killTweensOf(this);

            this.scene.tweens.add({
                targets: this,
                x: lungeTargetX,
                y: lungeTargetY,
                duration: lungeDuration,
                ease: 'Power2',
                yoyo: true, // Automatically tweens back to the original position
                // onComplete: () => {
                    // Optional: Force reset to original position if yoyo isn't precise enough,
                    // but usually yoyo:true is sufficient.
                    // this.setPosition(originalX, originalY);
                // }
            });
        }
    }
    
    /**
     * Execute a ranged attack
     */
    private executeRangedAttack(attack: IAttackInstance, targetPos?: Phaser.Math.Vector2): void {
        if (!this.targetPlayer?.active && !targetPos) return;
        
        // Get target position - either the provided position or the player's position
        const target = targetPos || new Phaser.Math.Vector2(this.targetPlayer!.x, this.targetPlayer!.y);
        
        // Calculate direction to target
        const direction = new Phaser.Math.Vector2(target.x - this.x, target.y - this.y).normalize();
        
        // Calculate effective damage
        const baseDamage = attack.definition.damage || 0;
        const effectiveDamage = baseDamage * (this.currentStats.damageModifier ?? 1.0);
        
        // Handle multi-projectile attacks
        const projectilesPerShot = attack.definition.projectilesPerShot || 1;
        const spreadAngle = attack.definition.spreadAngle || 0;
        
        if (projectilesPerShot > 1 && spreadAngle > 0) {
            // Fire multiple projectiles in a spread
            const angleToTarget = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
            const startAngle = angleToTarget - (spreadAngle * Math.PI / 180) / 2;
            const angleStep = (spreadAngle * Math.PI / 180) / (projectilesPerShot - 1);
            
            for (let i = 0; i < projectilesPerShot; i++) {
                const currentAngle = startAngle + angleStep * i;
                const shotDirection = new Phaser.Math.Vector2(
                    Math.cos(currentAngle), 
                    Math.sin(currentAngle)
                ).normalize();
                
                this.fireProjectile(attack, effectiveDamage, shotDirection);
            }
        } else {
            // Fire a single projectile
            this.fireProjectile(attack, effectiveDamage, direction);
        }
    }
    
    /**
     * Execute a ranged area denial attack
     */
    private executeRangedAreaDenialAttack(attack: IAttackInstance, targetPos?: Phaser.Math.Vector2): void {
        // Similar to ranged attack but the projectile creates an area effect on impact
        this.executeRangedAttack(attack, targetPos);
    }
    
    /**
     * Execute a melee area continuous attack
     */
    private executeMeleeAreaContinuousAttack(attack: IAttackInstance): void {
        if (!this.targetPlayer?.active) return;
        
        // Get attack range and area of effect
        const aoeRadius = attack.definition.areaOfEffect?.radius || attack.definition.range;
        const effectiveRange = aoeRadius * (this.currentStats.areaOfEffectModifier ?? 1.0);
        
        // Check if player is in range
        const distanceToPlayer = Phaser.Math.Distance.Between(
            this.x, this.y, this.targetPlayer.x, this.targetPlayer.y
        );
        
        if (distanceToPlayer > effectiveRange) {
            return; // Player is out of range
        }
        
        // Calculate effective damage
        const baseDamage = attack.definition.damage || 0;
        const effectiveDamage = baseDamage * (this.currentStats.damageModifier ?? 1.0);
        
        // Apply damage to player
        this.targetPlayer.takeDamage(effectiveDamage, this);
        
        // Apply status effect if specified
        if (attack.definition.statusEffectOnHit) {
            const effectData = attack.definition.statusEffectOnHit;
            this.targetPlayer.applyStatusEffect({
                id: `${effectData.effectType}_${Date.now()}`, // Generate unique ID
                type: effectData.effectType,
                duration: effectData.duration,
                potency: effectData.potency,
                name: effectData.effectType // Adding name to satisfy IStatusEffectData
            }, this);
        }
        
        // Play attack particle effect if available
        if (this.particleSystem && attack.definition.hitParticleEffect) {
            this.particleSystem.playEnemyAttack(
                this.x,
                this.y,
                attack.definition.hitParticleEffect // Pass the effect key
            );
        }
        
        // Play attack sound if available
        if (attack.definition.hitSoundKey) {
            this.scene.sound.play(attack.definition.hitSoundKey);
        }
    }
    
    /**
     * Fire a projectile for a ranged attack
     */
    private fireProjectile(attack: IAttackInstance, damage: number, direction: Phaser.Math.Vector2): void {
        // Get projectile type from attack definition
        const projectileType = attack.definition.projectileType || 'BULLET';
        
        // Calculate effective projectile speed
        // Use the enemy's current projectile speed stat as the base
        const baseProjectileSpeed = this.currentStats.projectileSpeed || 300; 
        const effectiveSpeed = baseProjectileSpeed * (this.currentStats.projectileSpeedModifier ?? 1.0);
        
        // Calculate projectile lifespan based on range
        const range = attack.definition.range || 200;
        const lifespan = (range / effectiveSpeed) * 1000; // Convert to milliseconds
        
        // Emit event to spawn projectile
        this.scene.events.emit(GameEvent.ENTITY_SHOOT_PROJECTILE, {
            shooter: this,
            projectileType: projectileType,
            damage: damage,
            knockbackForce: attack.definition.knockbackForce || 0,
            projectileSpeed: effectiveSpeed,
            projectileScale: 1.0,
            lifespan: lifespan,
            direction: direction,
            x: this.x + direction.x * (this.width / 2 + 10),
            y: this.y + direction.y * (this.height / 2),
            attackDef: attack.definition, // Pass the full attack definition for additional properties
            statusEffectOnHit: attack.definition.statusEffectOnHit
        });
    }
} 