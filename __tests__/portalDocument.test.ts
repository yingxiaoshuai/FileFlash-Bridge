import {buildPortalDocument} from '../src/modules/portal/portalDocument';

describe('buildPortalDocument', () => {
  test('renders the refreshed neutral portal theme instead of the old pale yellow style', () => {
    const html = buildPortalDocument({
      chunkSize: 8 * 1024 * 1024,
      deviceName: 'My iPhone',
      securityMode: 'secure',
    });

    expect(html).toContain('上传到手机');
    expect(html).toContain('发送文本');
    expect(html).toContain('Shared From Phone');
    expect(html).toContain('hero-copy');
    expect(html).toContain('device-pill');
    expect(html).not.toContain('#f5efe3');
    expect(html).not.toContain('rgba(255, 249, 239');
  });
});
