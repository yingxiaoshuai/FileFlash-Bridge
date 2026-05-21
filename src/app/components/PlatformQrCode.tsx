import React from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { isHarmonyPlatform } from '../../platform/platform';
import { buildQrRows, createQrMatrix, getQrLayout } from './qrCodeMatrix';
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

  if (!isHarmonyPlatform()) {
    if (!qrMatrix) {
      return (
        <QRCode
          backgroundColor={backgroundColor}
          color={color}
          ecl={ecl}
          quietZone={quietZone}
          size={size}
          testID={testID}
          value={value}
        />
      );
    }

    const { matrixSize, outerPadding } = getQrLayout(
      size,
      quietZone,
      qrMatrix.size,
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
        <QRCode
          backgroundColor={backgroundColor}
          color={color}
          ecl={ecl}
          quietZone={0}
          size={matrixSize}
          value={value}
        />
      </View>
    );
  }

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
