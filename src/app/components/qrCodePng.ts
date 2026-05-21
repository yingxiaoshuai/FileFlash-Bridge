/* eslint-disable no-bitwise -- PNG chunk CRC and base64 encoding operate on bytes. */
import { PixelRatio } from 'react-native';
import { deflate } from 'pako';

import type { QrMatrix } from './qrCodeMatrix';

type RgbaColor = readonly [number, number, number, number];

type QrPngOptions = {
  backgroundColor: string;
  color: string;
  matrix: QrMatrix;
  quietZone: number;
  size: number;
};

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = createCrcTable();

export function createQrPngDataUri({
  backgroundColor,
  color,
  matrix,
  quietZone,
  size,
}: QrPngOptions) {
  const imageSize = Math.max(1, PixelRatio.getPixelSizeForLayoutSize(size));
  const scale = imageSize / Math.max(1, size);
  const quietZonePx = Math.max(0, Math.round(quietZone * scale));
  const availableSize = Math.max(1, imageSize - quietZonePx * 2);
  const cellSize = Math.max(1, Math.floor(availableSize / matrix.size));
  const matrixSize = matrix.size * cellSize;
  const contentSize = matrixSize + quietZonePx * 2;
  const outerPadding =
    Math.max(0, Math.floor((imageSize - contentSize) / 2)) + quietZonePx;
  const background = parseRgbaColor(backgroundColor, [255, 255, 255, 255]);
  const foreground = parseRgbaColor(color, [0, 0, 0, 255]);
  const raw = createRawQrPixels({
    background,
    cellSize,
    foreground,
    imageSize,
    matrix,
    outerPadding,
  });
  const pngBytes = encodePng(imageSize, imageSize, raw);

  return `data:image/png;base64,${bytesToBase64(pngBytes)}`;
}

function createRawQrPixels({
  background,
  cellSize,
  foreground,
  imageSize,
  matrix,
  outerPadding,
}: {
  background: RgbaColor;
  cellSize: number;
  foreground: RgbaColor;
  imageSize: number;
  matrix: QrMatrix;
  outerPadding: number;
}) {
  const stride = imageSize * 4 + 1;
  const raw = new Uint8Array(stride * imageSize);

  for (let y = 0; y < imageSize; y += 1) {
    let offset = y * stride;
    raw[offset] = 0;
    offset += 1;

    for (let x = 0; x < imageSize; x += 1) {
      raw[offset] = background[0];
      raw[offset + 1] = background[1];
      raw[offset + 2] = background[2];
      raw[offset + 3] = background[3];
      offset += 4;
    }
  }

  for (let row = 0; row < matrix.size; row += 1) {
    for (let column = 0; column < matrix.size; column += 1) {
      if (!matrix.get(row, column)) {
        continue;
      }

      fillRect({
        color: foreground,
        height: cellSize,
        raw,
        startX: outerPadding + column * cellSize,
        startY: outerPadding + row * cellSize,
        stride,
        width: cellSize,
      });
    }
  }

  return raw;
}

function fillRect({
  color,
  height,
  raw,
  startX,
  startY,
  stride,
  width,
}: {
  color: RgbaColor;
  height: number;
  raw: Uint8Array;
  startX: number;
  startY: number;
  stride: number;
  width: number;
}) {
  for (let y = startY; y < startY + height; y += 1) {
    let offset = y * stride + 1 + startX * 4;

    for (let x = 0; x < width; x += 1) {
      raw[offset] = color[0];
      raw[offset + 1] = color[1];
      raw[offset + 2] = color[2];
      raw[offset + 3] = color[3];
      offset += 4;
    }
  }
}

function encodePng(width: number, height: number, rawPixels: Uint8Array) {
  const ihdr = new Uint8Array(13);
  writeUint32(ihdr, 0, width);
  writeUint32(ihdr, 4, height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return concatBytes([
    PNG_SIGNATURE,
    createChunk('IHDR', ihdr),
    createChunk('IDAT', deflate(rawPixels)),
    createChunk('IEND', new Uint8Array(0)),
  ]);
}

function createChunk(type: string, data: Uint8Array) {
  const typeBytes = asciiToBytes(type);
  const chunk = new Uint8Array(12 + data.length);
  writeUint32(chunk, 0, data.length);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);

  const crcInput = new Uint8Array(typeBytes.length + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, typeBytes.length);
  writeUint32(chunk, 8 + data.length, crc32(crcInput));

  return chunk;
}

function parseRgbaColor(color: string, fallback: RgbaColor): RgbaColor {
  const value = color.trim();
  const shortHex = /^#([0-9a-f]{3})$/i.exec(value);
  if (shortHex?.[1]) {
    const [r, g, b] = shortHex[1]
      .split('')
      .map(part => parseInt(`${part}${part}`, 16));
    return [r ?? fallback[0], g ?? fallback[1], b ?? fallback[2], 255];
  }

  const hex = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(value);
  if (hex?.[1]) {
    return [
      parseInt(hex[1].slice(0, 2), 16),
      parseInt(hex[1].slice(2, 4), 16),
      parseInt(hex[1].slice(4, 6), 16),
      hex[2] ? parseInt(hex[2], 16) : 255,
    ];
  }

  const rgba = /^rgba?\((.+)\)$/i.exec(value);
  if (rgba?.[1]) {
    const parts = rgba[1].split(',').map(part => part.trim());
    const alpha = parts[3] === undefined ? 1 : Number(parts[3]);

    return [
      clampByte(Number(parts[0])),
      clampByte(Number(parts[1])),
      clampByte(Number(parts[2])),
      clampByte(alpha <= 1 ? alpha * 255 : alpha),
    ];
  }

  return fallback;
}

function clampByte(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(255, Math.round(value)));
}

function asciiToBytes(value: string) {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index);
  }
  return bytes;
}

function concatBytes(chunks: readonly Uint8Array[]) {
  const totalLength = chunks.reduce(
    (length, chunk) => length + chunk.length,
    0,
  );
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

function writeUint32(target: Uint8Array, offset: number, value: number) {
  target[offset] = (value >>> 24) & 255;
  target[offset + 1] = (value >>> 16) & 255;
  target[offset + 2] = (value >>> 8) & 255;
  target[offset + 3] = value & 255;
}

function createCrcTable() {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    table[index] = value >>> 0;
  }

  return table;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;

  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 255] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function bytesToBase64(bytes: Uint8Array) {
  let result = '';

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const third = index + 2 < bytes.length ? bytes[index + 2] : 0;

    result += BASE64_ALPHABET[first >> 2];
    result += BASE64_ALPHABET[((first & 3) << 4) | (second >> 4)];
    result +=
      index + 1 < bytes.length
        ? BASE64_ALPHABET[((second & 15) << 2) | (third >> 6)]
        : '=';
    result += index + 2 < bytes.length ? BASE64_ALPHABET[third & 63] : '=';
  }

  return result;
}
