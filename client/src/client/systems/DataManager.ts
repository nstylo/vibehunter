import type { IAttackDefinition } from '../interfaces/IAttackDefinition';
import type { IPlayerCharacterDefinition } from '../interfaces/IPlayerCharacterDefinition';
import type { IEnemyDefinition } from '../interfaces/IEnemyDefinition';
import type { IUpgradeDefinitions } from '../interfaces/IUpgradeDefinition';
import type { IProjectileDefinition } from '../interfaces/IProjectileDefinition';
import type { IStatusEffectDefinition } from '../interfaces/IStatusEffect';
import type { IWaveDefinition } from '../interfaces/IWaveDefinition';

/**
 * A singleton manager class that handles loading and providing access to game data definitions.
 * This centralizes all JSON data access throughout the game.
 */
export class DataManager {
  private static instance: DataManager;

  // Cached definition data
  private attackDefinitions: IAttackDefinition[] = [];
  private characterDefinitions: Record<string, IPlayerCharacterDefinition> = {};
  private enemyDefinitions: IEnemyDefinition[] = [];
  private upgradeDefinitions: IUpgradeDefinitions = { general_upgrades: [], attack_upgrades: [] };
  private projectileDefinitions: IProjectileDefinition[] = [];
  private statusEffectDefinitions: IStatusEffectDefinition[] = [];
  private waveDefinitions: IWaveDefinition[] = [];

  // Track loading state
  private isDataLoaded = false;

  private constructor() {
    // Private constructor to enforce singleton pattern
  }

  /**
   * Get the singleton instance of DataManager
   */
  public static getInstance(): DataManager {
    if (!DataManager.instance) {
      DataManager.instance = new DataManager();
    }
    return DataManager.instance;
  }

  /**
   * Load all necessary data files. This method should be called during the boot/preload phase
   * before any other game systems try to access the data.
   * 
   * @param loadCharactersFromPublic - Whether to load characters from public folder (true) or from src (false)
   */
  public async loadAllData(loadCharactersFromPublic = true): Promise<void> {
    try {
      // Load attack definitions
      const attacksData = await import('../definitions/attacks.json').then(module => module.default);
      this.attackDefinitions = this.transformAttackData(attacksData);
      
      // Load character definitions - either from public folder or src folder
      if (loadCharactersFromPublic) {
        const charactersData = await fetch('/assets/characters/characters.json')
          .then(response => response.json())
          .catch(error => {
            console.error('Failed to load characters.json from public folder:', error);
            return {};
          });
        this.characterDefinitions = this.transformCharacterData(charactersData);
      } else {
        const charactersData = await import('../../assets/characters/characters.json')
          .then(module => module.default)
          .catch(error => {
            console.error('Failed to load characters.json from src folder:', error);
            return {};
          });
        this.characterDefinitions = this.transformCharacterData(charactersData);
      }

      // Load enemy definitions
      const enemiesData = await import('../definitions/enemies.json').then(module => module.default);
      this.enemyDefinitions = this.transformEnemyData(enemiesData);
      
      // Load upgrade definitions
      const upgradesData = await import('../definitions/upgrades.json').then(module => module.default);
      this.upgradeDefinitions = this.transformUpgradeData(upgradesData);
      
      // Load projectile definitions
      const projectilesData = await import('../definitions/projectiles.json').then(module => module.default);
      this.projectileDefinitions = this.transformProjectileData(projectilesData);
      
      // Load status effect definitions
      const statusEffectsData = await import('../definitions/statusEffects.json').then(module => module.default);
      this.statusEffectDefinitions = this.transformStatusEffectData(statusEffectsData);
      
      // Load wave definitions
      const wavesData = await import('../definitions/waves.json').then(module => module.default);
      this.waveDefinitions = this.transformWaveData(wavesData);

      this.isDataLoaded = true;
    } catch (error) {
      console.error('Error loading game data:', error);
      throw new Error('Failed to load critical game data');
    }
  }

  /**
   * Synchronous version for use with Phaser's asset loading system.
   * Call this after the scene has loaded all JSON files via the Phaser loader.
   * 
   * @param scene - The Phaser scene that has loaded the JSON files
   */
  public loadFromPhaserCache(scene: Phaser.Scene): void {
    try {
      // Get data from Phaser cache
      const attacksData = scene.cache.json.get('attackDefinitions');
      this.attackDefinitions = this.transformAttackData(attacksData);
      
      const charactersData = scene.cache.json.get('characterDefinitions');
      this.characterDefinitions = this.transformCharacterData(charactersData);
      
      const enemiesData = scene.cache.json.get('enemyDefinitions');
      this.enemyDefinitions = this.transformEnemyData(enemiesData);
      
      const upgradesData = scene.cache.json.get('upgradeDefinitions');
      this.upgradeDefinitions = this.transformUpgradeData(upgradesData);
      
      const projectilesData = scene.cache.json.get('projectileDefinitions');
      this.projectileDefinitions = this.transformProjectileData(projectilesData);
      
      const statusEffectsData = scene.cache.json.get('statusEffectDefinitions');
      this.statusEffectDefinitions = this.transformStatusEffectData(statusEffectsData);
      
      const wavesData = scene.cache.json.get('waveDefinitions');
      this.waveDefinitions = this.transformWaveData(wavesData);

      this.isDataLoaded = true;
    } catch (error) {
      console.error('Error loading game data from Phaser cache:', error);
      throw new Error('Failed to load critical game data');
    }
  }

  /**
   * Get attack definition by ID
   */
  public getAttackDefinition(id: string): IAttackDefinition | undefined {
    this.ensureDataLoaded();
    return this.attackDefinitions.find(attack => attack.id === id);
  }

  /**
   * Get all attack definitions
   */
  public getAllAttackDefinitions(): IAttackDefinition[] {
    this.ensureDataLoaded();
    return [...this.attackDefinitions];
  }

  /**
   * Get player character definition by ID
   */
  public getCharacterDefinition(id: string): IPlayerCharacterDefinition | undefined {
    this.ensureDataLoaded();
    return this.characterDefinitions[id];
  }

  /**
   * Get all character definitions
   */
  public getAllCharacterDefinitions(): Record<string, IPlayerCharacterDefinition> {
    this.ensureDataLoaded();
    return { ...this.characterDefinitions };
  }

  /**
   * Get enemy definition by name
   */
  public getEnemyDefinition(name: string): IEnemyDefinition | undefined {
    this.ensureDataLoaded();
    return this.enemyDefinitions.find(enemy => enemy.name === name);
  }

  /**
   * Get all enemy definitions
   */
  public getAllEnemyDefinitions(): IEnemyDefinition[] {
    this.ensureDataLoaded();
    return [...this.enemyDefinitions];
  }

  /**
   * Get all upgrade definitions
   */
  public getUpgradeDefinitions(): IUpgradeDefinitions {
    this.ensureDataLoaded();
    return { ...this.upgradeDefinitions };
  }

  /**
   * Get projectile definition by key
   */
  public getProjectileDefinition(key: string): IProjectileDefinition | undefined {
    this.ensureDataLoaded();
    return this.projectileDefinitions.find(projectile => projectile.key === key);
  }

  /**
   * Get all projectile definitions
   */
  public getAllProjectileDefinitions(): IProjectileDefinition[] {
    this.ensureDataLoaded();
    return [...this.projectileDefinitions];
  }

  /**
   * Get status effect definition by ID
   */
  public getStatusEffectDefinition(id: string): IStatusEffectDefinition | undefined {
    this.ensureDataLoaded();
    return this.statusEffectDefinitions.find(effect => effect.id === id);
  }

  /**
   * Get all status effect definitions
   */
  public getAllStatusEffectDefinitions(): IStatusEffectDefinition[] {
    this.ensureDataLoaded();
    return [...this.statusEffectDefinitions];
  }

  /**
   * Get wave definition by wave number
   */
  public getWaveDefinition(waveNumber: number): IWaveDefinition | undefined {
    this.ensureDataLoaded();
    return this.waveDefinitions.find(wave => wave.waveNumber === waveNumber);
  }

  /**
   * Get all wave definitions
   */
  public getAllWaveDefinitions(): IWaveDefinition[] {
    this.ensureDataLoaded();
    return [...this.waveDefinitions];
  }

  /**
   * Ensures that data has been loaded before attempting to access it
   */
  private ensureDataLoaded(): void {
    if (!this.isDataLoaded) {
      throw new Error('Game data has not been loaded. Call loadAllData() first.');
    }
  }

  /**
   * Transform raw attack data into typed IAttackDefinition objects
   */
  private transformAttackData(data: any): IAttackDefinition[] {
    if (!Array.isArray(data)) {
      console.warn('Attack data is not an array, returning empty array');
      return [];
    }
    
    return data.map(attack => {
      // Ensure type is one of the allowed values
      const validTypes = ["MELEE", "RANGED", "SUPPORT", "BUFF_SELF", "RANGED_AREA_DENIAL", "MELEE_AREA_CONTINUOUS"];
      const type = validTypes.includes(attack.type) 
        ? attack.type as IAttackDefinition['type'] 
        : "MELEE"; // Default if invalid

      return {
        ...attack,
        type
      } as IAttackDefinition;
    });
  }

  /**
   * Transform raw character data into typed IPlayerCharacterDefinition objects
   */
  private transformCharacterData(data: any): Record<string, IPlayerCharacterDefinition> {
    if (typeof data !== 'object' || data === null) {
      console.warn('Character data is not an object, returning empty object');
      return {};
    }
    
    const result: Record<string, IPlayerCharacterDefinition> = {};
    
    for (const [id, character] of Object.entries(data)) {
      if (typeof character === 'object' && character !== null) {
        // Add the id to the character object and ensure startingAttacks exists
        result[id] = {
          ...(character as any),
          id,
          startingAttacks: (character as any).startingAttacks || []
        } as IPlayerCharacterDefinition;
      }
    }
    
    return result;
  }

  /**
   * Transform raw enemy data into typed definitions
   */
  private transformEnemyData(data: any): IEnemyDefinition[] {
    return data.map((item: any) => ({
      name: item.name || 'unknown_enemy',
      assetUrl: item.assetUrl || '',
      width: item.width || 32,
      height: item.height || 32,
      maxHp: item.maxHp || item.defaultHp || 10, // Support both old and new property names
      maxSpeed: item.maxSpeed || item.defaultMaxSpeed || 50, // Support both old and new property names
      xpValue: item.xpValue || 5,
      meleeDamage: item.meleeDamage,
      attackCooldown: item.attackCooldown,
      defense: item.defense || 0,
      attacks: Array.isArray(item.attacks) ? item.attacks : [],
      sightRange: item.sightRange || 300,
      isRanged: item.isRanged === true, // Ensure boolean
      meleeAttackRange: item.meleeAttackRange || 60, // Default to 60
      rangedAttackRange: item.isRanged ? (item.rangedAttackRange || 300) : null, // Default to 300 for ranged enemies
      projectileType: item.projectileType // Pass through any projectileType
    }));
  }

  /**
   * Transform raw upgrade data into typed IUpgradeDefinitions object
   */
  private transformUpgradeData(data: any): IUpgradeDefinitions {
    if (typeof data !== 'object' || data === null) {
      console.warn('Upgrade data is not an object, returning empty upgrade definitions');
      return { general_upgrades: [], attack_upgrades: [] };
    }
    
    // Transform general upgrades to ensure they match IGeneralUpgradeDefinition
    const general_upgrades = Array.isArray(data.general_upgrades)
      ? data.general_upgrades.map((upgrade: any) => {
          const effects = Array.isArray(upgrade.effects)
            ? upgrade.effects.map((effect: any) => {
                // Ensure each effect has valid stat and modifier values
                const validStats = [
                  'maxHp', 'maxSpeed', 'defense', 'attackCooldownModifier', 
                  'damageModifier', 'projectileSpeedModifier', 'projectileSizeModifier',
                  'areaOfEffectModifier', 'effectDurationModifier', 'xpGainModifier', 
                  'pickupRadiusModifier', 'luck'
                ];
                
                const validModifiers = ["FLAT_SET", "FLAT_ADD", "PERCENTAGE_MULTIPLY"];
                
                return {
                  stat: validStats.includes(effect.stat) ? effect.stat : validStats[0],
                  modifier: validModifiers.includes(effect.modifier) ? effect.modifier : "FLAT_ADD",
                  value: typeof effect.value === 'number' ? effect.value : 0
                };
              })
            : [];
            
          return {
            id: upgrade.id,
            name: upgrade.name,
            description: upgrade.description,
            maxLevel: upgrade.maxLevel,
            effects
          };
        })
      : [];
      
    // Transform attack upgrades
    const attack_upgrades = Array.isArray(data.attack_upgrades)
      ? data.attack_upgrades.map((upgrade: any) => {
          if (upgrade.type === "UNLOCK_ATTACK") {
            return {
              id: upgrade.id,
              name: upgrade.name,
              description: upgrade.description,
              maxLevel: upgrade.maxLevel,
              type: "UNLOCK_ATTACK",
              attackId: upgrade.attackId
            };
          } else if (upgrade.type === "MODIFY_ATTACK") {
            const effects = Array.isArray(upgrade.effects)
              ? upgrade.effects.map((effect: any) => {
                  // Valid attack stats
                  const validStats = [
                    'damage', 'attackCooldown', 'range', 'projectilesPerShot',
                    'spreadAngle', 'knockbackForce', 'duration', 'tickRate',
                    'areaOfEffect.radius', 'areaOfEffect.width', 'areaOfEffect.height'
                  ];
                  
                  const validModifiers = ["FLAT_SET", "FLAT_ADD", "PERCENTAGE_MULTIPLY"];
                  
                  return {
                    stat: validStats.includes(effect.stat) ? effect.stat : validStats[0],
                    modifier: validModifiers.includes(effect.modifier) ? effect.modifier : "FLAT_ADD",
                    value: typeof effect.value === 'number' ? effect.value : 0
                  };
                })
              : [];
              
            return {
              id: upgrade.id,
              name: upgrade.name,
              description: upgrade.description,
              maxLevel: upgrade.maxLevel,
              type: "MODIFY_ATTACK",
              targetAttackId: upgrade.targetAttackId,
              effects
            };
          } else if (upgrade.type === "MODIFY_ALL_PLAYER_ATTACKS") {
            const effects = Array.isArray(upgrade.effects)
              ? upgrade.effects.map((effect: any) => {
                  // Valid attack stats
                  const validStats = [
                    'damage', 'attackCooldown', 'range', 'projectilesPerShot',
                    'spreadAngle', 'knockbackForce', 'duration', 'tickRate',
                    'areaOfEffect.radius', 'areaOfEffect.width', 'areaOfEffect.height'
                  ];
                  
                  const validModifiers = ["FLAT_SET", "FLAT_ADD", "PERCENTAGE_MULTIPLY"];
                  
                  return {
                    stat: validStats.includes(effect.stat) ? effect.stat : validStats[0],
                    modifier: validModifiers.includes(effect.modifier) ? effect.modifier : "FLAT_ADD",
                    value: typeof effect.value === 'number' ? effect.value : 0
                  };
                })
              : [];
              
            return {
              id: upgrade.id,
              name: upgrade.name,
              description: upgrade.description,
              maxLevel: upgrade.maxLevel,
              type: "MODIFY_ALL_PLAYER_ATTACKS",
              effects
            };
          } else {
            // Default case
            return {
              id: upgrade.id,
              name: upgrade.name,
              description: upgrade.description,
              maxLevel: upgrade.maxLevel,
              type: "UNLOCK_ATTACK",
              attackId: upgrade.attackId || ""
            };
          }
        })
      : [];
    
    return {
      general_upgrades,
      attack_upgrades
    };
  }

  /**
   * Transform raw projectile data into typed IProjectileDefinition objects
   */
  private transformProjectileData(data: any): IProjectileDefinition[] {
    if (!Array.isArray(data)) {
      console.warn('Projectile data is not an array, returning empty array');
      return [];
    }
    
    return data.map(projectile => {
      return {
        key: projectile.key || projectile.type || "", // Support legacy 'type' field
        displayName: projectile.displayName || projectile.type || "",
        spriteKey: projectile.spriteKey || projectile.textureName || "",
        width: projectile.width || 32,
        height: projectile.height || 32,
        hitboxWidth: projectile.hitboxWidth,
        hitboxHeight: projectile.hitboxHeight,
        animationKey: projectile.animationKey,
        tint: projectile.tint || (projectile.color ? parseInt(projectile.color.replace('0x', ''), 16) : undefined),
        alpha: projectile.alpha,
        scaleX: projectile.scaleX,
        scaleY: projectile.scaleY,
        rotationSpeed: projectile.rotationSpeed,
        trailEmitter: projectile.trailEmitter,
        impactEmitter: projectile.impactEmitter || projectile.impactParticleEffect,
        launchSoundKey: projectile.launchSoundKey,
        impactSoundKey: projectile.impactSoundKey,
        piercing: projectile.piercing,
        maxPierceCount: projectile.maxPierceCount,
        bouncing: projectile.bouncing,
        maxBounceCount: projectile.maxBounceCount,
        statusEffectKey: projectile.statusEffectKey,
        statusEffectChance: projectile.statusEffectChance
      } as IProjectileDefinition;
    });
  }

  /**
   * Transform raw status effect data into typed IStatusEffectDefinition objects
   */
  private transformStatusEffectData(data: any): IStatusEffectDefinition[] {
    if (!Array.isArray(data)) {
      console.warn('Status effect data is not an array, returning empty array');
      return [];
    }
    
    return data.map(effect => {
      return {
        id: effect.id,
        name: effect.name,
        description: effect.description,
        type: effect.type,
        durationMs: effect.durationMs,
        defaultPotency: effect.defaultPotency,
        isPeriodic: effect.isPeriodic,
        defaultTickRateMs: effect.defaultTickRateMs,
        visualEffect: effect.visualEffect,
        soundEffect: effect.soundEffect
      } as IStatusEffectDefinition;
    });
  }

  /**
   * Transform wave data into typed definitions
   */
  private transformWaveData(data: any): IWaveDefinition[] {
    if (!Array.isArray(data)) {
      console.warn('Wave data is not an array, returning empty array');
      return [];
    }
    
    return data.map(wave => {
      return {
        waveNumber: wave.waveNumber || 0,
        waveStartMessage: wave.waveStartMessage || '',
        enemyGroups: Array.isArray(wave.enemyGroups) ? wave.enemyGroups.map((group: any) => ({
          enemyType: group.enemyType || '',
          count: group.count || 0,
          spawnInterval: group.spawnInterval || 1000,
          spawnDelay: group.spawnDelay
        })) : [],
        timeToNextWave: wave.timeToNextWave
      } as IWaveDefinition;
    });
  }
}

// Export a default instance for convenience
export default DataManager.getInstance(); 