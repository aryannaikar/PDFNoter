export interface DocumentRecord {
  id: string;
  fingerprint: string;
  fileName: string;
  pageCount: number;
  fileSize: number;
  lastOpenedAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface NoteRecord {
  id: string;
  documentId: string;
  pageNumber: number;
  title?: string;
  content: string;
  sourceUrl?: string;
  imageUrl?: string;
  createdAt: number;
  updatedAt: number;
}

export interface NormalizedRect {
  x: number; // 0 to 1 relative to page width
  y: number; // 0 to 1 relative to page height
  width: number;
  height: number;
}

export interface TextAnchor {
  pageNumber: number;
  selectedText: string;
  prefixText: string;
  suffixText: string;
  startOffset?: number;
  endOffset?: number;
}

export interface AnnotationRecord {
  id: string;
  documentId: string;
  pageNumber: number;
  selectedText: string;
  prefixText: string;
  suffixText: string;
  anchor: TextAnchor;
  normalizedRects: NormalizedRect[];
  noteTitle?: string;
  noteContent: string;
  sourceUrl?: string;
  imageUrl?: string;
  color?: string;
  createdAt: number;
  updatedAt: number;
}

export interface BookmarkRecord {
  id: string;
  documentId: string;
  pageNumber: number;
  label: string;
  createdAt: number;
}

export interface ReadingProgressRecord {
  documentId: string;
  lastPage: number;
  zoom: number;
  scrollPosition: { x: number; y: number };
  updatedAt: number;
}

export interface BackupData {
  app: string;
  schemaVersion: number;
  exportedAt: string;
  documents: DocumentRecord[];
  notes: NoteRecord[];
  annotations: AnnotationRecord[];
  bookmarks: BookmarkRecord[];
  readingProgress: ReadingProgressRecord[];
}

export interface SearchMatch {
  pageNumber: number;
  matchIndex: number;
  snippet: string;
  startIndex: number;
  endIndex: number;
}
