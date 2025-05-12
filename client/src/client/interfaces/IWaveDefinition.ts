/**
 * Defines a single enemy group within a wave
 */
export interface IEnemyGroup {
  enemyType: string;    // Enemy name/type from enemies.json
  count: number;        // How many of this enemy to spawn
  spawnInterval: number; // Interval in ms between spawning each enemy
  spawnDelay?: number;  // Delay in ms before starting to spawn this group (optional)
}

/**
 * Defines a wave of enemies to spawn during gameplay
 */
export interface IWaveDefinition {
  waveNumber: number;     // Wave number/identifier (1, 2, 3, etc.)
  waveStartMessage: string; // Message to display when wave starts
  enemyGroups: IEnemyGroup[]; // The groups of enemies to spawn in this wave
  timeToNextWave?: number; // Time in ms until the next wave starts (optional)
} 