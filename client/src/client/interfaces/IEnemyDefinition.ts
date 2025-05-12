/**
 * Defines the initial properties of an enemy type, loaded from enemies.json.
 */
export interface IEnemyDefinition {
    name: string; // Unique key for the enemy type
    assetUrl: string;
    width: number;
    height: number;
    attacks: string[]; // Array of Attack IDs from attacks.json
    sightRange: number;
    isRanged: boolean; // Added: Indicates if the enemy primarily uses ranged attacks
    meleeAttackRange: number; // Added: The range for melee attacks
    rangedAttackRange?: number; // Added: The range for ranged attacks (optional)
    projectileType?: string; // Added: The default projectile type key (optional)

    // Stats that should be loaded from enemies.json
    maxHp?: number; 
    maxSpeed?: number;
    defense?: number;
    xpValue?: number;
    meleeDamage?: number;      // Optional: Base melee damage for the enemy type
    attackCooldown?: number;   // Optional: Base attack cooldown for the enemy type
} 