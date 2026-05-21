export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export type QrMatrix = {
  get: (row: number, col: number) => boolean | number;
  size: number;
};

type QrSymbol = {
  modules: QrMatrix;
};

type QrCodeFactory = {
  create: (
    value: string,
    options?: {
      errorCorrectionLevel?: ErrorCorrectionLevel;
    },
  ) => QrSymbol;
};

export type QrLayout = {
  cellSize: number;
  matrixSize: number;
  outerPadding: number;
};

const qrCodeFactory = require('qrcode/lib/core/qrcode') as QrCodeFactory;

export function createQrMatrix(
  value: string,
  errorCorrectionLevel: ErrorCorrectionLevel,
) {
  try {
    return qrCodeFactory.create(value, {
      errorCorrectionLevel,
    }).modules;
  } catch {
    return undefined;
  }
}

export function getQrLayout(
  size: number,
  quietZone: number,
  moduleCount: number,
): QrLayout {
  const safeSize = Math.max(1, size);
  const safeQuietZone = Math.max(0, quietZone);
  const availableSize = Math.max(1, safeSize - safeQuietZone * 2);
  const cellSize = Math.max(1, Math.floor(availableSize / moduleCount));
  const matrixSize = moduleCount * cellSize;
  const contentSize = matrixSize + safeQuietZone * 2;
  const centeringOffset = Math.max(0, Math.floor((safeSize - contentSize) / 2));

  return {
    cellSize,
    matrixSize,
    outerPadding: centeringOffset + safeQuietZone,
  };
}

export function buildQrRows(qrMatrix: QrMatrix) {
  return Array.from({ length: qrMatrix.size }, (_rowValue, rowIndex) =>
    Array.from({ length: qrMatrix.size }, (_columnValue, columnIndex) =>
      Boolean(qrMatrix.get(rowIndex, columnIndex)),
    ),
  );
}
