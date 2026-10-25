import { describe, it, expect, beforeEach } from 'vitest';
import { StudyReaderDB } from '@/lib/db/database';
import { DexieStorageService } from '@/services/storage/dexieStorageService';
import { computePdfFingerprint } from '@/lib/pdf/fingerprint';
import { isValidUrl, sanitizeUrl } from '@/lib/utils/url';
import { denormalizeRect, verifyAnchor } from '@/lib/pdf/selection';
import type { BackupData } from '@/types';

describe('Storage Service & IndexedDB Unit Tests', () => {
  let testDb: StudyReaderDB;
  let service: DexieStorageService;

  beforeEach(async () => {
    // Unique test database for each test
    const dbName = `TestDB_${Math.random().toString(36).substring(7)}`;
    testDb = new StudyReaderDB(dbName);
    await testDb.open();
    service = new DexieStorageService(testDb);
  });

  it('computes consistent SHA-256 fingerprints for PDF data', async () => {
    const data = new TextEncoder().encode('%PDF-1.4 sample content');
    const hash1 = await computePdfFingerprint(data);
    const hash2 = await computePdfFingerprint(data);

    expect(hash1).toBeDefined();
    expect(hash1.length).toBe(64);
    expect(hash1).toBe(hash2);
  });

  it('saves document metadata and looks up by fingerprint', async () => {
    const fingerprint = 'a1b2c3d4e5f67890123456789012345678901234567890123456789012345678';
    const doc = await service.saveDocumentMetadata({
      fingerprint,
      fileName: 'physics_notes.pdf',
      pageCount: 42,
      fileSize: 102400,
      lastOpenedAt: Date.now(),
    });

    expect(doc.id).toBeDefined();
    expect(doc.fileName).toBe('physics_notes.pdf');

    const found = await service.getDocumentByFingerprint(fingerprint);
    expect(found).toBeDefined();
    expect(found?.id).toBe(doc.id);
    expect(found?.pageCount).toBe(42);
  });

  it('creates, edits, reads, and deletes notes', async () => {
    const doc = await service.saveDocumentMetadata({
      fingerprint: 'test-fingerprint-note',
      fileName: 'chem.pdf',
      pageCount: 10,
      fileSize: 5000,
      lastOpenedAt: Date.now(),
    });

    // Create
    const note = await service.createNote({
      documentId: doc.id,
      pageNumber: 3,
      title: 'Avogadro Constant',
      content: '6.022 x 10^23 entities per mole',
      sourceUrl: 'https://en.wikipedia.org/wiki/Avogadro_constant',
    });

    expect(note.id).toBeDefined();
    expect(note.title).toBe('Avogadro Constant');

    // Read for page
    const pageNotes = await service.getNotesForPage(doc.id, 3);
    expect(pageNotes.length).toBe(1);
    expect(pageNotes[0].content).toContain('6.022');

    // Update
    const updated = await service.updateNote(note.id, {
      title: 'Avogadro Constant (Updated)',
      content: 'Revised definition with exact SI value',
    });
    expect(updated.title).toBe('Avogadro Constant (Updated)');

    // Delete
    await service.deleteNote(note.id);
    const afterDelete = await service.getNotesForPage(doc.id, 3);
    expect(afterDelete.length).toBe(0);
  });

  it('supports multiple notes on the same page', async () => {
    const doc = await service.saveDocumentMetadata({
      fingerprint: 'multi-note-doc',
      fileName: 'math.pdf',
      pageCount: 20,
      fileSize: 8000,
      lastOpenedAt: Date.now(),
    });

    await service.createNote({
      documentId: doc.id,
      pageNumber: 5,
      title: 'Lemma 1',
      content: 'Every positive integer > 1 is prime or product of primes.',
    });

    await service.createNote({
      documentId: doc.id,
      pageNumber: 5,
      title: 'Theorem 2',
      content: 'There are infinitely many prime numbers.',
    });

    const pageNotes = await service.getNotesForPage(doc.id, 5);
    expect(pageNotes.length).toBe(2);
    expect(pageNotes.map((n) => n.title)).toEqual(expect.arrayContaining(['Lemma 1', 'Theorem 2']));
  });

  it('validates page numbers and rejects invalid numbers', async () => {
    const doc = await service.saveDocumentMetadata({
      fingerprint: 'fp-val',
      fileName: 'test.pdf',
      pageCount: 5,
      fileSize: 100,
      lastOpenedAt: Date.now(),
    });

    await expect(
      service.createNote({
        documentId: doc.id,
        pageNumber: 0,
        content: 'Bad page number',
      })
    ).rejects.toThrow('Invalid page number');

    await expect(
      service.createNote({
        documentId: doc.id,
        pageNumber: -1,
        content: 'Negative page number',
      })
    ).rejects.toThrow('Invalid page number');
  });

  it('validates and sanitizes research URLs', () => {
    expect(isValidUrl('https://example.com/research')).toBe(true);
    expect(isValidUrl('http://edu.org/notes')).toBe(true);
    expect(isValidUrl('google.com/search?q=pdf')).toBe(true); // normalizes without scheme

    // Unsafe schemes must be rejected
    expect(isValidUrl('javascript:alert(1)')).toBe(false);
    expect(isValidUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isValidUrl('vbscript:msgbox')).toBe(false);

    expect(sanitizeUrl('https://valid.com')).toBe('https://valid.com/');
    expect(sanitizeUrl('javascript:bad()')).toBe('');
  });

  it('creates and manages text-linked annotations with normalized coordinates', async () => {
    const doc = await service.saveDocumentMetadata({
      fingerprint: 'ann-fp',
      fileName: 'history.pdf',
      pageCount: 15,
      fileSize: 4000,
      lastOpenedAt: Date.now(),
    });

    const normRects = [{ x: 0.1, y: 0.2, width: 0.8, height: 0.05 }];
    const ann = await service.createAnnotation({
      documentId: doc.id,
      pageNumber: 2,
      selectedText: 'Industrial Revolution',
      prefixText: 'The onset of the ',
      suffixText: ' changed manufacturing.',
      anchor: {
        pageNumber: 2,
        selectedText: 'Industrial Revolution',
        prefixText: 'The onset of the ',
        suffixText: ' changed manufacturing.',
      },
      normalizedRects: normRects,
      noteTitle: 'History Exam Note',
      noteContent: 'Key transition period beginning in Britain in 18th century.',
      sourceUrl: 'https://britannica.com',
    });

    expect(ann.id).toBeDefined();
    expect(ann.selectedText).toBe('Industrial Revolution');

    // Denormalization calculation verification
    const px = denormalizeRect(normRects[0], 1000, 2000);
    expect(px.left).toBe(100);
    expect(px.top).toBe(400);
    expect(px.width).toBe(800);
    expect(px.height).toBe(100);

    // Anchor verification
    const validCheck = verifyAnchor(
      ann.anchor,
      'The onset of the Industrial Revolution changed manufacturing.'
    );
    expect(validCheck.valid).toBe(true);

    const invalidCheck = verifyAnchor(ann.anchor, 'Completely different chapter text.');
    expect(invalidCheck.valid).toBe(false);
    expect(invalidCheck.warning).toBeDefined();
  });

  it('persists and restores reading progress and bookmarks', async () => {
    const doc = await service.saveDocumentMetadata({
      fingerprint: 'prog-fp',
      fileName: 'book.pdf',
      pageCount: 100,
      fileSize: 90000,
      lastOpenedAt: Date.now(),
    });

    // Bookmark
    const bm = await service.createBookmark(doc.id, 14, 'Chapter 2 Start');
    expect(bm.label).toBe('Chapter 2 Start');

    const bookmarks = await service.getBookmarksForDocument(doc.id);
    expect(bookmarks.length).toBe(1);

    // Reading progress
    await service.saveReadingProgress({
      documentId: doc.id,
      lastPage: 14,
      zoom: 1.25,
      scrollPosition: { x: 0, y: 350 },
    });

    const progress = await service.getReadingProgress(doc.id);
    expect(progress).toBeDefined();
    expect(progress?.lastPage).toBe(14);
    expect(progress?.zoom).toBe(1.25);
    expect(progress?.scrollPosition.y).toBe(350);
  });

  it('exports and validates backup data', async () => {
    const doc = await service.saveDocumentMetadata({
      fingerprint: 'backup-doc',
      fileName: 'sample.pdf',
      pageCount: 5,
      fileSize: 2000,
      lastOpenedAt: Date.now(),
    });

    await service.createNote({
      documentId: doc.id,
      pageNumber: 1,
      title: 'Intro note',
      content: 'Important background reading.',
    });

    const backup = await service.exportBackup();
    expect(backup.app).toBe('Offline PDF Study Reader');
    expect(backup.schemaVersion).toBe(1);
    expect(backup.documents.length).toBe(1);
    expect(backup.notes.length).toBe(1);
    expect(backup.exportedAt).toBeDefined();
  });

  it('handles backup restore with merge and deduplication', async () => {
    const mockBackup: BackupData = {
      app: 'Offline PDF Study Reader',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      documents: [
        {
          id: 'doc-import-1',
          fingerprint: 'fp-import-1',
          fileName: 'imported.pdf',
          pageCount: 10,
          fileSize: 3000,
          lastOpenedAt: 1000,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      notes: [
        {
          id: 'note-import-1',
          documentId: 'doc-import-1',
          pageNumber: 2,
          title: 'Imported Note',
          content: 'This note was imported from backup.',
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      annotations: [],
      bookmarks: [],
      readingProgress: [],
    };

    const res = await service.importBackup(mockBackup, 'merge');
    expect(res.importedDocs).toBe(1);
    expect(res.importedNotes).toBe(1);

    const importedDoc = await service.getDocumentById('doc-import-1');
    expect(importedDoc).toBeDefined();
    expect(importedDoc?.fileName).toBe('imported.pdf');

    const importedNotes = await service.getNotesForPage('doc-import-1', 2);
    expect(importedNotes.length).toBe(1);
    expect(importedNotes[0].title).toBe('Imported Note');
  });

  it('rejects malformed backup files', async () => {
    // @ts-expect-error testing invalid argument
    await expect(service.importBackup(null, 'merge')).rejects.toThrow('Invalid backup file');
    // @ts-expect-error testing invalid schema version
    await expect(service.importBackup({ schemaVersion: 99 }, 'merge')).rejects.toThrow('Unsupported schema version');
    // @ts-expect-error testing non-array documents
    await expect(service.importBackup({ schemaVersion: 1, documents: 'not-array' }, 'merge')).rejects.toThrow('Malformed backup data');
  });
});
