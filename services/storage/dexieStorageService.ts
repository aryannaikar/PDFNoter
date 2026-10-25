import { db, StudyReaderDB } from '@/lib/db/database';
import type { IStorageService } from './IStorageService';
import type {
  DocumentRecord,
  NoteRecord,
  AnnotationRecord,
  BookmarkRecord,
  ReadingProgressRecord,
  BackupData,
} from '@/types';
import { sanitizeUrl } from '@/lib/utils/url';
import { sanitizeImageUrl } from '@/lib/utils/image';

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

export class DexieStorageService implements IStorageService {
  private database: StudyReaderDB;

  constructor(databaseInstance: StudyReaderDB = db) {
    this.database = databaseInstance;
  }

  // --- DOCUMENTS ---

  async getDocumentById(id: string): Promise<DocumentRecord | undefined> {
    try {
      return await this.database.documents.get(id);
    } catch (err) {
      console.error(`Failed to get document ${id}:`, err);
      throw new Error(`Failed to load document: ${(err as Error).message}`);
    }
  }

  async getDocumentByFingerprint(fingerprint: string): Promise<DocumentRecord | undefined> {
    try {
      return await this.database.documents.where('fingerprint').equals(fingerprint).first();
    } catch (err) {
      console.error('Failed to get document by fingerprint:', err);
      throw new Error(`Failed to lookup document: ${(err as Error).message}`);
    }
  }

  async getAllDocuments(): Promise<DocumentRecord[]> {
    try {
      return await this.database.documents.orderBy('lastOpenedAt').reverse().toArray();
    } catch (err) {
      console.error('Failed to get all documents:', err);
      return [];
    }
  }

  async saveDocumentMetadata(
    doc: Omit<DocumentRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<DocumentRecord> {
    try {
      const now = Date.now();
      const existing = doc.id
        ? await this.database.documents.get(doc.id)
        : await this.getDocumentByFingerprint(doc.fingerprint);

      if (existing) {
        const updated: DocumentRecord = {
          ...existing,
          fileName: doc.fileName || existing.fileName,
          pageCount: doc.pageCount > 0 ? doc.pageCount : existing.pageCount,
          fileSize: doc.fileSize > 0 ? doc.fileSize : existing.fileSize,
          lastOpenedAt: now,
          updatedAt: now,
        };
        await this.database.documents.put(updated);
        return updated;
      }

      const newDoc: DocumentRecord = {
        id: doc.id || generateId(),
        fingerprint: doc.fingerprint,
        fileName: doc.fileName,
        pageCount: doc.pageCount,
        fileSize: doc.fileSize,
        lastOpenedAt: now,
        createdAt: now,
        updatedAt: now,
      };

      await this.database.documents.add(newDoc);
      return newDoc;
    } catch (err) {
      console.error('Failed to save document metadata:', err);
      throw new Error(`Failed to save document record: ${(err as Error).message}`);
    }
  }

  async updateDocumentLastOpened(id: string): Promise<void> {
    try {
      await this.database.documents.update(id, {
        lastOpenedAt: Date.now(),
        updatedAt: Date.now(),
      });
    } catch (err) {
      console.warn(`Failed to update last opened for ${id}:`, err);
    }
  }

  async deleteDocument(id: string): Promise<void> {
    try {
      await this.database.transaction(
        'rw',
        [
          this.database.documents,
          this.database.notes,
          this.database.annotations,
          this.database.bookmarks,
          this.database.readingProgress,
        ],
        async () => {
          await this.database.documents.delete(id);
          await this.database.notes.where('documentId').equals(id).delete();
          await this.database.annotations.where('documentId').equals(id).delete();
          await this.database.bookmarks.where('documentId').equals(id).delete();
          await this.database.readingProgress.delete(id);
        }
      );
    } catch (err) {
      console.error(`Failed to delete document ${id}:`, err);
      throw new Error(`Failed to delete document: ${(err as Error).message}`);
    }
  }

  // --- NOTES ---

  async getNotesForPage(documentId: string, pageNumber: number): Promise<NoteRecord[]> {
    try {
      return await this.database.notes
        .where('[documentId+pageNumber]')
        .equals([documentId, pageNumber])
        .toArray();
    } catch (err) {
      console.error(`Failed to get notes for page ${pageNumber}:`, err);
      return [];
    }
  }

  async getNotesForDocument(documentId: string): Promise<NoteRecord[]> {
    try {
      return await this.database.notes.where('documentId').equals(documentId).toArray();
    } catch (err) {
      console.error(`Failed to get notes for doc ${documentId}:`, err);
      return [];
    }
  }

  async createNote(note: Omit<NoteRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<NoteRecord> {
    if (!note.documentId) throw new Error('Note must have a documentId');
    if (!note.pageNumber || note.pageNumber < 1) throw new Error('Invalid page number');
    if (!note.content || !note.content.trim()) throw new Error('Note content cannot be empty');

    const sanitizedUrl = note.sourceUrl ? sanitizeUrl(note.sourceUrl) : undefined;
    const sanitizedImg = note.imageUrl ? sanitizeImageUrl(note.imageUrl) : undefined;
    const now = Date.now();
    const newNote: NoteRecord = {
      id: generateId(),
      documentId: note.documentId,
      pageNumber: note.pageNumber,
      title: note.title?.trim() || undefined,
      content: note.content.trim(),
      sourceUrl: sanitizedUrl,
      imageUrl: sanitizedImg,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.database.notes.add(newNote);
      return newNote;
    } catch (err) {
      console.error('Failed to create note in database:', err);
      throw new Error(`Failed to persist note: ${(err as Error).message}`);
    }
  }

  async updateNote(
    id: string,
    updates: Partial<Pick<NoteRecord, 'title' | 'content' | 'sourceUrl' | 'imageUrl'>>
  ): Promise<NoteRecord> {
    const existing = await this.database.notes.get(id);
    if (!existing) throw new Error(`Note ${id} not found`);

    if (updates.content !== undefined && !updates.content.trim()) {
      throw new Error('Note content cannot be empty');
    }

    const sanitizedUrl = updates.sourceUrl !== undefined
      ? (updates.sourceUrl ? sanitizeUrl(updates.sourceUrl) : undefined)
      : existing.sourceUrl;

    const sanitizedImg = updates.imageUrl !== undefined
      ? (updates.imageUrl ? sanitizeImageUrl(updates.imageUrl) : undefined)
      : existing.imageUrl;

    const updated: NoteRecord = {
      ...existing,
      title: updates.title !== undefined ? (updates.title?.trim() || undefined) : existing.title,
      content: updates.content !== undefined ? updates.content.trim() : existing.content,
      sourceUrl: sanitizedUrl,
      imageUrl: sanitizedImg,
      updatedAt: Date.now(),
    };

    try {
      await this.database.notes.put(updated);
      return updated;
    } catch (err) {
      console.error(`Failed to update note ${id}:`, err);
      throw new Error(`Failed to save note updates: ${(err as Error).message}`);
    }
  }

  async deleteNote(id: string): Promise<void> {
    try {
      await this.database.notes.delete(id);
    } catch (err) {
      console.error(`Failed to delete note ${id}:`, err);
      throw new Error(`Failed to delete note: ${(err as Error).message}`);
    }
  }

  // --- ANNOTATIONS ---

  async getAnnotationsForPage(documentId: string, pageNumber: number): Promise<AnnotationRecord[]> {
    try {
      return await this.database.annotations
        .where('[documentId+pageNumber]')
        .equals([documentId, pageNumber])
        .toArray();
    } catch (err) {
      console.error(`Failed to get annotations for page ${pageNumber}:`, err);
      return [];
    }
  }

  async getAnnotationsForDocument(documentId: string): Promise<AnnotationRecord[]> {
    try {
      return await this.database.annotations.where('documentId').equals(documentId).toArray();
    } catch (err) {
      console.error(`Failed to get annotations for doc ${documentId}:`, err);
      return [];
    }
  }

  async createAnnotation(
    ann: Omit<AnnotationRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<AnnotationRecord> {
    if (!ann.documentId) throw new Error('Annotation must have a documentId');
    if (!ann.pageNumber || ann.pageNumber < 1) throw new Error('Invalid page number');
    if (!ann.selectedText || !ann.selectedText.trim()) throw new Error('Annotation must have selected text');
    if (!ann.noteContent || !ann.noteContent.trim()) throw new Error('Annotation note content cannot be empty');

    const sanitizedUrl = ann.sourceUrl ? sanitizeUrl(ann.sourceUrl) : undefined;
    const sanitizedImg = ann.imageUrl ? sanitizeImageUrl(ann.imageUrl) : undefined;
    const now = Date.now();
    const newAnn: AnnotationRecord = {
      id: generateId(),
      documentId: ann.documentId,
      pageNumber: ann.pageNumber,
      selectedText: ann.selectedText,
      prefixText: ann.prefixText || '',
      suffixText: ann.suffixText || '',
      anchor: ann.anchor,
      normalizedRects: ann.normalizedRects || [],
      noteTitle: ann.noteTitle?.trim() || undefined,
      noteContent: ann.noteContent.trim(),
      sourceUrl: sanitizedUrl,
      imageUrl: sanitizedImg,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.database.annotations.add(newAnn);
      return newAnn;
    } catch (err) {
      console.error('Failed to create annotation:', err);
      throw new Error(`Failed to save annotation: ${(err as Error).message}`);
    }
  }

  async updateAnnotation(
    id: string,
    updates: Partial<Pick<AnnotationRecord, 'noteTitle' | 'noteContent' | 'sourceUrl' | 'imageUrl'>>
  ): Promise<AnnotationRecord> {
    const existing = await this.database.annotations.get(id);
    if (!existing) throw new Error(`Annotation ${id} not found`);

    if (updates.noteContent !== undefined && !updates.noteContent.trim()) {
      throw new Error('Annotation note content cannot be empty');
    }

    const sanitizedUrl = updates.sourceUrl !== undefined
      ? (updates.sourceUrl ? sanitizeUrl(updates.sourceUrl) : undefined)
      : existing.sourceUrl;

    const sanitizedImg = updates.imageUrl !== undefined
      ? (updates.imageUrl ? sanitizeImageUrl(updates.imageUrl) : undefined)
      : existing.imageUrl;

    const updated: AnnotationRecord = {
      ...existing,
      noteTitle: updates.noteTitle !== undefined ? (updates.noteTitle?.trim() || undefined) : existing.noteTitle,
      noteContent: updates.noteContent !== undefined ? updates.noteContent.trim() : existing.noteContent,
      sourceUrl: sanitizedUrl,
      imageUrl: sanitizedImg,
      updatedAt: Date.now(),
    };

    try {
      await this.database.annotations.put(updated);
      return updated;
    } catch (err) {
      console.error(`Failed to update annotation ${id}:`, err);
      throw new Error(`Failed to update annotation: ${(err as Error).message}`);
    }
  }

  async deleteAnnotation(id: string): Promise<void> {
    try {
      await this.database.annotations.delete(id);
    } catch (err) {
      console.error(`Failed to delete annotation ${id}:`, err);
      throw new Error(`Failed to delete annotation: ${(err as Error).message}`);
    }
  }

  // --- BOOKMARKS ---

  async getBookmarksForDocument(documentId: string): Promise<BookmarkRecord[]> {
    try {
      return await this.database.bookmarks
        .where('documentId')
        .equals(documentId)
        .sortBy('pageNumber');
    } catch (err) {
      console.error('Failed to get bookmarks:', err);
      return [];
    }
  }

  async createBookmark(documentId: string, pageNumber: number, label: string): Promise<BookmarkRecord> {
    if (!documentId) throw new Error('Bookmark must have documentId');
    if (!pageNumber || pageNumber < 1) throw new Error('Invalid page number');

    const newBookmark: BookmarkRecord = {
      id: generateId(),
      documentId,
      pageNumber,
      label: label.trim() || `Page ${pageNumber}`,
      createdAt: Date.now(),
    };

    try {
      await this.database.bookmarks.add(newBookmark);
      return newBookmark;
    } catch (err) {
      console.error('Failed to create bookmark:', err);
      throw new Error(`Failed to save bookmark: ${(err as Error).message}`);
    }
  }

  async deleteBookmark(id: string): Promise<void> {
    try {
      await this.database.bookmarks.delete(id);
    } catch (err) {
      console.error(`Failed to delete bookmark ${id}:`, err);
      throw new Error(`Failed to delete bookmark: ${(err as Error).message}`);
    }
  }

  // --- READING PROGRESS ---

  async getReadingProgress(documentId: string): Promise<ReadingProgressRecord | undefined> {
    try {
      return await this.database.readingProgress.get(documentId);
    } catch (err) {
      console.warn('Failed to get reading progress:', err);
      return undefined;
    }
  }

  async saveReadingProgress(
    progress: Omit<ReadingProgressRecord, 'updatedAt'>
  ): Promise<ReadingProgressRecord> {
    const record: ReadingProgressRecord = {
      ...progress,
      updatedAt: Date.now(),
    };

    try {
      await this.database.readingProgress.put(record);
      return record;
    } catch (err) {
      console.warn('Failed to save reading progress:', err);
      return record;
    }
  }

  // --- BACKUP & RESTORE ---

  async exportBackup(): Promise<BackupData> {
    const documents = await this.database.documents.toArray();
    const notes = await this.database.notes.toArray();
    const annotations = await this.database.annotations.toArray();
    const bookmarks = await this.database.bookmarks.toArray();
    const readingProgress = await this.database.readingProgress.toArray();

    return {
      app: 'Offline PDF Study Reader',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      documents,
      notes,
      annotations,
      bookmarks,
      readingProgress,
    };
  }

  async importBackup(
    backup: BackupData,
    mode: 'merge' | 'replace'
  ): Promise<{ importedDocs: number; importedNotes: number; importedAnnotations: number; importedBookmarks: number }> {
    // 1. Validation
    if (!backup || typeof backup !== 'object') {
      throw new Error('Invalid backup file: root must be an object');
    }
    if (backup.schemaVersion !== 1) {
      throw new Error(`Unsupported schema version: ${backup.schemaVersion}`);
    }
    if (!Array.isArray(backup.documents) || !Array.isArray(backup.notes) || !Array.isArray(backup.annotations)) {
      throw new Error('Malformed backup data: documents, notes, and annotations must be arrays');
    }

    // Limits check to prevent DOS
    if (backup.documents.length > 5000 || backup.notes.length > 50000 || backup.annotations.length > 50000) {
      throw new Error('Backup data exceeds maximum allowed record count');
    }

    // Validate and sanitize records
    const sanitizedDocs: DocumentRecord[] = backup.documents
      .filter((d) => d && d.id && d.fingerprint && typeof d.fileName === 'string')
      .map((d) => ({
        id: String(d.id),
        fingerprint: String(d.fingerprint),
        fileName: String(d.fileName).slice(0, 500),
        pageCount: Number(d.pageCount) || 0,
        fileSize: Number(d.fileSize) || 0,
        lastOpenedAt: Number(d.lastOpenedAt) || Date.now(),
        createdAt: Number(d.createdAt) || Date.now(),
        updatedAt: Number(d.updatedAt) || Date.now(),
      }));

    const sanitizedNotes: NoteRecord[] = backup.notes
      .filter((n) => n && n.id && n.documentId && Number(n.pageNumber) > 0 && typeof n.content === 'string')
      .map((n) => ({
        id: String(n.id),
        documentId: String(n.documentId),
        pageNumber: Number(n.pageNumber),
        title: n.title ? String(n.title).slice(0, 300) : undefined,
        content: String(n.content).slice(0, 50000),
        sourceUrl: n.sourceUrl ? sanitizeUrl(String(n.sourceUrl)) : undefined,
        imageUrl: n.imageUrl ? sanitizeImageUrl(String(n.imageUrl)) : undefined,
        createdAt: Number(n.createdAt) || Date.now(),
        updatedAt: Number(n.updatedAt) || Date.now(),
      }));

    const sanitizedAnnotations: AnnotationRecord[] = backup.annotations
      .filter((a) => a && a.id && a.documentId && Number(a.pageNumber) > 0 && typeof a.noteContent === 'string')
      .map((a) => ({
        id: String(a.id),
        documentId: String(a.documentId),
        pageNumber: Number(a.pageNumber),
        selectedText: String(a.selectedText || '').slice(0, 10000),
        prefixText: String(a.prefixText || '').slice(0, 1000),
        suffixText: String(a.suffixText || '').slice(0, 1000),
        anchor: a.anchor || {
          pageNumber: Number(a.pageNumber),
          selectedText: String(a.selectedText || ''),
          prefixText: '',
          suffixText: '',
        },
        normalizedRects: Array.isArray(a.normalizedRects) ? a.normalizedRects : [],
        noteTitle: a.noteTitle ? String(a.noteTitle).slice(0, 300) : undefined,
        noteContent: String(a.noteContent).slice(0, 50000),
        sourceUrl: a.sourceUrl ? sanitizeUrl(String(a.sourceUrl)) : undefined,
        imageUrl: a.imageUrl ? sanitizeImageUrl(String(a.imageUrl)) : undefined,
        createdAt: Number(a.createdAt) || Date.now(),
        updatedAt: Number(a.updatedAt) || Date.now(),
      }));

    const sanitizedBookmarks: BookmarkRecord[] = (backup.bookmarks || [])
      .filter((b) => b && b.id && b.documentId && Number(b.pageNumber) > 0)
      .map((b) => ({
        id: String(b.id),
        documentId: String(b.documentId),
        pageNumber: Number(b.pageNumber),
        label: String(b.label || `Page ${b.pageNumber}`).slice(0, 200),
        createdAt: Number(b.createdAt) || Date.now(),
      }));

    const sanitizedProgress: ReadingProgressRecord[] = (backup.readingProgress || [])
      .filter((p) => p && p.documentId)
      .map((p) => ({
        documentId: String(p.documentId),
        lastPage: Number(p.lastPage) || 1,
        zoom: Number(p.zoom) || 1,
        scrollPosition: p.scrollPosition || { x: 0, y: 0 },
        updatedAt: Number(p.updatedAt) || Date.now(),
      }));

    // 2. Perform atomic transaction
    await this.database.transaction(
      'rw',
      [
        this.database.documents,
        this.database.notes,
        this.database.annotations,
        this.database.bookmarks,
        this.database.readingProgress,
      ],
      async () => {
        if (mode === 'replace') {
          await this.database.documents.clear();
          await this.database.notes.clear();
          await this.database.annotations.clear();
          await this.database.bookmarks.clear();
          await this.database.readingProgress.clear();
        }

        // Put (upsert) records to merge deduplicating by ID
        for (const doc of sanitizedDocs) {
          await this.database.documents.put(doc);
        }
        for (const note of sanitizedNotes) {
          await this.database.notes.put(note);
        }
        for (const ann of sanitizedAnnotations) {
          await this.database.annotations.put(ann);
        }
        for (const bm of sanitizedBookmarks) {
          await this.database.bookmarks.put(bm);
        }
        for (const prog of sanitizedProgress) {
          await this.database.readingProgress.put(prog);
        }
      }
    );

    return {
      importedDocs: sanitizedDocs.length,
      importedNotes: sanitizedNotes.length,
      importedAnnotations: sanitizedAnnotations.length,
      importedBookmarks: sanitizedBookmarks.length,
    };
  }

  async clearAllData(): Promise<void> {
    await this.database.transaction(
      'rw',
      [
        this.database.documents,
        this.database.notes,
        this.database.annotations,
        this.database.bookmarks,
        this.database.readingProgress,
      ],
      async () => {
        await this.database.documents.clear();
        await this.database.notes.clear();
        await this.database.annotations.clear();
        await this.database.bookmarks.clear();
        await this.database.readingProgress.clear();
      }
    );
  }
}

// Default storage instance
export const storageService = new DexieStorageService();
