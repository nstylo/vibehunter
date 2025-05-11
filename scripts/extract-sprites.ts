import sharp from 'sharp';
import { PNG } from 'pngjs';
import fs from 'fs/promises';
import path from 'path';

interface SpriteBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function ensureDirectoryExists(dir: string) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function findSpriteBounds(imageData: Buffer, width: number, height: number): Promise<SpriteBounds[]> {
  const sprites: SpriteBounds[] = [];
  const visited = new Set<string>();
  
  // Helper to check if a pixel is transparent
  const isTransparent = (x: number, y: number) => {
    const idx = (y * width + x) * 4;
    return imageData[idx + 3] === 0;
  };

  // Helper to check if a pixel is within bounds
  const isValidPixel = (x: number, y: number) => {
    return x >= 0 && x < width && y >= 0 && y < height;
  };

  // Flood fill to find connected non-transparent pixels
  const floodFill = (startX: number, startY: number): SpriteBounds | null => {
    if (visited.has(`${startX},${startY}`) || isTransparent(startX, startY)) {
      return null;
    }

    let minX = startX;
    let maxX = startX;
    let minY = startY;
    let maxY = startY;
    const queue: [number, number][] = [[startX, startY]];
    visited.add(`${startX},${startY}`);

    while (queue.length > 0) {
      const [x, y] = queue.shift()!;
      
      // Update bounds
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      // Check adjacent pixels (including diagonals for better sprite detection)
      const directions = [
        [0, 1], [1, 0], [0, -1], [-1, 0],  // Cardinal
        [1, 1], [1, -1], [-1, 1], [-1, -1]  // Diagonal
      ];
      for (const [dx, dy] of directions) {
        const newX = x + dx;
        const newY = y + dy;
        const key = `${newX},${newY}`;

        if (isValidPixel(newX, newY) && !visited.has(key) && !isTransparent(newX, newY)) {
          queue.push([newX, newY]);
          visited.add(key);
        }
      }
    }

    const width = maxX - minX + 1;
    const height = maxY - minY + 1;

    // Only include sprites larger than 16x16
    if (width >= 16 && height >= 16) {
      return { x: minX, y: minY, width, height };
    }

    return null;
  };

  // Scan the image for non-transparent pixels
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const bounds = floodFill(x, y);
      if (bounds) {
        sprites.push(bounds);
      }
    }
  }

  return sprites;
}

async function processSpriteSheet(inputPath: string, outputDir: string) {
  try {
    // Read the image
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    if (!metadata.width || !metadata.height) {
      throw new Error('Invalid image dimensions');
    }

    // Convert to PNG buffer for processing
    const { data, info } = await image
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Find sprite bounds
    const spriteBounds = await findSpriteBounds(data, info.width, info.height);

    // Extract and save each sprite
    for (let i = 0; i < spriteBounds.length; i++) {
      const bounds = spriteBounds[i];
      // Bounds check
      if (
        bounds.x < 0 || bounds.y < 0 ||
        bounds.x + bounds.width > info.width ||
        bounds.y + bounds.height > info.height
      ) {
        console.warn(`Skipping out-of-bounds sprite:`, bounds);
        continue;
      }
      if (i < 5) {
        console.log(`Extracting sprite #${i}:`, bounds);
      }
      const outputPath = path.join(outputDir, `sprite_${path.basename(inputPath, path.extname(inputPath))}_${i}.png`);
      // Re-instantiate sharp for each extraction
      await sharp(inputPath)
        .extract({
          left: bounds.x,
          top: bounds.y,
          width: bounds.width,
          height: bounds.height
        })
        .png()
        .toFile(outputPath);
    }

    console.log(`Processed ${spriteBounds.length} sprites from ${inputPath}`);
    return spriteBounds.length;
  } catch (error) {
    console.error(`Error processing ${inputPath}:`, error);
    return 0;
  }
}

async function main() {
  const inputDir = path.join(process.cwd(), 'client/src/assets/maps/components');
  const outputDir = path.join(process.cwd(), 'client/src/assets/extracted');

  // Ensure output directory exists
  await ensureDirectoryExists(outputDir);

  // Get all image files from input directory
  const files = await fs.readdir(inputDir);
  const imageFiles = files.filter(file => 
    /\.(png|jpg|jpeg|gif)$/i.test(file) && !file.startsWith('.') // Exclude hidden files
  );

  if (imageFiles.length === 0) {
    console.error(`No image files found in ${inputDir}`);
    console.log('Please place your sprite sheets in the maps directory.');
    return;
  }

  console.log(`Found ${imageFiles.length} sprite sheets to process...`);

  let totalSprites = 0;
  for (const file of imageFiles) {
    const inputPath = path.join(inputDir, file);
    totalSprites += await processSpriteSheet(inputPath, outputDir);
  }

  console.log(`\nExtraction complete!`);
  console.log(`Total sprites extracted: ${totalSprites}`);
  console.log(`Output directory: ${outputDir}`);
}

main().catch(console.error); 