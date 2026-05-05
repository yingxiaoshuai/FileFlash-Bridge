import fs from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';

const root = process.cwd();
const size = 1024;
const radius = 210;

function parseArgs(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args.set(key, true);
      continue;
    }

    args.set(key, next);
    i += 1;
  }
  return args;
}

function parsePositiveInt(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

const paths = {
  appPng: path.join(root, 'app.png'),
  appIcon: path.join(root, 'harmony', 'AppScope', 'resources', 'base', 'media', 'app_icon.png'),
  background: path.join(
    root,
    'harmony',
    'entry',
    'src',
    'main',
    'resources',
    'base',
    'media',
    'background.png',
  ),
  foreground: path.join(
    root,
    'harmony',
    'entry',
    'src',
    'main',
    'resources',
    'base',
    'media',
    'foreground.png',
  ),
  startIcon: path.join(
    root,
    'harmony',
    'entry',
    'src',
    'main',
    'resources',
    'base',
    'media',
    'startIcon.png',
  ),
};

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), {recursive: true});
}

function buildBackgroundSvg() {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="94" y1="72" x2="920" y2="936" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#64E3D3"/>
          <stop offset="0.52" stop-color="#27BDD9"/>
          <stop offset="1" stop-color="#1573E6"/>
        </linearGradient>
        <radialGradient id="glowTop" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(290 212) rotate(42) scale(634 518)">
          <stop offset="0" stop-color="white" stop-opacity="0.54"/>
          <stop offset="1" stop-color="white" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="glowBottom" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(786 892) rotate(180) scale(560 460)">
          <stop offset="0" stop-color="white" stop-opacity="0.3"/>
          <stop offset="1" stop-color="white" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#bg)"/>
      <rect x="36" y="36" width="952" height="952" rx="${radius}" fill="url(#glowTop)"/>
      <rect x="36" y="36" width="952" height="952" rx="${radius}" fill="url(#glowBottom)"/>
      <path d="M126 804C294 684 430 622 602 586C723 560 808 555 910 566V1024H0V880C50 852 84 833 126 804Z" fill="white" fill-opacity="0.18"/>
      <path d="M84 742C236 644 396 585 588 548C710 523 816 520 940 538" stroke="white" stroke-opacity="0.12" stroke-width="22" stroke-linecap="round"/>
    </svg>
  `.trim();
}

function buildForegroundSvg() {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="stroke" x1="254" y1="242" x2="804" y2="780" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#8CE9D8"/>
          <stop offset="0.55" stop-color="#29BCD7"/>
          <stop offset="1" stop-color="#1176E7"/>
        </linearGradient>
        <linearGradient id="paper" x1="350" y1="250" x2="714" y2="820" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#FFFFFF"/>
          <stop offset="1" stop-color="#EEF8FF"/>
        </linearGradient>
      </defs>
      <path d="M280 232H616L756 372V736C756 792 710 838 654 838H338C282 838 236 792 236 736V334C236 278 282 232 338 232H280Z" fill="url(#paper)" stroke="url(#stroke)" stroke-width="34" stroke-linejoin="round"/>
      <path d="M616 232V326C616 382 662 428 718 428H756" fill="url(#paper)" stroke="url(#stroke)" stroke-width="34" stroke-linejoin="round"/>
      <path d="M190 596C340 483 493 427 655 403C738 390 806 389 884 402" stroke="white" stroke-width="38" stroke-linecap="round"/>
      <path d="M164 648C318 540 462 484 632 454C743 434 824 434 914 446" stroke="white" stroke-opacity="0.96" stroke-width="22" stroke-linecap="round"/>
      <path d="M208 676C346 582 468 534 610 510C702 494 778 492 848 500" stroke="#CFFAFF" stroke-opacity="0.55" stroke-width="12" stroke-linecap="round"/>
    </svg>
  `.trim();
}

async function buildSquareMasterFromInput(inputPath) {
  const input = sharp(inputPath, { failOn: 'none' });
  const meta = await input.metadata();
  if (!meta.width || !meta.height) {
    throw new Error(`Unable to read image dimensions from ${inputPath}`);
  }

  const scale = Math.min(size / meta.width, size / meta.height);
  const resizedWidth = Math.max(1, Math.round(meta.width * scale));
  const resizedHeight = Math.max(1, Math.round(meta.height * scale));
  const left = Math.floor((size - resizedWidth) / 2);
  const top = Math.floor((size - resizedHeight) / 2);

  const canvas = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });

  const resizedBuffer = await sharp(inputPath, { failOn: 'none' })
    .resize(resizedWidth, resizedHeight, { fit: 'fill' })
    .png()
    .toBuffer();

  return canvas
    .composite([{ input: resizedBuffer, left, top }])
    .png({
      compressionLevel: 9,
      quality: 100,
    })
    .toBuffer();
}

async function writePng(filePath, input) {
  ensureDirectory(filePath);
  await sharp(Buffer.from(input))
    .png({
      compressionLevel: 9,
      quality: 100,
    })
    .toFile(filePath);
}

async function writeWebp(filePath, input, webpSize = 216) {
  ensureDirectory(filePath);

  let quality = 90;
  let lastBuffer = null;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const buffer = await sharp(Buffer.from(input))
      .resize(webpSize, webpSize, { fit: 'cover' })
      .webp({ quality, effort: 6 })
      .toBuffer();
    lastBuffer = buffer;
    if (buffer.length <= 100 * 1024) {
      break;
    }
    quality = Math.max(40, quality - 6);
  }

  await sharp(lastBuffer).toFile(filePath);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(root, String(args.get('input') ?? path.join(root, 'app.png')));
  const outDir = path.resolve(
    root,
    String(args.get('out-dir') ?? path.join(root, 'dist', 'harmony-icon')),
  );
  const requestedSize = parsePositiveInt(args.get('size')) ?? size;
  const includeLayered = args.get('layered') !== 'false';

  const backgroundSvg = buildBackgroundSvg();
  const foregroundSvg = buildForegroundSvg();
  const backgroundBuffer = await sharp(Buffer.from(backgroundSvg)).png().toBuffer();
  const foregroundBuffer = await sharp(Buffer.from(foregroundSvg)).png().toBuffer();

  // Preferred: use existing app.png as the single source of truth.
  // If it fails to decode, fall back to the generated gradient icon.
  let masterIconBuffer;
  try {
    masterIconBuffer = await buildSquareMasterFromInput(inputPath);
  } catch (error) {
    console.warn(
      `[icons:harmony] Failed to load input icon (${path.relative(root, inputPath)}). Falling back to generated icon.`,
    );
    console.warn(error);
    masterIconBuffer = await sharp(backgroundBuffer)
      .composite([{ input: foregroundBuffer }])
      .png({ compressionLevel: 9, quality: 100 })
      .toBuffer();
  }

  const fullIconBuffer = await sharp(masterIconBuffer)
    .resize(requestedSize, requestedSize, { fit: 'cover' })
    .png({ compressionLevel: 9, quality: 100 })
    .toBuffer();

  // Keep repo root + Harmony resources consistent.
  await writePng(paths.appPng, await sharp(masterIconBuffer).resize(1024, 1024).png().toBuffer());
  await writePng(paths.appIcon, fullIconBuffer);
  await writePng(paths.startIcon, fullIconBuffer);

  if (includeLayered) {
    await writePng(paths.background, backgroundSvg);
    await writePng(paths.foreground, foregroundSvg);
  }

  // Also export platform-required deliverables (1024 + 216 + 216 webp).
  const export1024 = path.join(outDir, 'icon-1024.png');
  const export216 = path.join(outDir, 'icon-216.png');
  const export216webp = path.join(outDir, 'icon-216.webp');
  await writePng(export1024, await sharp(masterIconBuffer).resize(1024, 1024).png().toBuffer());
  await writePng(export216, await sharp(masterIconBuffer).resize(216, 216).png().toBuffer());
  await writeWebp(export216webp, masterIconBuffer, 216);

  const wrote = [
    paths.appPng,
    paths.appIcon,
    paths.background,
    paths.foreground,
    paths.startIcon,
    export1024,
    export216,
    export216webp,
  ];
  for (const outputPath of wrote) {
    console.log(`Wrote ${path.relative(root, outputPath)}`);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
