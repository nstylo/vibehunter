// Cell types for the world
export enum CellType {
    EMPTY = 0,  // Walkable, no special properties
    ROUGH = 1,  // Walkable, maybe slows movement or has different visuals
    SOLID = 2   // Not walkable, collidable
}

// Noise thresholds for determining cell types
// These values will be compared against noise output (typically -1 to 1 or 0 to 1)
export const NOISE_THRESHOLDS = {
    ROUGH_TERRAIN: 0.0, // Noise values above this (but below SOLID_TERRAIN) become ROUGH
    SOLID_TERRAIN: 0.5  // Noise values above this become SOLID
    // Values below ROUGH_TERRAIN will be EMPTY
};

// Seed helper (placeholder for now, might expand based on server interaction)
export function generateInitialSeed(): number {
    return Math.floor(Math.random() * 2**32); // Simple 32-bit integer seed
}

// Function to get cell type based on noise value
export function getCellTypeFromNoiseValue(noiseValue: number): CellType {
    if (noiseValue >= NOISE_THRESHOLDS.SOLID_TERRAIN) {
        return CellType.SOLID;
    }
    if (noiseValue >= NOISE_THRESHOLDS.ROUGH_TERRAIN) {
        return CellType.ROUGH;
    }
    return CellType.EMPTY;
} 