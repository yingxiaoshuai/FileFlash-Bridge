/**
 * One-off / maintenance: resize repo-root app.png into Android mipmaps (+ iOS AppIcon).
 * Run: node scripts/generate-app-icons.mjs  (requires: npm i sharp --no-save)
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const input = path.join(root, 'app.png');

const androidDensities = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
};

/** @type {{ filename: string; idiom: string; scale: string; size: string; pixels: number }[]} */
const iosIcons = [
  {filename: 'Icon-App-20x20@2x.png', idiom: 'iphone', scale: '2x', size: '20x20', pixels: 40},
  {filename: 'Icon-App-20x20@3x.png', idiom: 'iphone', scale: '3x', size: '20x20', pixels: 60},
  {filename: 'Icon-App-29x29@2x.png', idiom: 'iphone', scale: '2x', size: '29x29', pixels: 58},
  {filename: 'Icon-App-29x29@3x.png', idiom: 'iphone', scale: '3x', size: '29x29', pixels: 87},
  {filename: 'Icon-App-40x40@2x.png', idiom: 'iphone', scale: '2x', size: '40x40', pixels: 80},
  {filename: 'Icon-App-40x40@3x.png', idiom: 'iphone', scale: '3x', size: '40x40', pixels: 120},
  {filename: 'Icon-App-60x60@2x.png', idiom: 'iphone', scale: '2x', size: '60x60', pixels: 120},
  {filename: 'Icon-App-60x60@3x.png', idiom: 'iphone', scale: '3x', size: '60x60', pixels: 180},
  {filename: 'Icon-App-20x20@1x.png', idiom: 'ipad', scale: '1x', size: '20x20', pixels: 20},
  {filename: 'Icon-App-20x20@2x-ipad.png', idiom: 'ipad', scale: '2x', size: '20x20', pixels: 40},
  {filename: 'Icon-App-29x29@1x.png', idiom: 'ipad', scale: '1x', size: '29x29', pixels: 29},
  {filename: 'Icon-App-29x29@2x-ipad.png', idiom: 'ipad', scale: '2x', size: '29x29', pixels: 58},
  {filename: 'Icon-App-40x40@1x.png', idiom: 'ipad', scale: '1x', size: '40x40', pixels: 40},
  {filename: 'Icon-App-40x40@2x-ipad.png', idiom: 'ipad', scale: '2x', size: '40x40', pixels: 80},
  {filename: 'Icon-App-76x76@2x.png', idiom: 'ipad', scale: '2x', size: '76x76', pixels: 152},
  {filename: 'Icon-App-83.5x83.5@2x.png', idiom: 'ipad', scale: '2x', size: '83.5x83.5', pixels: 167},
  {filename: 'Icon-App-1024x1024.png', idiom: 'ios-marketing', scale: '1x', size: '1024x1024', pixels: 1024},
];

async function main() {
  if (!fs.existsSync(input)) {
    console.error('Missing:', input);
    process.exit(1);
  }

  const resRoot = path.join(root, 'android', 'app', 'src', 'main', 'res');
  for (const [density, size] of Object.entries(androidDensities)) {
    const dir = path.join(resRoot, `mipmap-${density}`);
    const png = await sharp(input).resize(size, size).png().toBuffer();
    for (const name of ['ic_launcher.png', 'ic_launcher_round.png']) {
      fs.writeFileSync(path.join(dir, name), png);
    }
    console.log('Wrote', density, size + 'px');
  }

  const iosSet = path.join(
    root,
    'ios',
    'FileFlashBridge',
    'Images.xcassets',
    'AppIcon.appiconset',
  );
  fs.mkdirSync(iosSet, {recursive: true});
  for (const {filename, pixels} of iosIcons) {
    const png = await sharp(input).resize(pixels, pixels).png().toBuffer();
    fs.writeFileSync(path.join(iosSet, filename), png);
    console.log('Wrote iOS', filename);
  }

  const contents = {
    images: iosIcons.map(({filename, idiom, scale, size}) => ({
      filename,
      idiom,
      scale,
      size,
    })),
    info: {author: 'xcode', version: 1},
  };
  fs.writeFileSync(
    path.join(iosSet, 'Contents.json'),
    JSON.stringify(contents, null, 2) + '\n',
    'utf8',
  );
  console.log('Updated iOS Contents.json');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
