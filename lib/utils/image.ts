/**
 * Image processing utilities for note attachments.
 * Handles client-side compression, resizing, and safety validation.
 */

/**
 * Validates whether a given string is a safe image source (data URL, https, http, or relative path).
 */
export function isValidImageUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('data:image/')) {
    return true;
  }
  try {
    const parsed = new URL(trimmed, 'http://localhost');
    return (
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      !trimmed.toLowerCase().startsWith('javascript:') &&
      !trimmed.toLowerCase().startsWith('vbscript:')
    );
  } catch {
    return false;
  }
}

/**
 * Sanitizes image URL to protect against XSS injection via javascript: URI.
 */
export function sanitizeImageUrl(url?: string | null): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (trimmed.startsWith('data:image/')) {
    // Basic verification of data:image format
    if (/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
      return trimmed;
    }
    // Allow standard base64 data URLs even if mime type varies slightly
    if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(trimmed)) {
      return trimmed;
    }
  }
  if (isValidImageUrl(trimmed)) {
    return trimmed;
  }
  return undefined;
}

/**
 * Compresses and resizes an uploaded user image on the client side using HTMLCanvasElement.
 * Keeps aspect ratio, reduces memory footprint, and outputs a base64 Data URL.
 */
export async function compressAndProcessImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.85
): Promise<string> {
  // Guard for non-browser environments (e.g. unit tests)
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Load file as data URL first
  const rawDataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });

  // SVG files can be stored directly as vector data URLs
  if (file.type === 'image/svg+xml') {
    return rawDataUrl;
  }

  // Use HTMLImageElement to get dimensions and scale
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Calculate scaling ratio
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback to original data URL if 2d context unavailable
          return resolve(rawDataUrl);
        }

        // Draw and compress
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Preserve PNG transparency if PNG, else JPEG for efficient compression
        const outputMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const compressedDataUrl = canvas.toDataURL(outputMime, quality);
        resolve(compressedDataUrl);
      } catch {
        // Fallback to raw data url if canvas security/taint issue
        resolve(rawDataUrl);
      }
    };
    img.onerror = () => reject(new Error('Invalid or corrupted image file'));
    img.src = rawDataUrl;
  });
}
