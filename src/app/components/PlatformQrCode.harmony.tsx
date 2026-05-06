import React from 'react';
import { StyleSheet, View } from 'react-native';

type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

type QrMatrix = {
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

type PlatformQrCodeProps = {
  backgroundColor?: string;
  color?: string;
  ecl?: ErrorCorrectionLevel;
  quietZone?: number;
  size: number;
  testID?: string;
  value: string;
};

const qrCodeFactory = require('qrcode/lib/core/qrcode') as QrCodeFactory;

export function PlatformQrCode({
  backgroundColor = '#FFFFFF',
  color = '#000000',
  ecl = 'M',
  quietZone = 0,
  size,
  testID,
  value,
}: PlatformQrCodeProps) {
  const qrMatrix = React.useMemo(() => {
    try {
      return qrCodeFactory.create(value, {
        errorCorrectionLevel: ecl,
      }).modules;
    } catch {
      return undefined;
    }
  }, [ecl, value]);

  if (!qrMatrix) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor,
            height: size,
            width: size,
          },
        ]}
        testID={testID}
      />
    );
  }

  const availableSize = Math.max(1, size - quietZone * 2);
  const cellSize = Math.max(1, Math.floor(availableSize / qrMatrix.size));
  const matrixSize = qrMatrix.size * cellSize;
  const contentSize = matrixSize + quietZone * 2;
  const centeringOffset = Math.max(0, Math.floor((size - contentSize) / 2));
  const outerPadding = centeringOffset + quietZone;
  const rows = Array.from({ length: qrMatrix.size }, (_, rowIndex) =>
    Array.from({ length: qrMatrix.size }, (_, columnIndex) =>
      Boolean(qrMatrix.get(rowIndex, columnIndex)),
    ),
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor,
          height: size,
          padding: outerPadding,
          width: size,
        },
      ]}
      testID={testID}
    >
      <View
        style={[
          styles.matrix,
          {
            height: matrixSize,
            width: matrixSize,
          },
        ]}
      >
        {rows.map((row, rowIndex) => (
          <View key={`qr-row-${rowIndex}`} style={styles.row}>
            {row.map((isDark, columnIndex) => (
              <View
                key={`qr-cell-${rowIndex}-${columnIndex}`}
                style={[
                  styles.cell,
                  {
                    backgroundColor: isDark ? color : backgroundColor,
                    height: cellSize,
                    width: cellSize,
                  },
                ]}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    flexShrink: 0,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  matrix: {
    flexShrink: 0,
  },
  row: {
    flexDirection: 'row',
    flexShrink: 0,
  },
});
