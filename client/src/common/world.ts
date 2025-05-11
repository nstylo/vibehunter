// Cell types for the world
export enum CellType {
    EMPTY_GROUND = 0, // Default walkable ground
    ASPHALT_ROAD = 1, // Smooth road surface
    CRACKED_ASPHALT = 2, // Damaged road surface
    BUILDING_RUIN = 3, // Collidable, part of a building
    FENCE = 4,         // Collidable, thin barrier
    TRASH = 5,         // Walkable, cosmetic detail
    // Keep SOLID for generic obstacles or replace its usage
    SOLID = 6, // General purpose solid, can be used for testing or replaced by specific solids
    // ROUGH can be repurposed or removed if not needed for this theme.
    // For now, let's assume ROUGH might be gravel/debris patches.
    ROUGH = 7,
}

// Noise thresholds for determining cell types
// These will be refined in WorldGen for specific feature placement.
// For now, just distinguishing between ground and potential solid areas.
export const NOISE_THRESHOLDS = {
    ROUGH_TERRAIN: 0.2, // Example: some debris or rough patches
    SOLID_FEATURE: 0.6  // Example: areas dense enough for ruins or other large solids
    // ASPHALT_ROAD, CRACKED_ASPHALT, FENCE, TRASH will be placed procedurally, not just noise-based.
    // EMPTY_GROUND will be the base.
};

// Seed helper (placeholder for now, might expand based on server interaction)
export function generateInitialSeed(): number {
    return Math.floor(Math.random() * 2**32); // Simple 32-bit integer seed
}

// Function to get cell type based on noise value - this will be less important for structured elements
// but can define a base layer.
export function getCellTypeFromNoiseValue(noiseValue: number): CellType {
    if (noiseValue >= NOISE_THRESHOLDS.SOLID_FEATURE) {
        return CellType.BUILDING_RUIN; // Or a generic solid for initial pass
    }
    if (noiseValue >= NOISE_THRESHOLDS.ROUGH_TERRAIN) {
        return CellType.ROUGH; // Could be cracked asphalt or general debris
    }
    return CellType.EMPTY_GROUND;
} 