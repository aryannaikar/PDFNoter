import type {
  NoteRecord,
  AnnotationRecord,
  BookmarkRecord,
  ReadingProgressRecord,
  DocumentRecord,
} from './index';

export interface StudyFileManifest {
  format: 'pdfnoter';
  version: string;
  formatVersion: number;
  app: 'PDFNoter';
  exportedAt: string;
  exportTimestamp: number;
  documentFileName: string;
  pageCount: number;
  documentFingerprint: string;
  annotationSchemaVersion: string;
  schemaVersion: number;
  document: {
    id: string;
    fileName: string;
    fileSize: number;
    pageCount: number;
    fingerprint: string;
  };
  stats: {
    noteCount: number;
    annotationCount: number;
    bookmarkCount: number;
  };
}

export interface StudyFilePayload {
  manifest: StudyFileManifest;
  notes: NoteRecord[];
  annotations: AnnotationRecord[];
  bookmarks: BookmarkRecord[];
  readingProgress?: ReadingProgressRecord;
}

export interface StudyFileValidationResult {
  valid: boolean;
  error?: string;
  manifest?: StudyFileManifest;
  payload?: StudyFilePayload;
  pdfBytes?: Uint8Array;
  notes?: NoteRecord[];
  annotations?: AnnotationRecord[];
  bookmarks?: BookmarkRecord[];
  readingProgress?: ReadingProgressRecord;
}

export interface StudyFileImportResult {
  documentRecord: DocumentRecord;
  file: File;
  importedNotes: number;
  importedAnnotations: number;
  importedBookmarks: number;
  isExisting: boolean;
}
