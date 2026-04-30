import {
  encodeHttpResponse,
  parseHttpRequestFrame,
} from '../src/modules/service/reactNativeTcpHttpRuntime';

function decodeAscii(bytes: Uint8Array) {
  return Array.from(bytes)
    .map(value => String.fromCharCode(value))
    .join('');
}

describe('parseHttpRequestFrame', () => {
  test('returns null until the full request body arrives', () => {
    const partial = new TextEncoder().encode(
      'POST /api/text HTTP/1.1\r\nContent-Type: text/plain\r\nContent-Length: 5\r\n\r\nhe',
    );

    expect(parseHttpRequestFrame(partial)).toBeNull();
  });

  test('parses method, query, headers, and text body', () => {
    const requestBytes = new TextEncoder().encode(
      'POST /api/text?key=abc HTTP/1.1\r\nContent-Type: text/plain; charset=utf-8\r\nX-Client-Id: browser-a\r\nContent-Length: 5\r\n\r\nhello',
    );

    const parsed = parseHttpRequestFrame(requestBytes);

    expect(parsed).not.toBeNull();
    expect(parsed?.consumedBytes).toBe(requestBytes.byteLength);
    expect(parsed?.request.method).toBe('POST');
    expect(parsed?.request.path).toBe('/api/text');
    expect(parsed?.request.query.get('key')).toBe('abc');
    expect(parsed?.request.headers['x-client-id']).toBe('browser-a');
    expect(parsed?.request.body).toBe('hello');
  });
});

describe('encodeHttpResponse', () => {
  test('adds content length and connection headers for json responses', () => {
    const responseBytes = encodeHttpResponse({
      body: {
        ok: true,
      },
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
      status: 200,
    });

    const headerEnd = decodeAscii(responseBytes).indexOf('\r\n\r\n');
    expect(headerEnd).toBeGreaterThan(0);

    const headerText = decodeAscii(responseBytes.slice(0, headerEnd));
    const bodyText = new TextDecoder('utf-8').decode(
      responseBytes.slice(headerEnd + 4),
    );

    expect(headerText).toContain('HTTP/1.1 200 OK');
    expect(headerText).toContain('content-type: application/json; charset=utf-8');
    expect(headerText).toContain('connection: close');
    expect(headerText).toContain(`content-length: ${bodyText.length}`);
    expect(bodyText).toBe(JSON.stringify({ok: true}));
  });

  test('encodes base64-backed binary payloads', () => {
    const responseBytes = encodeHttpResponse({
      body: {
        base64: Buffer.from('chunk-data', 'utf8').toString('base64'),
        byteLength: 10,
        kind: 'base64',
      },
      headers: {
        'content-type': 'application/octet-stream',
      },
      status: 206,
    });

    const headerEnd = decodeAscii(responseBytes).indexOf('\r\n\r\n');
    const bodyBytes = responseBytes.slice(headerEnd + 4);

    expect(decodeAscii(responseBytes.slice(0, headerEnd))).toContain(
      'HTTP/1.1 206 Partial Content',
    );
    expect(Buffer.from(bodyBytes).toString('utf8')).toBe('chunk-data');
  });
});
