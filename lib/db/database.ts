import Dexie, { type Table } from 'dexie';
import type {
  DocumentRecord,
  NoteRecord,
  AnnotationRecord,
  BookmarkRecord,
  ReadingProgressRecord,
} from '@/types';

export class StudyReaderDB extends Dexie {
  documents!: Table<DocumentRecord, string>;
  notes!: Table<NoteRecord, string>;
  annotations!: Table<AnnotationRecord, string>;
  bookmarks!: Table<BookmarkRecord, string>;
  readingProgress!: Table<ReadingProgressRecord, string>;

  constructor(name: string = 'OfflinePDFStudyReaderDB') {
    super(name);

    // Schema definition with versioning
    this.version(1).stores({
      documents: 'id, &fingerprint, fileName, lastOpenedAt, updatedAt',
      notes: 'id, documentId, pageNumber, [documentId+pageNumber], createdAt, updatedAt',
      annotations: 'id, documentId, pageNumber, [documentId+pageNumber], createdAt, updatedAt',
      bookmarks: 'id, documentId, pageNumber, [documentId+pageNumber], createdAt',
      readingProgress: 'documentId, updatedAt',
    });
  }
}

// Singleton database instance
export const db = new StudyReaderDB();

/**
 * Request persistent browser storage if available.
 * Returns true if granted, false otherwise.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof window !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persisted();
      if (isPersisted) return true;
      return await navigator.storage.persist();
    } catch (err) {
      console.warn('Failed to request persistent storage:', err);
      return false;
    }
  }
  return false;
}

/**
 * Get storage quota estimate
 */
export async function getStorageEstimate(): Promise<{ usage: number; quota: number; percent: number } | null> {
  if (typeof window !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 1;
      return {
        usage,
        quota,
        percent: Math.min(100, Math.round((usage / quota) * 100)),
      };
    } catch {
      return null;
    }
  }
  return null;
}
