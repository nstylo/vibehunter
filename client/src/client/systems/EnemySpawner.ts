import Phaser from 'phaser';
import { EnemySprite } from '../objects/EnemySprite';
import type { PlayerSprite } from '../objects/PlayerSprite';
import type { ParticleSystem } from './ParticleSystem';

// New Interfaces for Wave System
export interface EnemyGroupInWave {
    enemyType: string;
    count: number;
    spawnDelay?: number; // Milliseconds after the wave starts or previous group finishes for this group to start
    spawnInterval?: number; // Milliseconds between each enemy spawn within this group
}

export interface WaveDefinition {
    waveNumber: number;
    enemyGroups: EnemyGroupInWave[];
    timeToNextWave?: number; // Milliseconds delay after this wave is cleared before starting the next
    waveStartMessage?: string; // Optional message when wave starts
}

export class EnemySpawner {
    private scene: Phaser.Scene;
    private player: PlayerSprite;
    private enemyGroup: Phaser.GameObjects.Group;
    private waveDefinitions: WaveDefinition[];
    private particleSystem?: ParticleSystem;

    private currentWaveNumber = 0;
    private enemiesToSpawnInCurrentWave = 0;
    private enemiesSpawnedInCurrentWave = 0;
    private enemiesAliveInCurrentWave = 0;
    private enemiesKilledInCurrentWave = 0;
    
    private waveInProgress = false;
    private waveSpawnTimers: Phaser.Time.TimerEvent[] = []; // For managing intra-wave spawning logic
    private nextWaveTimer?: Phaser.Time.TimerEvent; // For delay between waves

    constructor(
        scene: Phaser.Scene, 
        player: PlayerSprite, 
        enemyGroup: Phaser.GameObjects.Group, 
        waveDefinitions: WaveDefinition[],
        particleSystem?: ParticleSystem
    ) {
        this.scene = scene;
        this.player = player;
        this.enemyGroup = enemyGroup;
        this.waveDefinitions = waveDefinitions.sort((a, b) => a.waveNumber - b.waveNumber); // Ensure waves are ordered
        this.particleSystem = particleSystem;
    }

    public startWaveSystem(startWave = 1): void {
        this.stopWaveSystem(); // Clear any existing state
        this.currentWaveNumber = startWave - 1; // Will be incremented by startNextWave
        this.startNextWave();
    }

    public stopWaveSystem(): void {
        for (const timer of this.waveSpawnTimers) {
            timer.destroy();
        }
        this.waveSpawnTimers = [];
        if (this.nextWaveTimer) {
            this.nextWaveTimer.destroy();
            this.nextWaveTimer = undefined;
        }
        this.waveInProgress = false;
        // Optionally, could also destroy all enemies managed by this spawner if desired
    }

    private startNextWave(): void {
        if (this.waveInProgress && this.enemiesAliveInCurrentWave > 0) {
            return;
        }

        this.currentWaveNumber++;
        const waveDef = this.waveDefinitions.find(w => w.waveNumber === this.currentWaveNumber);

        if (!waveDef) {
            this.waveInProgress = false;
            this.scene.events.emit('allWavesCleared'); 
            return;
        }

        this.waveInProgress = true;
        this.enemiesSpawnedInCurrentWave = 0;
        this.enemiesAliveInCurrentWave = 0;
        this.enemiesKilledInCurrentWave = 0;
        this.enemiesToSpawnInCurrentWave = waveDef.enemyGroups.reduce((total, group) => total + group.count, 0);
        
        // Emit an event that a new wave is starting (e.g., for UI updates)
        this.scene.events.emit('waveStart', { waveNumber: this.currentWaveNumber, totalEnemies: this.enemiesToSpawnInCurrentWave });

        this.spawnWaveEnemies(waveDef);
    }

    private spawnWaveEnemies(waveDef: WaveDefinition): void {
        let cumulativeDelay = 0;

        for (const group of waveDef.enemyGroups) {
            const groupSpawnDelay = cumulativeDelay + (group.spawnDelay || 0);
            
            for (let i = 0; i < group.count; i++) {
                const individualSpawnTime = groupSpawnDelay + (i * (group.spawnInterval || 500)); // Default 500ms interval if not specified
                
                const timer = this.scene.time.delayedCall(individualSpawnTime, () => {
                    if (!this.waveInProgress || !this.player.active) {
                         // Stop spawning if wave ended prematurely or player is inactive
                        return;
                    }
                    this.spawnSingleEnemy(group.enemyType);
                    this.enemiesSpawnedInCurrentWave++;
                    this.enemiesAliveInCurrentWave++;
                     // console.log(`EnemySpawner: Spawned ${group.enemyType}. Total spawned in wave: ${this.enemiesSpawnedInCurrentWave}/${this.enemiesToSpawnInCurrentWave}. Alive: ${this.enemiesAliveInCurrentWave}`);
                });
                this.waveSpawnTimers.push(timer);
            }
            // Estimate time for this group to finish spawning for the next group's cumulativeDelay
            // This is a rough estimate; more precise chaining could be done if needed.
            cumulativeDelay = groupSpawnDelay + (group.count * (group.spawnInterval || 500));
        }
         // console.log(`EnemySpawner: Scheduled ${this.waveSpawnTimers.length} individual enemy spawns for wave ${waveDef.waveNumber}.`);
    }
    
    private spawnSingleEnemy(enemyType: string): void {
        if (!this.player.active) {
            // console.log('EnemySpawner: Player not active, skipping single enemy spawn.');
            return;
        }

        const gameWidth = this.scene.cameras.main.width;
        const gameHeight = this.scene.cameras.main.height;
        const buffer = 50; // Pixels to ensure enemy is off-screen

        const halfW = gameWidth / 2;
        const halfH = gameHeight / 2;

        const side = Math.floor(Math.random() * 4); // 0: Left, 1: Right, 2: Top, 3: Bottom
        let spawnX: number;
        let spawnY: number;

        if (side === 0) { // Spawn on the Left
            spawnX = this.player.x - halfW - buffer;
            spawnY = this.player.y + (Math.random() - 0.5) * gameHeight;
        } else if (side === 1) { // Spawn on the Right
            spawnX = this.player.x + halfW + buffer;
            spawnY = this.player.y + (Math.random() - 0.5) * gameHeight;
        } else if (side === 2) { // Spawn on the Top
            spawnX = this.player.x + (Math.random() - 0.5) * gameWidth;
            spawnY = this.player.y - halfH - buffer;
        } else { // Spawn on the Bottom (side === 3)
            spawnX = this.player.x + (Math.random() - 0.5) * gameWidth;
            spawnY = this.player.y + halfH + buffer;
        }
        
        const enemyId = Phaser.Utils.String.UUID();

        const newEnemy = new EnemySprite(
            this.scene,
            spawnX,
            spawnY,
            enemyId,
            enemyType,
            this.player,
            this.particleSystem
        );
        this.enemyGroup.add(newEnemy);
        // console.log(`EnemySpawner: Spawned ${enemyType} at (${spawnX.toFixed(2)}, ${spawnY.toFixed(2)})`);
    }

    public notifyEnemyDefeated(enemy: EnemySprite): void {
        if (!this.waveInProgress) return;

        this.enemiesAliveInCurrentWave--;
        this.enemiesKilledInCurrentWave++;
        
        // Emit event for UI update (enemies remaining)
        this.scene.events.emit('enemyDefeatedInWave', { 
            waveNumber: this.currentWaveNumber, 
            enemiesRemaining: this.enemiesToSpawnInCurrentWave - this.enemiesKilledInCurrentWave,
            totalSpawnedThisWave: this.enemiesSpawnedInCurrentWave,
            totalToSpawnThisWave: this.enemiesToSpawnInCurrentWave
        });

        if (this.enemiesAliveInCurrentWave <= 0 && this.enemiesSpawnedInCurrentWave >= this.enemiesToSpawnInCurrentWave) {
            this.waveInProgress = false;
            for (const timer of this.waveSpawnTimers) { // Clear any remaining spawn timers for this wave
                timer.destroy();
            }
            this.waveSpawnTimers = [];

            // Emit event for wave clear
            this.scene.events.emit('waveClear', { waveNumber: this.currentWaveNumber });
            
            const currentWaveDef = this.waveDefinitions.find(w => w.waveNumber === this.currentWaveNumber);
            const delayToNextWave = currentWaveDef?.timeToNextWave ?? 3000; // Default 3s delay

            if (this.nextWaveTimer) this.nextWaveTimer.destroy(); // Clear previous if any
            
            // Check if there's a next wave before setting up the timer
            const nextWaveExists = this.waveDefinitions.some(w => w.waveNumber === this.currentWaveNumber + 1);
            if (nextWaveExists) {
                this.nextWaveTimer = this.scene.time.delayedCall(delayToNextWave, this.startNextWave, [], this);
            } else {
                this.scene.events.emit('allWavesCleared'); // Ensure this is emitted if it's the absolute last wave
            }
        }
    }
    
    // Getter methods for UI or other systems
    public getCurrentWaveNumber(): number {
        return this.currentWaveNumber;
    }

    public getEnemiesAliveInCurrentWave(): number {
        return this.enemiesAliveInCurrentWave;
    }
    
    public getTotalEnemiesForCurrentWave(): number {
        const waveDef = this.waveDefinitions.find(w => w.waveNumber === this.currentWaveNumber);
        return waveDef ? waveDef.enemyGroups.reduce((total, group) => total + group.count, 0) : 0;
    }

    // The update method might not be strictly necessary if using Phaser TimerEvents for spawning,
    // but can be used for other logic if needed, e.g., adjusting spawn rates dynamically.
    public update(time: number, delta: number): void {
        // Future: Dynamic adjustments to spawning based on game state, player performance, etc.
        // Or, for example, checking if all scheduled spawn timers are done and player is still alive
        // to ensure wave progression isn't stuck if some enemies fail to spawn.
    }

    // Old methods to be removed or that were placeholders:
    // public addSpawnConfig(config: EnemySpawnConfig): void { ... }
    // public startSpawning(): void { ... }
    // public getActiveEnemyCount(): number { ... }
} 