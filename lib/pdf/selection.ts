import type { NormalizedRect, TextAnchor } from '@/types';

/**
 * Extracts normalized rectangles and anchor context (prefix, suffix) from a Range
 * inside a specific page container.
 */
export function extractSelectionAnchor(
  range: Range,
  pageNumber: number,
  pageContainer: HTMLElement,
  textLayerElement?: HTMLElement | null
): { anchor: TextAnchor; normalizedRects: NormalizedRect[] } | null {
  const pageRect = pageContainer.getBoundingClientRect();
  if (pageRect.width === 0 || pageRect.height === 0) return null;

  const selectedText = range.toString().trim();
  if (!selectedText) return null;

  // Extract client rects for multi-line selections
  const clientRects = Array.from(range.getClientRects());
  if (clientRects.length === 0) {
    const singleRect = range.getBoundingClientRect();
    if (singleRect.width > 0 && singleRect.height > 0) {
      clientRects.push(singleRect);
    }
  }

  if (clientRects.length === 0) return null;

  const normalizedRects: NormalizedRect[] = clientRects.map((rect) => {
    const x = Math.max(0, Math.min(1, (rect.left - pageRect.left) / pageRect.width));
    const y = Math.max(0, Math.min(1, (rect.top - pageRect.top) / pageRect.height));
    const width = Math.max(0, Math.min(1 - x, rect.width / pageRect.width));
    const height = Math.max(0, Math.min(1 - y, rect.height / pageRect.height));
    return { x, y, width, height };
  });

  // Extract prefix and suffix from the text layer for anchor verification
  let prefixText = '';
  let suffixText = '';

  const fullText = (textLayerElement?.textContent || pageContainer.textContent || '').replace(/\s+/g, ' ');
  const cleanSelected = selectedText.replace(/\s+/g, ' ');

  if (fullText && cleanSelected) {
    const idx = fullText.indexOf(cleanSelected);
    if (idx !== -1) {
      const prefixStart = Math.max(0, idx - 60);
      prefixText = fullText.substring(prefixStart, idx).trim();

      const suffixEnd = Math.min(fullText.length, idx + cleanSelected.length + 60);
      suffixText = fullText.substring(idx + cleanSelected.length, suffixEnd).trim();
    }
  }

  const anchor: TextAnchor = {
    pageNumber,
    selectedText,
    prefixText,
    suffixText,
  };

  return { anchor, normalizedRects };
}

/**
 * Validates whether an anchor can be reliably attached to the current page text.
 * Returns { valid: boolean; warning?: string }
 */
export function verifyAnchor(anchor: TextAnchor, pageText: string): { valid: boolean; warning?: string } {
  if (!pageText) {
    return { valid: true }; // Cannot verify if text layer is empty (e.g., scanned doc)
  }

  const cleanPageText = pageText.replace(/\s+/g, ' ');
  const cleanSelected = anchor.selectedText.replace(/\s+/g, ' ');

  if (!cleanPageText.includes(cleanSelected)) {
    return {
      valid: false,
      warning: 'Original text not found on this page. The document text may have changed.',
    };
  }

  if (anchor.prefixText || anchor.suffixText) {
    const combined = `${anchor.prefixText} ${cleanSelected} ${anchor.suffixText}`.trim();
    if (!cleanPageText.includes(combined) && !cleanPageText.includes(cleanSelected)) {
      return {
        valid: false,
        warning: 'Context mismatch around the highlighted text.',
      };
    }
  }

  return { valid: true };
}

/**
 * Denormalizes a NormalizedRect to absolute CSS pixels based on current page dimensions.
 */
export function denormalizeRect(
  norm: NormalizedRect,
  pageWidth: number,
  pageHeight: number
): { left: number; top: number; width: number; height: number } {
  return {
    left: norm.x * pageWidth,
    top: norm.y * pageHeight,
    width: norm.width * pageWidth,
    height: norm.height * pageHeight,
  };
}
