const CDN_ROOT = "https://cdn.alibaba.ir";

export function alibabaCdnUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const path = value.trim();
  if (/^https:\/\/cdn\.alibaba\.ir\/[\w\-./%]+$/i.test(path)) return path;
  if (/^\/[\w\-./%]+$/i.test(path)) return `${CDN_ROOT}${path}`;
  return null;
}

export function alibabaTrainLogo(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const suffix = String(value).trim();
  return /^[-\w]+$/.test(suffix) ? `${CDN_ROOT}/static/img/train/train_${suffix}.png` : null;
}
