import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { NoteRecord, AnnotationRecord } from '@/types';
import { sanitizeUrl } from '@/lib/utils/url';

export interface StandardPdfExportOptions {
  includeHighlights?: boolean;
  includePageMarkers?: boolean;
  appendNotesPages?: boolean;
  notesTitle?: string;
  documentTitle?: string;
}

async function embedDataUrlImage(pdfDoc: PDFDocument, dataUrl: string) {
  try {
    const isPng = dataUrl.startsWith('data:image/png');
    const isJpg = dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg');
    if (!isPng && !isJpg) return null;
    const base64Data = dataUrl.split(',')[1];
    if (!base64Data) return null;
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    if (isPng) {
      return await pdfDoc.embedPng(bytes);
    } else {
      return await pdfDoc.embedJpg(bytes);
    }
  } catch {
    return null;
  }
}

/**
 * Embeds annotations and optionally appends study notes pages to a PDF,
 * producing a standard PDF that can be opened in any PDF viewer.
 */
export async function exportAnnotatedStandardPdf(
  originalPdfBytes: ArrayBuffer | Uint8Array,
  notes: NoteRecord[],
  annotations: AnnotationRecord[],
  options: StandardPdfExportOptions = {},
  onProgress?: (progress: number, message: string) => void
): Promise<Uint8Array> {
  const {
    includeHighlights = true,
    includePageMarkers = true,
    appendNotesPages = true,
    notesTitle = 'Study Notes & Annotations Summary',
  } = options;

  onProgress?.(10, 'Loading original document...');
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  const totalPages = pdfDoc.getPageCount();

  // 1. Embed highlights and markers onto matching pages
  if (includeHighlights || includePageMarkers) {
    onProgress?.(30, 'Embedding annotations onto pages...');

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const pageIndex = pageNum - 1;
      const page = pdfDoc.getPage(pageIndex);
      const { width, height } = page.getSize();

      // Text highlights
      if (includeHighlights) {
        const pageAnnotations = annotations.filter((a) => a.pageNumber === pageNum);

        for (const ann of pageAnnotations) {
          const rects = ann.normalizedRects || [];

          for (const norm of rects) {
            // PDF coordinates origin is bottom-left
            const rectX = norm.x * width;
            const rectY = height - (norm.y + norm.height) * height;
            const rectW = norm.width * width;
            const rectH = norm.height * height;

            page.drawRectangle({
              x: Math.max(0, rectX),
              y: Math.max(0, rectY),
              width: Math.min(width - rectX, rectW),
              height: Math.min(height - rectY, rectH),
              color: rgb(0.98, 0.85, 0.25), // Soft amber/yellow
              opacity: 0.45,
            });
          }

          // Draw small indicator pin if has note content
          if (rects[0]) {
            const firstRect = rects[0];
            const pinX = Math.max(4, Math.min(width - 16, firstRect.x * width - 6));
            const pinY = height - firstRect.y * height - 6;

            page.drawCircle({
              x: pinX,
              y: pinY,
              size: 4,
              color: rgb(0.92, 0.55, 0.1),
              opacity: 0.85,
            });
          }
        }
      }

      // Page-level note markers in top-right margin
      if (includePageMarkers) {
        const pageNotes = notes.filter((n) => n.pageNumber === pageNum);
        if (pageNotes.length > 0) {
          const badgeX = width - 24;
          const badgeY = height - 20;

          page.drawRectangle({
            x: badgeX - 8,
            y: badgeY - 6,
            width: 24,
            height: 16,
            color: rgb(0.31, 0.27, 0.9), // Indigo
            opacity: 0.85,
          });
        }
      }
    }
  }

  // 2. Append Study Notes Summary Pages if requested
  if (appendNotesPages && (notes.length > 0 || annotations.length > 0)) {
    onProgress?.(60, 'Generating study notes appendix...');

    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    const margin = 50;
    const pageWidth = 595.28; // Standard A4 width
    const pageHeight = 841.89; // Standard A4 height
    const printableWidth = pageWidth - margin * 2;

    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    // Helper to start a new notes page if content overflows
    const checkPageBreak = (neededHeight: number) => {
      if (y - neededHeight < margin) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
    };

    // Header title
    currentPage.drawText(notesTitle, {
      x: margin,
      y,
      size: 18,
      font: fontBold,
      color: rgb(0.1, 0.12, 0.2),
    });
    y -= 26;

    const exportDate = new Date().toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    currentPage.drawText(`Exported from PDFNoter • ${exportDate} • ${notes.length} page notes, ${annotations.length} highlights`, {
      x: margin,
      y,
      size: 9,
      font: fontRegular,
      color: rgb(0.4, 0.45, 0.5),
    });
    y -= 20;

    // Divider line
    currentPage.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 1,
      color: rgb(0.85, 0.87, 0.9),
    });
    y -= 24;

    // Group items by page
    const maxPage = Math.max(
      ...notes.map((n) => n.pageNumber),
      ...annotations.map((a) => a.pageNumber),
      1
    );

    for (let p = 1; p <= maxPage; p++) {
      const pNotes = notes.filter((n) => n.pageNumber === p);
      const pAnn = annotations.filter((a) => a.pageNumber === p);

      if (pNotes.length === 0 && pAnn.length === 0) continue;

      checkPageBreak(40);

      // Page section heading
      currentPage.drawRectangle({
        x: margin,
        y: y - 2,
        width: printableWidth,
        height: 18,
        color: rgb(0.95, 0.96, 0.98),
      });

      currentPage.drawText(`PAGE ${p}`, {
        x: margin + 6,
        y: y + 3,
        size: 10,
        font: fontBold,
        color: rgb(0.3, 0.35, 0.6),
      });
      y -= 26;

      // Draw page notes
      for (const note of pNotes) {
        checkPageBreak(50);

        currentPage.drawText(`• Page Note: ${note.title || 'Untitled Note'}`, {
          x: margin + 8,
          y,
          size: 10,
          font: fontBold,
          color: rgb(0.15, 0.15, 0.2),
        });
        y -= 14;

        // Wrap multiline content
        const lines = wrapText(note.content, fontRegular, 9, printableWidth - 20);
        for (const line of lines) {
          checkPageBreak(14);
          currentPage.drawText(line, {
            x: margin + 14,
            y,
            size: 9,
            font: fontRegular,
            color: rgb(0.25, 0.28, 0.35),
          });
          y -= 12;
        }

        if (note.sourceUrl) {
          checkPageBreak(14);
          const safeUrl = sanitizeUrl(note.sourceUrl);
          currentPage.drawText(`Source: ${safeUrl}`, {
            x: margin + 14,
            y,
            size: 8,
            font: fontOblique,
            color: rgb(0.3, 0.4, 0.8),
          });
          y -= 12;
        }

        if (note.imageUrl) {
          const img = await embedDataUrlImage(pdfDoc, note.imageUrl);
          if (img) {
            const dims = img.scaleToFit(220, 140);
            checkPageBreak(dims.height + 14);
            currentPage.drawImage(img, {
              x: margin + 14,
              y: y - dims.height,
              width: dims.width,
              height: dims.height,
            });
            y -= (dims.height + 10);
          } else {
            checkPageBreak(14);
            currentPage.drawText(`[Picture attached: ${note.imageUrl.slice(0, 60)}]`, {
              x: margin + 14,
              y,
              size: 8,
              font: fontOblique,
              color: rgb(0.1, 0.6, 0.4),
            });
            y -= 12;
          }
        }

        y -= 8; // Spacing between notes
      }

      // Draw text annotations
      for (const ann of pAnn) {
        checkPageBreak(60);

        const selText = ann.selectedText || '';
        currentPage.drawText(`• Text Highlight: "${selText.slice(0, 70)}${selText.length > 70 ? '...' : ''}"`, {
          x: margin + 8,
          y,
          size: 9.5,
          font: fontBold,
          color: rgb(0.65, 0.45, 0.05),
        });
        y -= 14;

        if (ann.noteTitle) {
          checkPageBreak(14);
          currentPage.drawText(ann.noteTitle, {
            x: margin + 14,
            y,
            size: 9,
            font: fontBold,
            color: rgb(0.2, 0.2, 0.25),
          });
          y -= 12;
        }

        if (ann.noteContent) {
          const lines = wrapText(ann.noteContent, fontRegular, 9, printableWidth - 20);
          for (const line of lines) {
            checkPageBreak(14);
            currentPage.drawText(line, {
              x: margin + 14,
              y,
              size: 9,
              font: fontRegular,
              color: rgb(0.25, 0.28, 0.35),
            });
            y -= 12;
          }
        }

        if (ann.sourceUrl) {
          checkPageBreak(14);
          const safeUrl = sanitizeUrl(ann.sourceUrl);
          currentPage.drawText(`Source: ${safeUrl}`, {
            x: margin + 14,
            y,
            size: 8,
            font: fontOblique,
            color: rgb(0.3, 0.4, 0.8),
          });
          y -= 12;
        }

        if (ann.imageUrl) {
          const img = await embedDataUrlImage(pdfDoc, ann.imageUrl);
          if (img) {
            const dims = img.scaleToFit(220, 140);
            checkPageBreak(dims.height + 14);
            currentPage.drawImage(img, {
              x: margin + 14,
              y: y - dims.height,
              width: dims.width,
              height: dims.height,
            });
            y -= (dims.height + 10);
          } else {
            checkPageBreak(14);
            currentPage.drawText(`[Picture attached: ${ann.imageUrl.slice(0, 60)}]`, {
              x: margin + 14,
              y,
              size: 8,
              font: fontOblique,
              color: rgb(0.1, 0.6, 0.4),
            });
            y -= 12;
          }
        }

        y -= 8;
      }

      y -= 10;
    }
  }

  onProgress?.(90, 'Saving PDF bytes...');
  const resultBytes = await pdfDoc.save();
  onProgress?.(100, 'Complete!');
  return resultBytes;
}

/**
 * Splits text into lines fitting within maxWidth based on character width estimation
 */
function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  const safeText = text || '';
  const paragraphs = safeText.split('\n');
  const resultLines: string[] = [];

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      resultLines.push('');
      continue;
    }

    const words = paragraph.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, fontSize);

      if (width <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) resultLines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) {
      resultLines.push(currentLine);
    }
  }

  return resultLines;
}
