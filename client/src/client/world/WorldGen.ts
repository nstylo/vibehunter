import FastNoiseLite from 'fastnoise-lite';
import { CellType, getCellTypeFromNoiseValue } from '../../common/world';

// Dimensions for the world map (in cells)
const MAP_WIDTH_CELLS = 1000;
const MAP_HEIGHT_CELLS = 1000;

export class WorldGen {
    private noise: FastNoiseLite;
    private seed: number;
    public worldData: CellType[][]; // 2D array to store the generated world

    constructor(seed: number) {
        this.seed = seed;
        this.noise = new FastNoiseLite(this.seed);
        this.configureNoise();
        this.worldData = this.initializeWorldData();
        this.generate();
    }

    private configureNoise(): void {
        // Configuration from world.mdc
        this.noise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
        this.noise.SetFractalType(FastNoiseLite.FractalType.FBm);
        this.noise.SetFrequency(0.015);
        this.noise.SetFractalOctaves(3);
        this.noise.SetFractalLacunarity(2.0);
        this.noise.SetFractalGain(0.5);
    }

    private initializeWorldData(): CellType[][] {
        // Ensure worldData is a 2D array of the correct dimensions
        return Array.from({ length: MAP_HEIGHT_CELLS }, () => 
            Array(MAP_WIDTH_CELLS).fill(CellType.EMPTY)
        );
    }

    private generate(): void {
        // 1. Noise Pass & Thresholding
        for (let y = 0; y < MAP_HEIGHT_CELLS; y++) {
            const row = this.worldData[y];
            if (!row) continue; // Should not happen with proper initialization
            for (let x = 0; x < MAP_WIDTH_CELLS; x++) {
                const noiseValue = this.noise.GetNoise(x, y);
                row[x] = getCellTypeFromNoiseValue(noiseValue);
            }
        }

        // 2. Cellular Automata (1-step as per world.mdc)
        this.applyCellularAutomata();

        // 3. Connectivity Test (and potential regeneration)
        // To be implemented - placeholder for now
        // this.ensureConnectivity();
    }

    private applyCellularAutomata(): void {
        const newWorldData = Array.from({ length: MAP_HEIGHT_CELLS }, () => 
            Array(MAP_WIDTH_CELLS).fill(CellType.EMPTY)
        );
        
        for (let y = 0; y < MAP_HEIGHT_CELLS; y++) {
            const currentRow = this.worldData[y];
            const newRow = newWorldData[y];
            if (!currentRow || !newRow) continue; // Should not happen

            for (let x = 0; x < MAP_WIDTH_CELLS; x++) {
                const solidNeighbors = this.countSolidNeighbors(x, y);
                const currentCell = currentRow[x];

                if (currentCell === CellType.SOLID) {
                    newRow[x] = (solidNeighbors >= 4) ? CellType.SOLID : CellType.EMPTY;
                } else { // If empty or rough, check if it becomes solid
                    newRow[x] = (solidNeighbors >= 5) ? CellType.SOLID : currentCell;
                }
            }
        }
        this.worldData = newWorldData;
    }

    private countSolidNeighbors(x: number, y: number): number {
        let count = 0;
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (i === 0 && j === 0) continue; // Skip the cell itself

                const nx = x + i;
                const ny = y + j;

                if (nx >= 0 && nx < MAP_WIDTH_CELLS && ny >= 0 && ny < MAP_HEIGHT_CELLS) {
                    const neighborRow = this.worldData[ny];
                    if (neighborRow && neighborRow[nx] === CellType.SOLID) {
                        count++;
                    }
                } else {
                    // Consider out-of-bounds as solid to create a 'border'
                    count++;
                }
            }
        }
        return count;
    }
    
    // Implement connectivity check in the future
    // private ensureConnectivity(): void {
    //     // Placeholder for flood-fill logic
    //     // If center is not reachable, increment seed and regenerate (world.mdc)
    // }

} 