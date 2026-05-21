import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { buildQrRows, createQrMatrix, getQrLayout } from './qrCodeMatrix';
import { createQrPngDataUri } from './qrCodePng';
import type { ErrorCorrectionLevel } from './qrCodeMatrix';

type PlatformQrCodeProps = {
  backgroundColor?: string;
  color?: string;
  ecl?: ErrorCorrectionLevel;
  quietZone?: number;
  size: number;
  testID?: string;
  value: string;
};

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
    return createQrMatrix(value, ecl);
  }, [ecl, value]);
  const pngDataUri = React.useMemo(() => {
    if (!qrMatrix) {
      return undefined;
    }

    return createQrPngDataUri({
      backgroundColor,
      color,
      matrix: qrMatrix,
      quietZone,
      size,
    });
  }, [backgroundColor, color, qrMatrix, quietZone, size]);
  const [useViewFallback, setUseViewFallback] = React.useState(false);

  React.useEffect(() => {
    setUseViewFallback(false);
  }, [pngDataUri]);

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

  if (pngDataUri && !useViewFallback) {
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
      >
        <Image
          onError={() => {
            setUseViewFallback(true);
          }}
          resizeMode="stretch"
          source={{ uri: pngDataUri }}
          style={{
            height: size,
            width: size,
          }}
        />
      </View>
    );
  }

  const { cellSize, matrixSize, outerPadding } = getQrLayout(
    size,
    quietZone,
    qrMatrix.size,
  );
  const rows = buildQrRows(qrMatrix);

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
