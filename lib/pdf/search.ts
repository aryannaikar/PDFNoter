import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { SearchMatch } from '@/types';

export interface SearchResult {
  matches: SearchMatch[];
  totalMatches: number;
  hasText: boolean; // Indicates if PDF contains extractable text
}

/**
 * Searches the entire PDF document for a query string.
 * Extracts context snippets for each match.
 */
export async function searchPdfText(
  pdfDoc: PDFDocumentProxy,
  query: string,
  onProgress?: (pagesSearched: number, totalPages: number) => void
): Promise<SearchResult> {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return { matches: [], totalMatches: 0, hasText: true };
  }

  const matches: SearchMatch[] = [];
  let totalCharactersFound = 0;
  const numPages = pdfDoc.numPages;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str || '')
        .join(' ');

      totalCharactersFound += pageText.trim().length;

      const lowerText = pageText.toLowerCase();
      let startIndex = 0;

      while ((startIndex = lowerText.indexOf(trimmed, startIndex)) !== -1) {
        const endIndex = startIndex + trimmed.length;

        // Extract context snippet (~30 chars before, ~40 chars after)
        const snippetStart = Math.max(0, startIndex - 30);
        const snippetEnd = Math.min(pageText.length, endIndex + 40);
        let snippet = pageText.substring(snippetStart, snippetEnd).trim();

        if (snippetStart > 0) snippet = '...' + snippet;
        if (snippetEnd < pageText.length) snippet = snippet + '...';

        matches.push({
          pageNumber: pageNum,
          matchIndex: matches.length,
          snippet,
          startIndex,
          endIndex,
        });

        startIndex += trimmed.length; // Move past current match
      }
    } catch (err) {
      console.warn(`Failed to extract text for search on page ${pageNum}:`, err);
    }

    if (onProgress) {
      onProgress(pageNum, numPages);
    }
  }

  return {
    matches,
    totalMatches: matches.length,
    hasText: totalCharactersFound > 0,
  };
}
