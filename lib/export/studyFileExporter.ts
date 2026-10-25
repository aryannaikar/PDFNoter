import JSZip from 'jszip';
import type {
  DocumentRecord,
  NoteRecord,
  AnnotationRecord,
  BookmarkRecord,
  ReadingProgressRecord,
} from '@/types';
import type { StudyFileManifest } from '@/types/studyFile';

export interface StudyFileExportOptions {
  includeOriginalPdf?: boolean;
  includeNotes?: boolean;
  includeAnnotations?: boolean;
  includeBookmarks?: boolean;
  includeReadingProgress?: boolean;
}

/**
 * Packs a PDF document and all its study data into a standalone, portable .pdfnoter file.
 */
export async function exportStudyFile(
  pdfBytes: ArrayBuffer | Uint8Array,
  documentRecord: DocumentRecord,
  notes: NoteRecord[],
  annotations: AnnotationRecord[],
  bookmarks: BookmarkRecord[] = [],
  readingProgress?: ReadingProgressRecord,
  options: StudyFileExportOptions = {},
  onProgress?: (percent: number, message: string) => void
): Promise<Blob> {
  const {
    includeOriginalPdf = true,
    includeNotes = true,
    includeAnnotations = true,
    includeBookmarks = true,
    includeReadingProgress = true,
  } = options;

  onProgress?.(10, 'Initializing .pdfnoter package...');
  const zip = new JSZip();

  const filteredNotes = includeNotes ? notes : [];
  const filteredAnnotations = includeAnnotations ? annotations : [];
  const filteredBookmarks = includeBookmarks ? bookmarks : [];

  const manifest: StudyFileManifest = {
    format: 'pdfnoter',
    version: '1.0',
    formatVersion: 1,
    app: 'PDFNoter',
    exportedAt: new Date().toISOString(),
    exportTimestamp: Date.now(),
    documentFileName: documentRecord.fileName,
    pageCount: documentRecord.pageCount,
    documentFingerprint: documentRecord.fingerprint,
    annotationSchemaVersion: '1.0',
    schemaVersion: 1,
    document: {
      id: documentRecord.id,
      fileName: documentRecord.fileName,
      fileSize: documentRecord.fileSize,
      pageCount: documentRecord.pageCount,
      fingerprint: documentRecord.fingerprint,
    },
    stats: {
      noteCount: filteredNotes.length,
      annotationCount: filteredAnnotations.length,
      bookmarkCount: filteredBookmarks.length,
    },
  };

  const exportNotes = filteredNotes.map((n) => ({
    ...n,
    pageIndex: n.pageNumber - 1,
  }));
  const exportAnnotations = filteredAnnotations.map((a) => ({
    ...a,
    pageIndex: a.pageNumber - 1,
  }));
  const exportBookmarks = filteredBookmarks.map((b) => ({
    ...b,
    pageIndex: b.pageNumber - 1,
  }));

  onProgress?.(30, 'Packaging manifest and study records...');
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('notes.json', JSON.stringify(exportNotes, null, 2));
  zip.file('annotations.json', JSON.stringify(exportAnnotations, null, 2));

  if (includeBookmarks) {
    zip.file('bookmarks.json', JSON.stringify(exportBookmarks, null, 2));
  }

  if (includeReadingProgress && readingProgress) {
    zip.file('readingProgress.json', JSON.stringify(readingProgress, null, 2));
  }

  if (includeOriginalPdf) {
    onProgress?.(50, 'Embedding PDF document binary...');
    const bytes = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
    zip.file('document.pdf', bytes, { binary: true });
  }

  onProgress?.(80, 'Compressing .pdfnoter archive...');
  const blob = await zip.generateAsync(
    {
      type: 'blob',
      mimeType: 'application/x-pdfnoter',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      onProgress?.(80 + Math.round(metadata.percent * 0.18), 'Compressing files...');
    }
  );

  onProgress?.(100, 'Export complete!');
  return blob;
}

/**
 * Triggers a browser download for a Blob
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
