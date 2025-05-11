import type Phaser from 'phaser';
import { type CellType, CellType as CellTypeValue } from '../../common/world';

export const GENERATED_TILESET_KEY = 'generated_tileset';
export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 64;

/**
 * Generates a single canvas texture containing tiles for each CellType.
 * The order of tiles in the texture is defined by tileTypesInOrder.
 * @param scene The Phaser.Scene to create textures in.
 * @returns The number of tiles generated in the tileset.
 */
export function generateTilesetTexture(scene: Phaser.Scene): number {
    // Define the order of cell types in the texture for consistent indexing
    const tileTypesInOrder: CellType[] = [
        CellTypeValue.EMPTY_GROUND,
        CellTypeValue.ASPHALT_ROAD,
        CellTypeValue.CRACKED_ASPHALT,
        CellTypeValue.BUILDING_RUIN,
        CellTypeValue.FENCE,
        CellTypeValue.TRASH,
        CellTypeValue.SOLID, // Generic solid, for completeness
        CellTypeValue.ROUGH  // Rough terrain/debris
    ];
    const numTiles = tileTypesInOrder.length;

    const canvasWidth = TILE_WIDTH * numTiles;
    const canvasHeight = TILE_HEIGHT;

    // Remove existing texture if it exists, to allow for hot-reloading/regeneration
    if (scene.textures.exists(GENERATED_TILESET_KEY)) {
        scene.textures.remove(GENERATED_TILESET_KEY);
    }

    const canvasTexture = scene.textures.createCanvas(GENERATED_TILESET_KEY, canvasWidth, canvasHeight);
    if (!canvasTexture) {
        console.error('TileTextureGenerator: Failed to create canvas texture for tileset.');
        return 0;
    }
    const ctx = canvasTexture.context;
    if (!ctx) {
        console.error('TileTextureGenerator: Failed to get canvas context.');
        return 0;
    }

    tileTypesInOrder.forEach((cellType, index) => {
        const xOffset = index * TILE_WIDTH;
        const yOffset = 0; // All tiles are in a single row

        ctx.clearRect(xOffset, yOffset, TILE_WIDTH, TILE_HEIGHT);

        switch (cellType) {
            case CellTypeValue.EMPTY_GROUND:
                ctx.fillStyle = '#5A4739'; // Darker, more desaturated dusty brown
                ctx.fillRect(xOffset, yOffset, TILE_WIDTH, TILE_HEIGHT);
                // Add more varied speckles for dirt/gravel
                for (let i = 0; i < 30; i++) {
                    const gravelX = xOffset + Math.random() * TILE_WIDTH;
                    const gravelY = yOffset + Math.random() * TILE_HEIGHT;
                    const gravelSize = Math.random() * 2 + 0.5;
                    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.05)';
                    ctx.beginPath();
                    ctx.arc(gravelX, gravelY, gravelSize, 0, Math.PI * 2);
                    ctx.fill();
                }
                // Faint cracked earth lines
                ctx.strokeStyle = 'rgba(0,0,0,0.08)';
                ctx.lineWidth = 0.5;
                for(let i=0; i < 2; i++) {
                    ctx.beginPath();
                    ctx.moveTo(xOffset + Math.random() * TILE_WIDTH, yOffset + Math.random() * TILE_HEIGHT);
                    ctx.lineTo(xOffset + Math.random() * TILE_WIDTH, yOffset + Math.random() * TILE_HEIGHT);
                    if (Math.random() > 0.5) ctx.lineTo(xOffset + Math.random() * TILE_WIDTH, yOffset + Math.random() * TILE_HEIGHT);
                    ctx.stroke();
                }
                break;
            case CellTypeValue.ASPHALT_ROAD:
                ctx.fillStyle = '#404040'; // Slightly darker asphalt
                ctx.fillRect(xOffset, yOffset, TILE_WIDTH, TILE_HEIGHT);
                // Subtle oil stains / wear
                for (let i = 0; i < 5; i++) {
                    ctx.fillStyle = `rgba(${Math.random() > 0.5 ? '0,0,0' : '20,20,20'}, ${Math.random() * 0.1 + 0.05})`;
                    const stainX = xOffset + Math.random() * TILE_WIDTH * 0.8;
                    const stainY = yOffset + Math.random() * TILE_HEIGHT * 0.8;
                    const stainW = Math.random() * TILE_WIDTH * 0.3 + TILE_WIDTH * 0.1;
                    const stainH = Math.random() * TILE_HEIGHT * 0.3 + TILE_HEIGHT * 0.1;
                    ctx.fillRect(stainX, stainY, stainW, stainH);
                }
                break;
            case CellTypeValue.CRACKED_ASPHALT:
                ctx.fillStyle = '#404040'; // Base asphalt
                ctx.fillRect(xOffset, yOffset, TILE_WIDTH, TILE_HEIGHT);
                ctx.strokeStyle = '#282828'; // Darker, more defined cracks
                ctx.lineWidth = Math.random() * 1 + 1; // Varied crack width
                // Main crack
                ctx.beginPath();
                ctx.moveTo(xOffset + Math.random() * TILE_WIDTH * 0.2, yOffset + Math.random() * TILE_HEIGHT);
                ctx.lineTo(xOffset + TILE_WIDTH * (0.4 + Math.random()*0.2) , yOffset + Math.random() * TILE_HEIGHT);
                ctx.lineTo(xOffset + TILE_WIDTH * (0.8 + Math.random()*0.2), yOffset + Math.random() * TILE_HEIGHT);
                ctx.stroke();
                // Secondary smaller cracks
                ctx.lineWidth = Math.random() * 0.8 + 0.5;
                for (let i = 0; i < 2 + Math.floor(Math.random()*2); i++) {
                    ctx.beginPath();
                    ctx.moveTo(xOffset + Math.random() * TILE_WIDTH, yOffset + Math.random() * TILE_HEIGHT);
                    ctx.lineTo(xOffset + Math.random() * TILE_WIDTH, yOffset + Math.random() * TILE_HEIGHT);
                    ctx.stroke();
                }
                // Small pothole-like dark spots
                for (let i = 0; i < Math.floor(Math.random()*3); i++){
                    ctx.fillStyle = 'rgba(10,10,10,0.5)';
                    const pX = xOffset + Math.random() * (TILE_WIDTH - 10) + 5;
                    const pY = yOffset + Math.random() * (TILE_HEIGHT - 10) + 5;
                    const pR = Math.random() * 3 + 2;
                    ctx.beginPath();
                    ctx.arc(pX,pY,pR,0, Math.PI*2);
                    ctx.fill();
                }
                break;
            case CellTypeValue.BUILDING_RUIN:
                ctx.fillStyle = '#65584A'; // More desaturated, brownish concrete/brick color
                ctx.fillRect(xOffset, yOffset, TILE_WIDTH, TILE_HEIGHT);
                // Bricks/blocks outlines
                ctx.strokeStyle = 'rgba(40, 30, 20, 0.5)';
                ctx.lineWidth = 1;
                for (let r = 0; r < TILE_HEIGHT; r += 8) { // Rows of bricks
                    for (let c = 0; c < TILE_WIDTH; c += (r % 16 === 0 ? 16 : 14)) { // Staggered columns
                        ctx.strokeRect(xOffset + c + Math.random()*2-1, yOffset + r + Math.random()*2-1, 15, 7);
                    }
                }
                // Larger cracks / damage
                ctx.strokeStyle = '#302515';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(xOffset + Math.random() * TILE_WIDTH * 0.3, yOffset + Math.random() * TILE_HEIGHT * 0.3);
                ctx.lineTo(xOffset + TILE_WIDTH * (0.6 + Math.random()*0.2), yOffset + TILE_HEIGHT* (0.6 + Math.random()*0.2));
                ctx.stroke();
                // Rubble/darker spots
                for(let i=0; i<5; i++){
                    ctx.fillStyle = 'rgba(20,15,10,0.3)';
                    ctx.beginPath();
                    ctx.arc(xOffset + Math.random()*TILE_WIDTH, yOffset + Math.random()*TILE_HEIGHT, Math.random()*5+3,0,Math.PI*2);
                    ctx.fill();
                }
                break;
            case CellTypeValue.FENCE: {
                // Ground visible through fence
                ctx.fillStyle = '#5A4739'; // Match EMPTY_GROUND base
                ctx.fillRect(xOffset, yOffset, TILE_WIDTH, TILE_HEIGHT);

                ctx.strokeStyle = '#505050'; // Darker gray for chain link
                ctx.lineWidth = 0.75; // Thinner lines for a denser look
                // Diagonal lines for chain link
                for (let i = -TILE_HEIGHT; i < TILE_WIDTH; i += 6) {
                    ctx.beginPath();
                    ctx.moveTo(xOffset + i, yOffset);
                    ctx.lineTo(xOffset + i + TILE_HEIGHT, yOffset + TILE_HEIGHT);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(xOffset + i + TILE_HEIGHT, yOffset);
                    ctx.lineTo(xOffset + i , yOffset + TILE_HEIGHT);
                    ctx.stroke();
                }
                 // Posts
                ctx.fillStyle = '#303030'; // Darker posts
                ctx.fillRect(xOffset, yOffset, 3, TILE_HEIGHT); // Left post
                ctx.fillRect(xOffset + TILE_WIDTH - 3, yOffset, 3, TILE_HEIGHT); // Right post
                if (TILE_WIDTH > 32) ctx.fillRect(xOffset + TILE_WIDTH/2 -1, yOffset, 2, TILE_HEIGHT); // Center post for wider tiles
                // Top/bottom rail (optional)
                ctx.fillRect(xOffset, yOffset, TILE_WIDTH, 2);
                ctx.fillRect(xOffset, yOffset + TILE_HEIGHT - 2, TILE_WIDTH, 2);
                break;
            }
            case CellTypeValue.TRASH: {
                // Base ground color
                ctx.fillStyle = '#5A4739'; 
                ctx.fillRect(xOffset, yOffset, TILE_WIDTH, TILE_HEIGHT);

                const trashColors = ['#3B2E21', '#555555', '#4F4A41', '#602020', '#206020']; // Duller, grittier colors
                for (let i = 0; i < 25; i++) { // More items for density
                    ctx.fillStyle = `${trashColors[Math.floor(Math.random() * trashColors.length)]}${ (Math.floor(Math.random() *55) + 150).toString(16) }`; // Random alpha
                    const rX = xOffset + Math.random() * (TILE_WIDTH - 6) + 3;
                    const rY = yOffset + Math.random() * (TILE_HEIGHT - 6) + 3;
                    const rW = Math.random() * 8 + 4;
                    const rH = Math.random() * 8 + 4;
                    if (Math.random() > 0.5) {
                        ctx.fillRect(rX, rY, rW, rH);
                    } else {
                        ctx.beginPath();
                        ctx.ellipse(rX + rW/2, rY + rH/2, rW/2, rH/2, Math.random() * Math.PI, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
                break;
            }
            case CellTypeValue.SOLID: // Generic solid - dark, metallic placeholder
                ctx.fillStyle = '#3D3D3D'; 
                ctx.fillRect(xOffset, yOffset, TILE_WIDTH, TILE_HEIGHT);
                // Add some rivets or panel lines
                ctx.strokeStyle = '#222222';
                ctx.lineWidth = 1;
                for(let i=0; i < TILE_WIDTH; i+=16){
                    ctx.strokeRect(xOffset+i+0.5, yOffset+0.5, 15, TILE_HEIGHT-1);
                }
                 for(let i=0; i < TILE_HEIGHT; i+=16){
                    ctx.strokeRect(xOffset+0.5, yOffset+i+0.5, TILE_WIDTH-1, 15);
                }
                ctx.fillStyle = '#555555';
                for(let i=0; i<10; i++){
                     const rivetX = xOffset + Math.random()*(TILE_WIDTH-4)+2;
                     const rivetY = yOffset + Math.random()*(TILE_HEIGHT-4)+2;
                     ctx.beginPath();
                     ctx.arc(rivetX, rivetY, 1.5,0,Math.PI*2);
                     ctx.fill();
                }
                break;
            case CellTypeValue.ROUGH: { // Rubble / coarse gravel
                ctx.fillStyle = '#706050'; // Brownish-gray rubble base
                ctx.fillRect(xOffset, yOffset, TILE_WIDTH, TILE_HEIGHT);
                const rubbleColors = ['#504030', '#8A7A6A', '#606060'];
                for (let i = 0; i < 25; i++) { // Denser rubble
                    ctx.fillStyle = `${rubbleColors[Math.floor(Math.random() * rubbleColors.length)]}B0`; // With some alpha
                    const rubbleX = xOffset + Math.random() * TILE_WIDTH;
                    const rubbleY = yOffset + Math.random() * TILE_HEIGHT;
                    const rubbleSize = Math.random() * 5 + 2; // Larger pieces of rubble
                    const angle = Math.random() * Math.PI * 2;
                    ctx.translate(rubbleX, rubbleY);
                    ctx.rotate(angle);
                    ctx.fillRect(-rubbleSize/2, -rubbleSize/2, rubbleSize, rubbleSize * (Math.random()*0.5 + 0.5)); // Irregular rects
                    ctx.rotate(-angle);
                    ctx.translate(-rubbleX, -rubbleY);
                }
                break;
            }
        }
    });

    canvasTexture.refresh();
    return numTiles;
}

/**
 * Maps a CellType to its corresponding tile index in the generated tileset.
 * Assumes the order defined in tileTypesInOrder array in generateTilesetTexture.
 * @param cellType The cell type.
 * @returns The tile index.
 */
export function getTileIndexForCellType(cellType: CellType): number {
    switch (cellType) {
        case CellTypeValue.EMPTY_GROUND: return 0;
        case CellTypeValue.ASPHALT_ROAD: return 1;
        case CellTypeValue.CRACKED_ASPHALT: return 2;
        case CellTypeValue.BUILDING_RUIN: return 3;
        case CellTypeValue.FENCE: return 4;
        case CellTypeValue.TRASH: return 5;
        case CellTypeValue.SOLID: return 6; // Generic solid
        case CellTypeValue.ROUGH: return 7; // Rough terrain/debris
        default:
            console.warn(`TileTextureGenerator: Unknown cell type ${cellType}, defaulting to EMPTY_GROUND tile.`);
            return 0; // Default to empty ground tile index
    }
} 