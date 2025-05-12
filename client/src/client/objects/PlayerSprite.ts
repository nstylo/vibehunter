import Phaser from 'phaser';
import { EntitySprite } from './EntitySprite'
import type { EnemySprite } from './EnemySprite';
import { type IPlayerStats, DEFAULT_PLAYER_BASE_STATS } from '../interfaces/IPlayerStats';
import type NetworkSystem from '../systems/NetworkSystem'
import type { NetworkAware } from '../types/multiplayer';
import type { ParticleSystem } from '../systems/ParticleSystem';
import { DataManager } from '../systems/DataManager';
import type { IAttackInstance } from '../interfaces/IAttackInstance';
import type { IAttackDefinition } from '../interfaces/IAttackDefinition';
import type { IStatusEffectData } from '../interfaces/IStatusEffect';
import { GameEvent } from '../../common/events';

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

    // Character information
    private characterId: string;

    // Attack management
    public activeAttacks: IAttackInstance[] = [];

    // Auto-shooting properties
    private targetEnemy: EnemySprite | null = null;
    private shootingTimers: Map<string, Phaser.Time.TimerEvent> = new Map();
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

    constructor(scene: Phaser.Scene, x: number, y: number, playerId: string, characterId: string | unknown = "1", particleSystem?: ParticleSystem) {
        // Parse characterId first to ensure it's a valid string
        let charId: string;
        if (characterId === undefined || characterId === null) {
            charId = "1"; // Default to 1 if undefined or null
        } else if (typeof characterId === 'object') {
            // Handle object case - convert to string
            charId = String(characterId) || "1";
        } else {
            // Handle primitive types
            charId = String(characterId);
        }
        
        // Use character ID to select the appropriate sprite
        // Ensure it's within valid range (1-20)
        const numCharId = parseInt(charId, 10);
        const validCharId = !isNaN(numCharId) && numCharId >= 1 && numCharId <= 20 ? numCharId : 1;
        const spriteKey = `character_front_${validCharId}`;
        
        // Ensure sprite key exists in the array
        if (!CHARACTER_SPRITE_KEYS.includes(spriteKey)) {
            console.warn(`Sprite key ${spriteKey} not found in CHARACTER_SPRITE_KEYS. Using default.`);
            // Fall back to character 1 if the sprite doesn't exist
            charId = "1";
        }

        super(scene, x, y, spriteKey, playerId,
            DEFAULT_PLAYER_BASE_STATS.maxHp, 
            DEFAULT_PLAYER_BASE_STATS.maxSpeed, 
            DEFAULT_PLAYER_BASE_STATS.defense, // Pass defense to EntitySprite constructor
            particleSystem 
            );
        this.playerId = playerId; 
        // Store the validated character ID
        this.characterId = charId;
        
        this.dashCooldown = 0; 
        this.accelerationFactor = 0.1; 
        this.decelerationFactor = 0.1;

        // Initialize baseStats with player-specific defaults
        // EntitySprite constructor already sets basic stats
        // We override them here specifically for the player
        this.baseStats = {
            ...this.baseStats,
            // Copy over the new player-specific stats
            maxHp: DEFAULT_PLAYER_BASE_STATS.maxHp,
            hp: DEFAULT_PLAYER_BASE_STATS.currentHp,
            maxSpeed: DEFAULT_PLAYER_BASE_STATS.maxSpeed,
            defense: DEFAULT_PLAYER_BASE_STATS.defense,
            attackCooldownModifier: DEFAULT_PLAYER_BASE_STATS.attackCooldownModifier,
            damageModifier: DEFAULT_PLAYER_BASE_STATS.damageModifier,
            projectileSpeedModifier: DEFAULT_PLAYER_BASE_STATS.projectileSpeedModifier,
            projectileSizeModifier: DEFAULT_PLAYER_BASE_STATS.projectileSizeModifier,
            areaOfEffectModifier: DEFAULT_PLAYER_BASE_STATS.areaOfEffectModifier,
            effectDurationModifier: DEFAULT_PLAYER_BASE_STATS.effectDurationModifier,
            xpGainModifier: DEFAULT_PLAYER_BASE_STATS.xpGainModifier,
            pickupRadiusModifier: DEFAULT_PLAYER_BASE_STATS.pickupRadiusModifier,
            luck: DEFAULT_PLAYER_BASE_STATS.luck
        };
        this.currentStats = { ...this.baseStats };

        if (this.body instanceof Phaser.Physics.Arcade.Body) {
            const offsetX = (PLAYER_WIDTH - PLAYER_PHYSICS_WIDTH) / 2;
            const offsetY = (PLAYER_HEIGHT - PLAYER_PHYSICS_HEIGHT) / 2;
            this.body.setSize(PLAYER_PHYSICS_WIDTH, PLAYER_PHYSICS_HEIGHT);
            this.body.setOffset(offsetX, offsetY);
        }

        // Initialize player's starting attacks from character definition
        this.initializeAttacks();

        // Initialize input keys
        if (scene.input.keyboard) {
            this.keyW = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
            this.keyA = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
            this.keyS = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
            this.keyD = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
        } else {
            console.warn('PlayerSprite: Keyboard input system not available in the scene. WASD keys will not work.');
        }

        this.scene.events.on(GameEvent.PLAYER_STATS_UPDATED, this.updateStats, this);
        this.playerPhysicsHeight = PLAYER_PHYSICS_HEIGHT; 

        this.recalculateStats(); // Important: Calculate currentStats after all baseStats are set.
    }

    /**
     * Makes the player sprite face a given x-coordinate.
     * @param targetX The x-coordinate to face.
     */
    private faceTarget(targetX: number): void {
        if (targetX < this.x) {
            this.setFlipX(true);
        } else {
            this.setFlipX(false);
        }
    }

    /**
     * Initialize player's attacks based on their character definition
     */
    private initializeAttacks(): void {
        const charId = this.characterId;
        const dataManager = DataManager.getInstance();
        const characterDef = dataManager.getCharacterDefinition(charId);
        
        if (!characterDef) {
            console.warn(`PlayerSprite: No character definition found for ID: ${charId}`);
            // Fallback to a default character definition if none is found
            const defaultCharacterDef = dataManager.getCharacterDefinition("1");
            if (defaultCharacterDef) {
                this.initializeAttacksFromDefinition(defaultCharacterDef);
            } else {
                console.error(`PlayerSprite: Could not find default character definition either. No attacks initialized.`);
                this.activeAttacks = [];
            }
            return;
        }
        
        this.initializeAttacksFromDefinition(characterDef);
    }
    
    /**
     * Initialize attacks from a character definition
     */
    private initializeAttacksFromDefinition(characterDef: any): void {
        // Clear any existing attacks
        this.activeAttacks = [];
        
        // Handle the case where startingAttacks might not be defined
        const startingAttacks = characterDef.startingAttacks || [];
        
        // Add attacks from character definition
        for (const attackId of startingAttacks) {
            const attackDef = DataManager.getInstance().getAttackDefinition(attackId);
            
            if (attackDef) {
                this.activeAttacks.push({
                    definition: attackDef,
                    currentCooldown: 0,
                    lastFiredTimestamp: 0
                });
            } else {
                console.warn(`PlayerSprite: Attack definition not found for ID: ${attackId}`);
            }
        }
        
        // If no attacks were initialized, add a default attack
        if (this.activeAttacks.length === 0) {
            const defaultAttackDef = DataManager.getInstance().getAttackDefinition("FIST_PUNCH");
            if (defaultAttackDef) {
                this.activeAttacks.push({
                    definition: defaultAttackDef,
                    currentCooldown: 0,
                    lastFiredTimestamp: 0
                });
            }
        }
        
        // Initialize attack timers
        this.initializeAttackTimers();
    }

    /**
     * Set up timers for each attack
     */
    private initializeAttackTimers(): void {
        // Clear any existing timers
        this.shootingTimers.forEach(timer => timer.destroy());
        this.shootingTimers.clear();
        
        // Create a timer for each attack
        this.activeAttacks.forEach(attack => {
            const effectiveCooldown = this.calculateEffectiveAttackCooldown(attack);
            const timer = this.scene.time.addEvent({
                delay: effectiveCooldown,
                callback: () => this.attemptAttack(attack),
                callbackScope: this,
                loop: true
            });
            
            this.shootingTimers.set(attack.definition.id, timer);
        });
    }

    /**
     * Calculate the effective cooldown for an attack taking player modifiers into account
     */
    private calculateEffectiveAttackCooldown(attack: IAttackInstance): number {
        const baseCooldown = attack.definition.attackCooldown;
        const modifier = this.currentStats.attackCooldownModifier ?? 1.0;
        const effectiveCooldown = baseCooldown * modifier;
        
        // Ensure minimum cooldown
        return Math.max(effectiveCooldown, MINIMUM_SHOOT_COOLDOWN_MS);
    }

    /**
     * Attempt to use an attack
     */
    private attemptAttack(attack: IAttackInstance): void {
        if (!this.active) return;
        
        const currentTime = this.scene.time.now;
        
        // Skip if on cooldown
        if (currentTime < (attack.lastFiredTimestamp || 0) + this.calculateEffectiveAttackCooldown(attack)) {
            return;
        }
        
        // Execute the attack based on its type
        switch (attack.definition.type) {
            case 'RANGED':
                this.executeRangedAttack(attack);
                break;
            case 'MELEE':
                this.executeMeleeAttack(attack);
                break;
            case 'SUPPORT':
                // Support attacks would target allies - not implemented yet
                break;
            case 'BUFF_SELF':
                this.executeBuffSelfAttack(attack);
                break;
            case 'RANGED_AREA_DENIAL':
                this.executeRangedAreaDenialAttack(attack);
                break;
            case 'MELEE_AREA_CONTINUOUS':
                this.executeMeleeAreaContinuousAttack(attack);
                break;
            default:
                console.warn(`PlayerSprite: Unknown attack type: ${attack.definition.type}`);
                break;
        }
        
        // Update last fired timestamp
        attack.lastFiredTimestamp = currentTime;
    }

    /**
     * Execute a ranged attack
     */
    private executeRangedAttack(attack: IAttackInstance, targetPos?: Phaser.Math.Vector2): void {
        let finalTargetPos: Phaser.Math.Vector2 | undefined = targetPos;

        if (!finalTargetPos) {
            if (this.targetEnemy && this.targetEnemy.active) {
                finalTargetPos = new Phaser.Math.Vector2(this.targetEnemy.x, this.targetEnemy.y);
            } else {
                // Try to find a new target if one isn't set or is inactive
                this.targetEnemy = this.findNearestEnemy();
                if (this.targetEnemy && this.targetEnemy.active) {
                    finalTargetPos = new Phaser.Math.Vector2(this.targetEnemy.x, this.targetEnemy.y);
                } else {
                    return; // No valid target found
                }
            }
        }

        // Calculate effective damage
        const baseDamage = attack.definition.damage || 0;
        const effectiveDamage = baseDamage * (this.currentStats.damageModifier ?? 1.0);
        
        // Handle multi-projectile attacks
        const projectilesPerShot = attack.definition.projectilesPerShot || 1;
        const spreadAngle = attack.definition.spreadAngle || 0;
        
        let direction: Phaser.Math.Vector2;

        if (projectilesPerShot > 1 && spreadAngle > 0) {
            // Fire multiple projectiles in a spread
            const angleToTarget = Phaser.Math.Angle.Between(this.x, this.y, finalTargetPos.x, finalTargetPos.y);
            const startAngle = angleToTarget - (spreadAngle * Math.PI / 180) / 2;
            const angleStep = (spreadAngle * Math.PI / 180) / (projectilesPerShot - 1 || 1); // Avoid division by zero if projectilesPerShot is 1
            
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
            direction = new Phaser.Math.Vector2(finalTargetPos.x - this.x, finalTargetPos.y - this.y).normalize();
            this.fireProjectile(attack, effectiveDamage, direction);
        }
        
        this.faceTarget(finalTargetPos.x);
    }

    /**
     * Fire a projectile for a ranged attack
     */
    private fireProjectile(attack: IAttackInstance, damage: number, direction: Phaser.Math.Vector2): void {
        // Get projectile type from attack definition
        const projectileType = attack.definition.projectileType || 'BULLET';
        
        // Calculate effective projectile speed
        const baseProjectileSpeed = 300; // Default if not specified
        const effectiveSpeed = baseProjectileSpeed * (this.currentStats.projectileSpeedModifier ?? 1.0);
        
        // Calculate effective projectile size
        const effectiveSize = this.currentStats.projectileSizeModifier ?? 1.0;
        
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
            projectileScale: effectiveSize,
            lifespan: lifespan,
            direction: direction,
            x: this.x + direction.x * (this.width / 2 + 10),
            y: this.y + direction.y * (this.height / 2),
            attackDef: attack.definition, // Pass the full attack definition for additional properties
            statusEffectOnHit: attack.definition.statusEffectOnHit
        });
    }

    /**
     * Execute a melee attack
     */
    private executeMeleeAttack(attack: IAttackInstance): void {
        const range = attack.definition.range || 50;
        const aoeRange = attack.definition.areaOfEffect?.radius || range;
        const effectiveRange = aoeRange * (this.currentStats.areaOfEffectModifier ?? 1.0);
        
        // Find enemies in range
        const enemiesInRange = this.findEnemiesInRange(effectiveRange);

        if (enemiesInRange.length === 0) {
            // Optionally play a 'miss' sound or animation if needed
            return; 
        }
        
        // Determine direction for facing (e.g., towards the closest enemy)
        let closestEnemy: EnemySprite | null = null;
        let minDistance = Infinity;
        for (const enemy of enemiesInRange) {
            if (enemy && enemy.active) {
                const distance = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestEnemy = enemy;
                }
            }
        }
        if (closestEnemy) {
            this.faceTarget(closestEnemy.x);
        }
        
        // Calculate effective damage
        const baseDamage = attack.definition.damage || 0;
        const effectiveDamage = baseDamage * (this.currentStats.damageModifier ?? 1.0);
        
        // Apply damage to all enemies in range
        for (const enemy of enemiesInRange) {
            if (!enemy || !enemy.active) continue;

            enemy.takeDamage(effectiveDamage, this);

            // Apply knockback if specified
            if (attack.definition.knockbackForce) {
                const direction = new Phaser.Math.Vector2(enemy.x - this.x, enemy.y - this.y).normalize();
                enemy.applyKnockback(direction, attack.definition.knockbackForce);
            }

            // Apply status effect if specified
            if (attack.definition.statusEffectOnHit) {
                const effectData = attack.definition.statusEffectOnHit;
                enemy.applyStatusEffect({
                    id: `${effectData.effectType}_${Date.now()}`,
                    name: effectData.effectType, 
                    type: effectData.effectType,
                    duration: (effectData.duration ?? 0) * (this.currentStats.effectDurationModifier ?? 1.0),
                    potency: effectData.potency
                }, this);
            }
        }
        
        // Play attack particle effect if available (e.g., a slash or impact effect)
        if (this.particleSystem && attack.definition.hitParticleEffect) {
            // Example: Play effect at player's position or an average position of hit enemies
            this.particleSystem.playEffect(attack.definition.hitParticleEffect, this.x, this.y);
        }
        
        // Play attack sound if available
        if (attack.definition.hitSoundKey) {
            // this.scene.sound.play(attack.definition.hitSoundKey);
        }
    }

    /**
     * Execute a buff self attack
     */
    private executeBuffSelfAttack(attack: IAttackInstance): void {
        // Apply self buff if specified
        if (attack.definition.statusEffectOnSelf) {
            const effectData = attack.definition.statusEffectOnSelf;
            const statusEffect: IStatusEffectData = {
                id: `${effectData.effectType}_${Date.now()}`, // Generate unique ID
                name: effectData.effectType, // Use effect type as name if not specified
                type: effectData.effectType,
                duration: (effectData.duration ?? 0) * (this.currentStats.effectDurationModifier ?? 1.0),
                potency: effectData.potency
            };
            this.applyStatusEffect(statusEffect, this);
        }
        
        // Play buff particle/sound effects if available
        if (this.particleSystem && attack.definition.hitParticleEffect) {
            this.particleSystem.playEffect(attack.definition.hitParticleEffect, this.x, this.y);
        }
        
        // TODO: Play sound effect if available
    }

    /**
     * Execute a ranged area denial attack
     */
    private executeRangedAreaDenialAttack(attack: IAttackInstance): void {
        // Similar to ranged attack but creates an area effect at the target location
        this.targetEnemy = this.findNearestEnemy();
        
        if (!this.targetEnemy?.active) {
            return; // No valid target
        }
        
        // Calculate direction to the target
        const targetPosition = new Phaser.Math.Vector2(this.targetEnemy.x, this.targetEnemy.y);
        const direction = new Phaser.Math.Vector2(targetPosition.x - this.x, targetPosition.y - this.y).normalize();
        
        // Face the target
        this.faceTarget(targetPosition.x);
        
        // TODO: Implement area denial attack logic
        // This would typically spawn a projectile that creates an area effect on impact
        // For now, we'll just use the basic projectile system
        
        const baseDamage = attack.definition.damage || 0;
        const effectiveDamage = baseDamage * (this.currentStats.damageModifier ?? 1.0);
        
        this.fireProjectile(attack, effectiveDamage, direction);
    }

    /**
     * Execute a melee area continuous attack
     */
    private executeMeleeAreaContinuousAttack(attack: IAttackInstance): void {
        // Similar to melee attack but deals damage over time in an area
        const range = attack.definition.range || 50;
        const aoeRange = attack.definition.areaOfEffect?.radius || range;
        const effectiveRange = aoeRange * (this.currentStats.areaOfEffectModifier ?? 1.0);
        
        // Find enemies in range
        const enemiesInRange = this.findEnemiesInRange(effectiveRange);
        
        if (enemiesInRange.length === 0) {
            return; // No enemies in range
        }
        
        // Determine direction for facing (e.g., towards the closest enemy)
        let closestEnemyInContinuous: EnemySprite | null = null;
        let minDistanceContinuous = Infinity;
        for (const enemy of enemiesInRange) {
            if (enemy && enemy.active) {
                const distance = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
                if (distance < minDistanceContinuous) {
                    minDistanceContinuous = distance;
                    closestEnemyInContinuous = enemy;
                }
            }
        }
        if (closestEnemyInContinuous) {
            this.faceTarget(closestEnemyInContinuous.x);
        }
        
        // Calculate effective damage
        const baseDamage = attack.definition.damage || 0;
        const effectiveDamage = baseDamage * (this.currentStats.damageModifier ?? 1.0);
        
        // Apply damage to all enemies in range
        for (const enemy of enemiesInRange) {
            enemy.takeDamage(effectiveDamage, this);
            
            // Apply status effect if specified
            if (attack.definition.statusEffectOnHit) {
                const effectData = attack.definition.statusEffectOnHit;
                enemy.applyStatusEffect({
                    id: `${effectData.effectType}_${Date.now()}`,
                    name: effectData.effectType,
                    type: effectData.effectType,
                    duration: (effectData.duration ?? 0) * (this.currentStats.effectDurationModifier ?? 1.0),
                    potency: effectData.potency
                }, this);
            }
        }
        
        // Play continuous attack particle effects if available
        if (this.particleSystem && attack.definition.hitParticleEffect) {
            this.particleSystem.playEffect(attack.definition.hitParticleEffect, this.x, this.y);
        }
        
        // TODO: Play sound effect if available
    }

    /**
     * Find enemies within a certain range
     */
    private findEnemiesInRange(range: number): EnemySprite[] {
        const enemiesInRange: EnemySprite[] = [];
        
        for (const enemyObj of this.enemies) {
            const enemy = enemyObj as EnemySprite;
            if (!enemy.active) continue;
            
            const distance = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
            if (distance <= range) {
                enemiesInRange.push(enemy);
            }
        }
        
        return enemiesInRange;
    }

    public updateStats(newStats: IPlayerStats): void {
        // Store previous maxHp to see if we need to heal
        const previousMaxHp = this.baseStats.maxHp;

        // Update all relevant stats from the passed in newStats
        this.baseStats.maxHp = newStats.maxHp;
        this.baseStats.maxSpeed = newStats.maxSpeed;
        this.baseStats.defense = newStats.defense;
        this.baseStats.attackCooldownModifier = newStats.attackCooldownModifier;
        this.baseStats.damageModifier = newStats.damageModifier;
        this.baseStats.projectileSpeedModifier = newStats.projectileSpeedModifier;
        this.baseStats.projectileSizeModifier = newStats.projectileSizeModifier;
        this.baseStats.areaOfEffectModifier = newStats.areaOfEffectModifier;
        this.baseStats.effectDurationModifier = newStats.effectDurationModifier;
        this.baseStats.xpGainModifier = newStats.xpGainModifier;
        this.baseStats.pickupRadiusModifier = newStats.pickupRadiusModifier;
        this.baseStats.luck = newStats.luck;

        this.recalculateStats(); // Recalculate currentStats based on new baseStats

        // If maxHp increased, heal the player to the new maxHp
        if (this.baseStats.maxHp > previousMaxHp) {
            this.currentStats.hp = this.currentStats.maxHp;
        }
        
        // Ensure health bar reflects the (potentially) new HP value immediately after healing
        this.updateHealthBar(); 

        // Update attack timers with new cooldown modifiers
        this.initializeAttackTimers();
    }

    public getProjectileScale(): number {
        return this.currentStats.projectileSizeModifier ?? 1.0;
    }

    /**
     * Update the list of enemies to target
     */
    public updateEnemiesInRange(enemies: Phaser.GameObjects.GameObject[]): void {
        this.enemies = enemies;
    }

    /**
     * Find and target the nearest enemy
     */
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

    /**
     * Process attack cooldowns and execute attacks
     */
    public updateAttacks(time: number, delta: number): void {
        // Update cooldowns for all attacks
        for (const attack of this.activeAttacks) {
            if (attack.currentCooldown > 0) {
                attack.currentCooldown -= delta;
            }
        }
    }

    /**
     * Add a new attack to the player's active attacks
     */
    public addAttack(attackId: string): boolean {
        // Check if attack already exists
        if (this.activeAttacks.some(attack => attack.definition.id === attackId)) {
            console.warn(`PlayerSprite: Attack ${attackId} already exists on player`);
            return false;
        }
        
        // Get attack definition
        const dataManager = DataManager.getInstance();
        const attackDef = dataManager.getAttackDefinition(attackId);
        
        if (!attackDef) {
            console.warn(`PlayerSprite: Attack definition not found for ID: ${attackId}`);
            return false;
        }
        
        // Add attack
        const newAttack: IAttackInstance = {
            definition: attackDef,
            currentCooldown: 0,
            lastFiredTimestamp: 0
        };
        
        this.activeAttacks.push(newAttack);
        
        // Add timer for the attack
        const effectiveCooldown = this.calculateEffectiveAttackCooldown(newAttack);
        const timer = this.scene.time.addEvent({
            delay: effectiveCooldown,
            callback: () => this.attemptAttack(newAttack),
            callbackScope: this,
            loop: true
        });
        
        this.shootingTimers.set(attackDef.id, timer);
        
        return true;
    }

    /**
     * Upgrade an existing attack
     */
    public upgradeAttack(attackId: string, modifier: string, stat: string, value: any): boolean {
        const attackIndex = this.activeAttacks.findIndex(a => a.definition.id === attackId);
        if (attackIndex === -1) {
            console.warn(`PlayerSprite: Attack ${attackId} not found for upgrade.`);
            return false;
        }
        const attack = this.activeAttacks[attackIndex];
        // Robust check for attack instance
        if (!attack || !attack.definition) { 
            console.warn(`PlayerSprite: Attack instance or definition for ${attackId} is undefined after findIndex.`);
            return false;
        }

        const modifierType = modifier || "FLAT_ADD"; 
        
        // Apply the upgrade based on modifier type
        switch (modifierType) {
            case 'FLAT_SET':
                // Directly set the value
                // This would require modifying the attack definition, which we don't want to do
                // Instead, we'll store the effective value on the instance
                switch (stat) {
                    case 'damage':
                        attack.effectiveDamage = value;
                        break;
                    case 'attackCooldown':
                        attack.effectiveAttackCooldown = value;
                        // Update the timer
                        this.updateAttackTimer(attack);
                        break;
                    case 'range':
                        attack.effectiveRange = value;
                        break;
                    case 'projectilesPerShot':
                        attack.effectiveProjectilesPerShot = value;
                        break;
                    // Add more cases as needed
                    default:
                        console.warn(`PlayerSprite: Unknown stat ${stat} for upgrade`);
                        return false;
                }
                break;
                
            case 'FLAT_ADD':
                // Add to the current value
                switch (stat) {
                    case 'damage':
                        attack.effectiveDamage = (attack.effectiveDamage ?? attack.definition.damage ?? 0) + value;
                        break;
                    case 'attackCooldown':
                        attack.effectiveAttackCooldown = (attack.effectiveAttackCooldown ?? attack.definition.attackCooldown ?? 0) + value;
                        // Update the timer
                        this.updateAttackTimer(attack);
                        break;
                    case 'range':
                        attack.effectiveRange = (attack.effectiveRange ?? attack.definition.range ?? 0) + value;
                        break;
                    case 'projectilesPerShot':
                        attack.effectiveProjectilesPerShot = (attack.effectiveProjectilesPerShot ?? attack.definition.projectilesPerShot ?? 1) + value;
                        break;
                    // Add more cases as needed
                    default:
                        console.warn(`PlayerSprite: Unknown stat ${stat} for upgrade`);
                        return false;
                }
                break;
                
            case 'PERCENTAGE_MULTIPLY':
                // Multiply the current value by the percentage
                switch (stat) {
                    case 'damage':
                        attack.effectiveDamage = (attack.effectiveDamage ?? attack.definition.damage ?? 0) * value;
                        break;
                    case 'attackCooldown':
                        attack.effectiveAttackCooldown = (attack.effectiveAttackCooldown ?? attack.definition.attackCooldown ?? 0) * value;
                        // Update the timer
                        this.updateAttackTimer(attack);
                        break;
                    case 'range':
                        attack.effectiveRange = (attack.effectiveRange ?? attack.definition.range ?? 0) * value;
                        break;
                    case 'projectilesPerShot':
                        attack.effectiveProjectilesPerShot = (attack.effectiveProjectilesPerShot ?? attack.definition.projectilesPerShot ?? 1) * value;
                        break;
                    // Add more cases as needed
                    default:
                        console.warn(`PlayerSprite: Unknown stat ${stat} for upgrade`);
                        return false;
                }
                break;
                
            default:
                console.warn(`PlayerSprite: Unknown modifier ${modifier} for upgrade`);
                return false;
        }
        
        return true;
    }

    /**
     * Update the timer for an attack after its cooldown has been modified
     */
    private updateAttackTimer(attack: IAttackInstance): void {
        // Get the timer
        const timer = this.shootingTimers.get(attack.definition.id);
        
        if (!timer) {
            console.warn(`PlayerSprite: Timer not found for attack ${attack.definition.id}`);
            return;
        }
        
        // Calculate new cooldown
        const effectiveCooldown = this.calculateEffectiveAttackCooldown(attack);
        
        // Update timer
        timer.reset({
            delay: effectiveCooldown,
            callback: () => this.attemptAttack(attack),
            callbackScope: this,
            loop: true
        });
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
        const speed = this.currentStats.maxSpeed || DEFAULT_PLAYER_BASE_STATS.maxSpeed; // Use currentStats

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
     * Main update method called by the scene
     */
    override update(time: number, delta: number): void {
        // Call parent update
        super.update(time, delta);
        
        // Update attacks
        this.updateAttacks(time, delta);
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
        // Clean up all timers
        this.shootingTimers.forEach(timer => timer.destroy());
        this.shootingTimers.clear();
        
        // Ensure scene context still exists before trying to remove listeners
        if (this.scene) {
            this.scene.events.off(GameEvent.PLAYER_STATS_UPDATED, this.updateStats, this); // Clean up listener
        }
        super.destroy(fromScene);
    }
} 