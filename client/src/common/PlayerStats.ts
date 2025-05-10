export interface IPlayerStats {
  movementSpeed: number;
  projectileSpeed: number;
  projectileDamage: number;
  projectileSize: number;
  defense: number;
  attackSpeed: number; // Lower is faster (e.g., cooldown in ms)
  maxHealth: number;
  // Future stat ideas:
  // luck: number; // (affects drop rates, crit chance, etc.)
  // pickupRadius: number; // for experience gems, items
  // projectileCount: number;
  // areaOfEffect: number; // for certain weapons
  // duration: number; // for time-based weapons/effects
  // regen: number; // health per second
}

export const DEFAULT_PLAYER_STATS: IPlayerStats = {
  movementSpeed: 200, // Example: pixels per second
  projectileSpeed: 300, // Example: pixels per second
  projectileDamage: 10,
  projectileSize: 1.0, // Example: scale factor
  defense: 0, // Example: damage reduction
  attackSpeed: 500, // Example: milliseconds between attacks
  maxHealth: 100,
};

// We can also define types for upgrades
export type UpgradeType = 
  | 'movementSpeed' 
  | 'projectileSpeed' 
  | 'projectileDamage' 
  | 'projectileSize' 
  | 'defense' 
  | 'attackSpeed'
  // Note: maxHealth is not listed as an UpgradeType yet, but could be added
  ;

export interface UpgradeChoice {
  id: string; // Unique ID for the choice, e.g., "speed_1", "damage_3"
  type: UpgradeType;
  name: string; // Display name, e.g., "Swift Boots"
  description: string; // "Increases movement speed by 10%"
  apply: (stats: IPlayerStats) => IPlayerStats; // Function to apply the upgrade
  level?: number; // Optional: if upgrades have levels
  icon?: string; // Optional: path to an icon texture
} 