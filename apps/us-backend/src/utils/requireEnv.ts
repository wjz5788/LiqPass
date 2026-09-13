/**
 * 强制从环境变量读取敏感配置；缺失时直接抛错（fail-fast），
 * 禁止任何硬编码私钥/密钥兜底值。
 */
export function requireEnv(name: string, ...fallbackNames: string[]): string {
  for (const n of [name, ...fallbackNames]) {
    const v = (process.env[n] || '').trim();
    if (v) return v;
  }
  throw new Error(
    `[config] 缺少必需的环境变量 ${[name, ...fallbackNames].join(' / ')}。` +
    `请在 .env 中配置后再启动服务（严禁使用硬编码默认值）。`
  );
}

/** 延迟求值：只有真正用到时才校验，避免未配置的可选模块阻塞进程启动。 */
export function lazyEnv(name: string, ...fallbackNames: string[]): () => string {
  let cached: string | null = null;
  return () => (cached ??= requireEnv(name, ...fallbackNames));
}

export default requireEnv;
