/**
 * Validates and sanitizes research/source URLs.
 * Ensures only safe protocols (http, https) are allowed.
 * Prevents javascript:, data:, vbscript:, etc.
 */
export function isValidUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    // If user entered "google.com" without protocol, test if adding https:// makes it valid
    if (!trimmed.includes('://') && trimmed.includes('.')) {
      try {
        const parsed = new URL(`https://${trimmed}`);
        return parsed.protocol === 'https:';
      } catch {
        return false;
      }
    }
    return false;
  }
}

/**
 * Returns a sanitized absolute URL string with https:// prefix if needed,
 * or empty string if invalid/unsafe.
 */
export function sanitizeUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
    return '';
  } catch {
    // Check if adding https:// helps
    if (!trimmed.includes('://') && trimmed.includes('.')) {
      try {
        const parsed = new URL(`https://${trimmed}`);
        if (parsed.protocol === 'https:') {
          return parsed.href;
        }
      } catch {
        return '';
      }
    }
    return '';
  }
}
