import type {
  DocumentRecord,
  NoteRecord,
  AnnotationRecord,
  BookmarkRecord,
  ReadingProgressRecord,
  BackupData,
} from '@/types';

export interface IStorageService {
  // Documents
  getDocumentById(id: string): Promise<DocumentRecord | undefined>;
  getDocumentByFingerprint(fingerprint: string): Promise<DocumentRecord | undefined>;
  getAllDocuments(): Promise<DocumentRecord[]>;
  saveDocumentMetadata(doc: Omit<DocumentRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<DocumentRecord>;
  updateDocumentLastOpened(id: string): Promise<void>;
  deleteDocument(id: string): Promise<void>;

  // Notes
  getNotesForPage(documentId: string, pageNumber: number): Promise<NoteRecord[]>;
  getNotesForDocument(documentId: string): Promise<NoteRecord[]>;
  createNote(note: Omit<NoteRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<NoteRecord>;
  updateNote(id: string, updates: Partial<Pick<NoteRecord, 'title' | 'content' | 'sourceUrl' | 'imageUrl'>>): Promise<NoteRecord>;
  deleteNote(id: string): Promise<void>;

  // Annotations
  getAnnotationsForPage(documentId: string, pageNumber: number): Promise<AnnotationRecord[]>;
  getAnnotationsForDocument(documentId: string): Promise<AnnotationRecord[]>;
  createAnnotation(ann: Omit<AnnotationRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<AnnotationRecord>;
  updateAnnotation(id: string, updates: Partial<Pick<AnnotationRecord, 'noteTitle' | 'noteContent' | 'sourceUrl' | 'imageUrl'>>): Promise<AnnotationRecord>;
  deleteAnnotation(id: string): Promise<void>;

  // Bookmarks
  getBookmarksForDocument(documentId: string): Promise<BookmarkRecord[]>;
  createBookmark(documentId: string, pageNumber: number, label: string): Promise<BookmarkRecord>;
  deleteBookmark(id: string): Promise<void>;

  // Reading Progress
  getReadingProgress(documentId: string): Promise<ReadingProgressRecord | undefined>;
  saveReadingProgress(progress: Omit<ReadingProgressRecord, 'updatedAt'>): Promise<ReadingProgressRecord>;

  // Backup & Restore
  exportBackup(): Promise<BackupData>;
  importBackup(backup: BackupData, mode: 'merge' | 'replace'): Promise<{ importedDocs: number; importedNotes: number; importedAnnotations: number; importedBookmarks: number }>;
  clearAllData(): Promise<void>;
}
