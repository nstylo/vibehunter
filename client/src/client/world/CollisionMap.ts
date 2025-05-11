import { CellType } from '../../common/world';
import type { WorldGen } from './WorldGen';

// Assuming MAP_WIDTH_CELLS and MAP_HEIGHT_CELLS are accessible or passed in
// For now, let's use values consistent with WorldGen
const MAP_WIDTH_CELLS = 1000;
const MAP_HEIGHT_CELLS = 1000;

export class CollisionMap {
    private solidCells: Uint8Array; // Using Uint8Array as a bit-field (1 bit per cell)
    private mapWidth: number;
    private mapHeight: number;

    constructor(worldGen: WorldGen) {
        this.mapWidth = MAP_WIDTH_CELLS; // Or get from worldGen if it exposes dimensions
        this.mapHeight = MAP_HEIGHT_CELLS;

        // Each Uint8 can store 8 cell states.
        // Total cells = mapWidth * mapHeight
        // Total Uint8Array elements needed = ceil((mapWidth * mapHeight) / 8)
        const totalCells = this.mapWidth * this.mapHeight;
        this.solidCells = new Uint8Array(Math.ceil(totalCells / 8));
        this.populateFromWorldData(worldGen.worldData);
    }

    private populateFromWorldData(worldData: CellType[][]): void {
        for (let y = 0; y < this.mapHeight; y++) {
            const row = worldData[y];
            if (row) { // Explicitly check if the row itself exists
                for (let x = 0; x < this.mapWidth; x++) {
                    const cell = row[x];
                    // Define which cell types are considered solid for collision
                    if (cell === CellType.SOLID || 
                        cell === CellType.BUILDING_RUIN || 
                        cell === CellType.FENCE) {
                        this.setSolid(x, y, true);
                    }
                    // Other types like ASPHALT_ROAD, CRACKED_ASPHALT, TRASH, EMPTY_GROUND, ROUGH are not solid by default.
                }
            }
        }
    }

    private getCellIndexAndBit(x: number, y: number): { index: number; bit: number } {
        const linearIndex = y * this.mapWidth + x;
        const arrayIndex = Math.floor(linearIndex / 8);
        const bitPosition = linearIndex % 8;
        return { index: arrayIndex, bit: bitPosition };
    }

    public setSolid(x: number, y: number, isSolid: boolean): void {
        if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) {
            return; // Out of bounds
        }
        const { index, bit } = this.getCellIndexAndBit(x, y);
        // Ensure the index is within the bounds of solidCells
        if (index >= 0 && index < this.solidCells.length) {
            const cellValue = this.solidCells[index];
            if (typeof cellValue === 'number') { // Check if it's a number (it should be)
                if (isSolid) {
                    this.solidCells[index] = cellValue | (1 << bit);
                } else {
                    this.solidCells[index] = cellValue & ~(1 << bit);
                }
            }
        }
    }

    public isSolid(x: number, y: number): boolean {
        if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) {
            return true; // Treat out-of-bounds as solid
        }
        const { index, bit } = this.getCellIndexAndBit(x, y);
        // Ensure the index is within the bounds of solidCells
        if (index >= 0 && index < this.solidCells.length) {
            const cellValue = this.solidCells[index];
            if (typeof cellValue === 'number') { // Check if it's a number
                 return (cellValue & (1 << bit)) !== 0;
            }
        }
        return true; // Default to solid if index is somehow out of bounds or cellValue is not a number
    }

    // Helper to get dimensions if needed elsewhere
    public getWidth(): number { return this.mapWidth; }
    public getHeight(): number { return this.mapHeight; }
} 