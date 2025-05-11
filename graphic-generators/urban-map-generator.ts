import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

// Constants and configuration
const MAP_WIDTH = 2000;
const MAP_HEIGHT = 2000;
const OUTPUT_DIR = path.join(__dirname, 'output');

// Categories for our sprites
enum SpriteCategory {
  BUILDING = 'building',
  DECOR = 'decor',
  CAR = 'car',
  ROAD = 'road'
}

// Sprite metadata interface
interface SpriteMetadata {
  filePath: string;
  category: SpriteCategory;
  width: number;
  height: number;
}

// Main function to generate the map
async function generateUrbanMap() {
  console.log('Starting urban map generation...');

  try {
    // Create output directory if it doesn't exist
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`Created output directory: ${OUTPUT_DIR}`);

    // Step 1: Load and categorize sprites
    const spriteMetadata = await loadSpriteMetadata();
    console.log(`Loaded ${spriteMetadata.length} sprites`);
    
    // Step 2: Generate urban background pattern
    console.log('Generating urban background pattern...');
    const backgroundBuffer = await generateUrbanBackground();
    
    // Step 3: Place sprites on the map
    console.log('Placing sprites on the map...');
    const finalMapBuffer = await placeSpritesOnMap(backgroundBuffer, spriteMetadata);
    
    // Step 4: Save the final map
    const outputPath = path.join(OUTPUT_DIR, 'urban-map.png');
    await fs.writeFile(outputPath, finalMapBuffer);
    console.log(`Map saved to ${outputPath}`);
    
    console.log('Map generation complete!');
  } catch (error) {
    console.error('Error generating map:', error);
  }
}

// Load sprite metadata from all files in the sprites directory
async function loadSpriteMetadata(): Promise<SpriteMetadata[]> {
  const spritesDir = path.join(__dirname, 'sprites');
  const files = await fs.readdir(spritesDir);
  
  const metadata: SpriteMetadata[] = [];
  
  for (const file of files) {
    // Skip non-image files and hidden files
    if (!file.endsWith('.png') || file.startsWith('.')) {
      continue;
    }
    
    const filePath = path.join(spritesDir, file);
    
    try {
      // Get image dimensions
      const metadata1 = await sharp(filePath).metadata();
      const width = metadata1.width || 0;
      const height = metadata1.height || 0;
      
      // Determine category based on filename
      let category = SpriteCategory.DECOR;
      
      if (file.startsWith('building_')) {
        category = SpriteCategory.BUILDING;
      } else if (file.startsWith('car')) {
        category = SpriteCategory.CAR;
      } else if (file.startsWith('road')) {
        category = SpriteCategory.ROAD;
      }
      
      metadata.push({
        filePath,
        category,
        width,
        height
      });
    } catch (error) {
      console.warn(`Error processing sprite ${file}:`, error);
    }
  }
  
  return metadata;
}

// Generate an urban background pattern
async function generateUrbanBackground(): Promise<Buffer> {
  // Base background colors
  const colors = {
    asphalt: '#333333',
    concrete: '#555555',
    dirt: '#554433',
    graffiti1: '#FF3366',
    graffiti2: '#33CCFF',
    graffiti3: '#FFCC00'
  };
  
  // Create a base concrete/asphalt background
  const background = sharp({
    create: {
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
      channels: 4,
      background: colors.asphalt
    }
  });
  
  // Composite operations for our texture elements
  const composites: sharp.OverlayOptions[] = [];
  
  // Add concrete patches
  for (let i = 0; i < 300; i++) {
    const patchSize = 50 + Math.random() * 150;
    const x = Math.random() * MAP_WIDTH;
    const y = Math.random() * MAP_HEIGHT;
    
    const patch = await sharp({
      create: {
        width: Math.round(patchSize),
        height: Math.round(patchSize),
        channels: 4,
        background: colors.concrete
      }
    })
    .blur(5 + Math.random() * 10)
    .toBuffer();
    
    composites.push({
      input: patch,
      left: Math.round(x),
      top: Math.round(y),
      blend: 'over'
    });
  }
  
  // Add dirt patches
  for (let i = 0; i < 100; i++) {
    const patchSize = 30 + Math.random() * 100;
    const x = Math.random() * MAP_WIDTH;
    const y = Math.random() * MAP_HEIGHT;
    
    const patch = await sharp({
      create: {
        width: Math.round(patchSize),
        height: Math.round(patchSize),
        channels: 4,
        background: colors.dirt
      }
    })
    .blur(3 + Math.random() * 8)
    .toBuffer();
    
    composites.push({
      input: patch,
      left: Math.round(x),
      top: Math.round(y),
      blend: 'over'
    });
  }
  
  // Add some random graffiti elements (basic shapes representing graffiti)
  for (let i = 0; i < 40; i++) {
    const graffiti = await createRandomGraffiti(colors);
    const x = Math.random() * MAP_WIDTH;
    const y = Math.random() * MAP_HEIGHT;
    
    composites.push({
      input: graffiti,
      left: Math.round(x),
      top: Math.round(y),
      blend: 'over'
    });
  }
  
  // Apply all elements to the background
  return background.composite(composites).toBuffer();
}

// Helper function to create random graffiti-like shapes
async function createRandomGraffiti(colors: Record<string, string>): Promise<Buffer> {
  const graffitisColors = [colors.graffiti1, colors.graffiti2, colors.graffiti3];
  const color = graffitisColors[Math.floor(Math.random() * graffitisColors.length)];
  
  // Random size for graffiti
  const width = 20 + Math.random() * 100;
  const height = 20 + Math.random() * 80;
  
  // Create SVG with random shape for graffiti
  const shapeType = Math.floor(Math.random() * 3);
  let svgContent = '';
  
  if (shapeType === 0) {
    // Circle or ellipse
    const rx = width / 2;
    const ry = height / 2;
    svgContent = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="${rx}" cy="${ry}" rx="${rx * 0.8}" ry="${ry * 0.8}" fill="${color}" opacity="0.7" />
      </svg>
    `;
  } else if (shapeType === 1) {
    // Random curvy path
    svgContent = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <path d="M ${width * 0.2},${height * 0.5} 
                 C ${width * 0.4},${height * 0.1} ${width * 0.6},${height * 0.9} ${width * 0.8},${height * 0.5}" 
              stroke="${color}" stroke-width="5" fill="none" opacity="0.7" />
      </svg>
    `;
  } else {
    // Text-like rectangles
    const numRects = 1 + Math.floor(Math.random() * 3);
    svgContent = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    `;
    
    for (let i = 0; i < numRects; i++) {
      const rectWidth = width * (0.3 + Math.random() * 0.6);
      const rectHeight = height * (0.1 + Math.random() * 0.2);
      const x = (width - rectWidth) * Math.random();
      const y = (height - rectHeight) * i / numRects + Math.random() * 10;
      
      svgContent += `
        <rect x="${x}" y="${y}" width="${rectWidth}" height="${rectHeight}" 
              fill="${color}" opacity="0.7" rx="2" ry="2" />
      `;
    }
    
    svgContent += `</svg>`;
  }
  
  // Convert SVG to Buffer
  return sharp(Buffer.from(svgContent)).toBuffer();
}

// Run the generator
generateUrbanMap().catch(console.error); 