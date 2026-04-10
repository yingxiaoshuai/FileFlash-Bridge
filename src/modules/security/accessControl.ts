import {SecurityMode} from '../service/models';

export interface AuthorizationResult {
  ok: boolean;
  reason?: string;
}

type ConnectionRegistryEntry = {
  id: string;
  label: string;
  lastSeenAt: number;
};

const DEFAULT_TTL_MS = 30_000;

export function generateAccessKey(byteLength = 12) {
  const bytes = new Uint8Array(byteLength);
  const randomValues =
    globalThis.crypto?.getRandomValues?.bind(globalThis.crypto);

  if (randomValues) {
    randomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join(
    '',
  );
}

export function buildAccessUrl(
  baseUrl: string,
  securityMode: SecurityMode,
  accessKey: string,
) {
  if (securityMode === 'simple') {
    return baseUrl;
  }

  const url = new URL(baseUrl);
  url.searchParams.set('key', accessKey);
  return url.toString();
}

export function authorizeRequest(
  securityMode: SecurityMode,
  expectedKey: string,
  providedKey?: string | null,
): AuthorizationResult {
  if (securityMode === 'simple') {
    return {ok: true};
  }

  if (!providedKey) {
    return {
      ok: false,
      reason: '缺少 key，请重新扫描二维码或复制最新链接。',
    };
  }

  if (providedKey !== expectedKey) {
    return {
      ok: false,
      reason: '当前 key 无效，请回到手机端刷新后重新访问。',
    };
  }

  return {ok: true};
}

export function describeSecurityMode(securityMode: SecurityMode) {
  if (securityMode === 'simple') {
    return '简单模式不包含 key 防护，适合可信 Wi-Fi 或热点中的低风险场景。';
  }

  return '安全模式会把 key 绑定到 URL 和二维码里，旧 key 在刷新后立即失效。';
}

export class ConnectionRegistry {
  private readonly entries = new Map<string, ConnectionRegistryEntry>();

  constructor(
    private readonly maxConnections: number,
    private readonly ttlMs: number = DEFAULT_TTL_MS,
  ) {}

  touch(id: string, label: string, now = Date.now()) {
    this.prune(now);

    const existing = this.entries.get(id);
    if (existing) {
      existing.lastSeenAt = now;
      existing.label = label;
      this.entries.set(id, existing);
      return {accepted: true as const};
    }

    if (this.entries.size >= this.maxConnections) {
      return {
        accepted: false as const,
        reason: '当前活跃连接已达到上限，请稍后重试或停止服务后重新连接。',
      };
    }

    this.entries.set(id, {id, label, lastSeenAt: now});
    return {accepted: true as const};
  }

  clear() {
    this.entries.clear();
  }

  snapshot(now = Date.now()) {
    this.prune(now);

    return Array.from(this.entries.values())
      .sort((left, right) => right.lastSeenAt - left.lastSeenAt)
      .map(entry => ({
        id: entry.id,
        label: entry.label,
        lastSeenAt: new Date(entry.lastSeenAt).toISOString(),
      }));
  }

  private prune(now: number) {
    for (const [entryId, entry] of this.entries.entries()) {
      if (now - entry.lastSeenAt > this.ttlMs) {
        this.entries.delete(entryId);
      }
    }
  }
}
