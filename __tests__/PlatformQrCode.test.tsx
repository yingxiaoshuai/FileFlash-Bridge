import React from 'react';
import renderer, { act } from 'react-test-renderer';

import { PlatformQrCode } from '../src/app/components/PlatformQrCode';
import { createQrMatrix } from '../src/app/components/qrCodeMatrix';

jest.mock('react-native-qrcode-svg', () => 'QRCode');

describe('PlatformQrCode', () => {
  test('renders SVG QR codes at an integer module multiple', () => {
    const value = 'http://192.168.0.2:8668';
    const matrix = createQrMatrix(value, 'M');

    expect(matrix).toBeTruthy();

    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
      tree = renderer.create(
        <PlatformQrCode
          backgroundColor="#FFFFFF"
          color="#000000"
          size={156}
          testID="qr-code"
          value={value}
        />,
      );
    });

    const qrCode = tree!.root.findByProps({ quietZone: 0, value });

    expect(qrCode.props.size).toBeLessThanOrEqual(156);
    expect(qrCode.props.size % matrix!.size).toBe(0);
    expect(qrCode.props.quietZone).toBe(0);
  });
});
