import FastNoiseLite from 'fastnoise-lite';
import { CellType } from '../../common/world';

// Dimensions for the world map (in cells)
const MAP_WIDTH_CELLS = 1000;
const MAP_HEIGHT_CELLS = 1000;
const ROAD_MAIN_WIDTH_CELLS = 4; // Width of the asphalt part
const ROAD_SHOULDER_WIDTH_CELLS = 1; // Width of one side of the shoulder
const TOTAL_ROAD_WIDTH_CELLS = ROAD_MAIN_WIDTH_CELLS + 2 * ROAD_SHOULDER_WIDTH_CELLS;

export class WorldGen {
    private noise: FastNoiseLite;
    private detailNoise: FastNoiseLite; // Separate noise for finer details
    private structureNoise: FastNoiseLite; // Noise for larger structures/zones

    private seed: number;
    public worldData: CellType[][];

    constructor(seed: number) {
        this.seed = seed;
        this.noise = new FastNoiseLite(this.seed);
        this.configureBaseNoise();

        this.detailNoise = new FastNoiseLite(this.seed + 1); // Different seed for variety
        this.detailNoise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
        this.detailNoise.SetFrequency(0.1); // Higher frequency for small details
        this.detailNoise.SetFractalType(FastNoiseLite.FractalType.FBm);
        this.detailNoise.SetFractalOctaves(2);

        this.structureNoise = new FastNoiseLite(this.seed + 2);
        this.structureNoise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
        this.structureNoise.SetFrequency(0.01); // Lower frequency for larger zone-like structures
        this.structureNoise.SetFractalType(FastNoiseLite.FractalType.FBm);
        this.structureNoise.SetFractalOctaves(2);

        this.worldData = this.initializeWorldData();
        this.generateDystopianBlock();
    }

    private configureBaseNoise(): void {
        this.noise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
        this.noise.SetFrequency(0.03); // General purpose frequency
        this.noise.SetFractalType(FastNoiseLite.FractalType.FBm);
        this.noise.SetFractalOctaves(3);
        this.noise.SetFractalLacunarity(2.0);
        this.noise.SetFractalGain(0.5);
    }

    private initializeWorldData(): CellType[][] {
        return Array.from({ length: MAP_HEIGHT_CELLS }, () => 
            Array(MAP_WIDTH_CELLS).fill(CellType.EMPTY_GROUND)
        );
    }

    private generateDystopianBlock(): void {
        this.createCentralRoadAndShoulders();
        this.addRoadsideUrbanFeatures();
    }

    private createCentralRoadAndShoulders(): void {
        const roadCoreStartColumn = Math.floor(MAP_WIDTH_CELLS / 2) - Math.floor(ROAD_MAIN_WIDTH_CELLS / 2);
        const roadCoreEndColumn = roadCoreStartColumn + ROAD_MAIN_WIDTH_CELLS - 1;
        
        const leftShoulderStart = roadCoreStartColumn - ROAD_SHOULDER_WIDTH_CELLS;
        const leftShoulderEnd = roadCoreStartColumn - 1;
        const rightShoulderStart = roadCoreEndColumn + 1;
        const rightShoulderEnd = roadCoreEndColumn + ROAD_SHOULDER_WIDTH_CELLS;

        for (let y = 0; y < MAP_HEIGHT_CELLS; y++) {
            const row = this.worldData[y];
            if (!row) continue;

            // Left shoulder
            for (let x = leftShoulderStart; x <= leftShoulderEnd; x++) {
                if (x >= 0 && x < MAP_WIDTH_CELLS) row[x] = CellType.ROUGH; // Rubble/gravel shoulder
            }

            // Main road surface
            for (let x = roadCoreStartColumn; x <= roadCoreEndColumn; x++) {
                if (x < 0 || x >= MAP_WIDTH_CELLS) continue;
                const crackNoise = this.detailNoise.GetNoise(x * 8, y * 8); // Higher freq for cracks
                if (crackNoise > 0.65 && (x === roadCoreStartColumn || x === roadCoreEndColumn || Math.random() < 0.1)) { // Cracks more common at edges or sparsely
                    row[x] = CellType.CRACKED_ASPHALT;
                } else if (crackNoise > 0.5 && Math.random() < 0.2) {
                    row[x] = CellType.CRACKED_ASPHALT; 
                } else {
                    row[x] = CellType.ASPHALT_ROAD;
                }
            }

            // Right shoulder
            for (let x = rightShoulderStart; x <= rightShoulderEnd; x++) {
                if (x >= 0 && x < MAP_WIDTH_CELLS) row[x] = CellType.ROUGH;
            }
        }
    }

    private addRoadsideUrbanFeatures(): void {
        const roadEdgeLeft = Math.floor(MAP_WIDTH_CELLS / 2) - Math.floor(TOTAL_ROAD_WIDTH_CELLS / 2) -1;
        const roadEdgeRight = Math.floor(MAP_WIDTH_CELLS / 2) + Math.floor(TOTAL_ROAD_WIDTH_CELLS / 2);
        const featureZoneWidth = Math.max(10, Math.floor(MAP_WIDTH_CELLS * 0.2)); // Define how far features can spread from road

        for (let y = 0; y < MAP_HEIGHT_CELLS; y++) {
            if (!this.worldData[y]) continue;

            for (let side = 0; side < 2; side++) { // 0 for left, 1 for right
                const startX = (side === 0) ? Math.max(0, roadEdgeLeft - featureZoneWidth +1) : roadEdgeRight +1 ;
                const endX = (side === 0) ? roadEdgeLeft : Math.min(MAP_WIDTH_CELLS -1, roadEdgeRight + featureZoneWidth -1);

                for (let x = startX; x <= endX; x++) {
                    if (x < 0 || x >= MAP_WIDTH_CELLS || y < 0 || y >= MAP_HEIGHT_CELLS) continue;
                    const currentCell = this.worldData[y]?.[x];
                    if (currentCell === undefined || currentCell !== CellType.EMPTY_GROUND) continue; // Don't overwrite road/shoulders or existing features

                    const zoneVal = this.structureNoise.GetNoise(x,y); // For larger zoning
                    const detailVal = this.detailNoise.GetNoise(x * 2, y * 2); // For specific feature type
                    const placementVal = this.noise.GetNoise(x*5, y*5); // For placement chance/density

                    // Zone-based feature generation
                    if (zoneVal > 0.4 && placementVal > 0.5) { // Potential building zone
                       if (this.tryPlaceBuildingRuin(x, y, 3, 5, roadEdgeLeft, roadEdgeRight)) {
                           // Skip a few cells to prevent immediate overlap if ruin was placed
                           // This is a simple way, might need refinement
                           x += 2; 
                       }
                    } else if (zoneVal > 0.0 && placementVal > 0.6) { // Potential fence/barrier zone
                        if (Math.abs(x - (side === 0 ? roadEdgeLeft : roadEdgeRight)) < 3 && detailVal > 0.3) { // Near road edge
                           this.tryPlaceFenceSegment(x, y, 5, 10, side);
                           x += 1; // Skip a cell
                        }
                    } else if (placementVal > 0.7) { // Smaller scatter features
                        if (detailVal > 0.5) {
                            this.worldData[y][x] = CellType.TRASH;
                        } else if (detailVal < -0.5) {
                            this.worldData[y][x] = CellType.ROUGH; // Extra rubble patch
                        }
                    }
                }
            }
        }
    }

    private tryPlaceBuildingRuin(startX: number, startY: number, minDim: number, maxDim: number, roadBoundaryLeft: number, roadBoundaryRight: number): boolean {
        const width = Math.floor(this.noise.GetNoise(startX + 100, startY -100) * (maxDim - minDim) / 2 + minDim);
        const height = Math.floor(this.noise.GetNoise(startX - 100, startY + 100) * (maxDim - minDim) / 2 + minDim);
        
        // Check if area is clear and not too close to road
        for (let r = 0; r < height; r++) {
            for (let c = 0; c < width; c++) {
                const curX = startX + c;
                const curY = startY + r;

                // Boundary checks first
                if (curY < 0 || curY >= MAP_HEIGHT_CELLS || curX < 0 || curX >= MAP_WIDTH_CELLS) {
                    return false; // Out of bounds
                }
                
                // Check if row exists and then if cell is valid and empty
                const targetRowCheck = this.worldData[curY];
                if (!targetRowCheck) {
                    return false; // Row itself is undefined (shouldn't happen with proper initialization but good for safety)
                }
                if (targetRowCheck[curX] === undefined || targetRowCheck[curX] !== CellType.EMPTY_GROUND) {
                    return false; // Cell undefined or not empty
                }

                // Proximity to road check (ensure it's not ON or too close to the road/shoulders)
                const roadCoreStart = Math.floor(MAP_WIDTH_CELLS / 2) - Math.floor(ROAD_MAIN_WIDTH_CELLS / 2);
                const roadCoreEnd = roadCoreStart + ROAD_MAIN_WIDTH_CELLS - 1;
                const roadTotalStart = roadCoreStart - ROAD_SHOULDER_WIDTH_CELLS;
                const roadTotalEnd = roadCoreEnd + ROAD_SHOULDER_WIDTH_CELLS;

                if (curX >= roadTotalStart && curX <= roadTotalEnd) {
                    return false; // Too close to, or on the road/shoulder
                }
            }
        }

        // Place ruin (simple rectangular shell for now)
        for (let r = 0; r < height; r++) {
            for (let c = 0; c < width; c++) {
                const curX = startX + c;
                const curY = startY + r;
                 // Ensure curX and curY are within bounds before accessing worldData
                if (curY < 0 || curY >= MAP_HEIGHT_CELLS || curX < 0 || curX >= MAP_WIDTH_CELLS) continue;

                const targetRow = this.worldData[curY];
                if (!targetRow) continue;

                if (r === 0 || r === height - 1 || c === 0 || c === width - 1) { // Walls
                    targetRow[curX] = CellType.BUILDING_RUIN;
                } else if (Math.random() < 0.3) { // Inner rubble/trash
                    targetRow[curX] = Math.random() < 0.5 ? CellType.TRASH : CellType.ROUGH;
                }
            }
        }
        return true;
    }

    private tryPlaceFenceSegment(startX: number, startY: number, minLength: number, maxLength: number, side: number): void {
        const length = Math.floor(this.noise.GetNoise(startX, startY) * (maxLength - minLength) / 2 + minLength);
        const isVertical = this.detailNoise.GetNoise(startX + 50, startY + 50) > 0; // Randomly decide orientation

        for (let i = 0; i < length; i++) {
            const curX = isVertical ? startX : startX + (side === 0 ? -i : i); // Grow away from road or along it
            const curY = isVertical ? startY + i : startY;

            if (curX < 0 || curX >= MAP_WIDTH_CELLS || curY < 0 || curY >= MAP_HEIGHT_CELLS) break;
            
            const targetRowFence = this.worldData[curY];
            if (!targetRowFence) break; 

            if (targetRowFence[curX] === CellType.EMPTY_GROUND) {
                targetRowFence[curX] = CellType.FENCE;
            } else {
                break; // Stop if obstructed
            }
        }
    }
} 