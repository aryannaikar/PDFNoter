import { describe, it, expect, beforeEach } from 'vitest';
import { PDFDocument, rgb } from 'pdf-lib';
import JSZip from 'jszip';
import { StudyReaderDB } from '@/lib/db/database';
import { DexieStorageService } from '@/services/storage/dexieStorageService';
import { computePdfFingerprint } from '@/lib/pdf/fingerprint';
import { exportAnnotatedStandardPdf } from '@/lib/export/pdfAnnotationExporter';
import { exportStudyFile } from '@/lib/export/studyFileExporter';
import { validateStudyFile, commitStudyFileImport } from '@/lib/export/studyFileImporter';
import type {
  DocumentRecord,
  NoteRecord,
  AnnotationRecord,
  BookmarkRecord,
  ReadingProgressRecord,
} from '@/types';

// Helper to create a minimal valid PDF ArrayBuffer using pdf-lib
async function createTestPdf(pageCount = 2, landscape = false): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  for (let i = 1; i <= pageCount; i++) {
    const page = pdfDoc.addPage(landscape ? [792, 612] : [612, 792]);
    page.drawText(`Test Page ${i}`, {
      x: 50,
      y: landscape ? 550 : 700,
      size: 20,
      color: rgb(0.1, 0.1, 0.1),
    });
  }
  return await pdfDoc.save();
}

describe('Export & Share: Standard PDF Export', () => {
  it('exports a PDF with no annotations successfully preserving original page count', async () => {
    const pdfBytes = await createTestPdf(3);
    const exportedBytes = await exportAnnotatedStandardPdf(
      pdfBytes,
      [],
      [],
      {
        includeHighlights: true,
        includePageMarkers: true,
        appendNotesPages: false,
      }
    );

    expect(exportedBytes).toBeInstanceOf(Uint8Array);
    expect(exportedBytes.length).toBeGreaterThan(0);

    const doc = await PDFDocument.load(exportedBytes);
    expect(doc.getPageCount()).toBe(3);
  });

  it('exports a PDF with multiple annotation types (highlights, markers)', async () => {
    const pdfBytes = await createTestPdf(2);

    const annotations: AnnotationRecord[] = [
      {
        id: 'ann-1',
        documentId: 'doc-1',
        pageNumber: 1,
        selectedText: 'Test Page 1',
        prefixText: '',
        suffixText: '',
        anchor: {
          pageNumber: 1,
          selectedText: 'Test Page 1',
          prefixText: '',
          suffixText: '',
        },
        normalizedRects: [
          { x: 0.08, y: 0.1, width: 0.3, height: 0.05 },
        ],
        noteTitle: 'Important Concept',
        noteContent: 'This is a key takeaway from page 1.',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'ann-2',
        documentId: 'doc-1',
        pageNumber: 2,
        selectedText: 'Test Page 2',
        prefixText: '',
        suffixText: '',
        anchor: {
          pageNumber: 2,
          selectedText: 'Test Page 2',
          prefixText: '',
          suffixText: '',
        },
        normalizedRects: [
          { x: 0.1, y: 0.2, width: 0.4, height: 0.04 },
        ],
        noteContent: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const notes: NoteRecord[] = [
      {
        id: 'note-1',
        documentId: 'doc-1',
        pageNumber: 1,
        title: 'Page 1 Summary',
        content: 'Overview notes for testing.',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const exportedBytes = await exportAnnotatedStandardPdf(
      pdfBytes,
      notes,
      annotations,
      {
        includeHighlights: true,
        includePageMarkers: true,
        appendNotesPages: false,
      }
    );

    const doc = await PDFDocument.load(exportedBytes);
    expect(doc.getPageCount()).toBe(2);
  });

  it('appends formatted study notes summary appendix pages', async () => {
    const pdfBytes = await createTestPdf(2);

    const notes: NoteRecord[] = [
      {
        id: 'note-1',
        documentId: 'doc-1',
        pageNumber: 1,
        title: 'Formula Derivation',
        content: 'E = mc^2 explains the mass-energy equivalence principle in modern physics.',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'note-2',
        documentId: 'doc-1',
        pageNumber: 2,
        title: 'Key Questions',
        content: 'Review chapter 4 problems 1-10 before next Tuesday exam.',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const annotations: AnnotationRecord[] = [
      {
        id: 'ann-1',
        documentId: 'doc-1',
        pageNumber: 1,
        selectedText: 'Special Relativity',
        prefixText: '',
        suffixText: '',
        anchor: {
          pageNumber: 1,
          selectedText: 'Special Relativity',
          prefixText: '',
          suffixText: '',
        },
        normalizedRects: [{ x: 0.1, y: 0.1, width: 0.3, height: 0.04 }],
        noteTitle: 'Vocabulary Term',
        noteContent: 'Postulated by Albert Einstein in 1905.',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const exportedBytes = await exportAnnotatedStandardPdf(
      pdfBytes,
      notes,
      annotations,
      {
        includeHighlights: true,
        includePageMarkers: true,
        appendNotesPages: true,
        documentTitle: 'Physics Notes',
      }
    );

    const doc = await PDFDocument.load(exportedBytes);
    // Original 2 pages + at least 1 appended notes appendix page
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(3);
  });

  it('handles landscape and rotated page dimensions correctly', async () => {
    const pdfBytes = await createTestPdf(1, true); // landscape 792x612

    const annotations: AnnotationRecord[] = [
      {
        id: 'ann-rot',
        documentId: 'doc-rot',
        pageNumber: 1,
        selectedText: 'Landscape text',
        prefixText: '',
        suffixText: '',
        anchor: {
          pageNumber: 1,
          selectedText: 'Landscape text',
          prefixText: '',
          suffixText: '',
        },
        normalizedRects: [{ x: 0.2, y: 0.3, width: 0.5, height: 0.1 }],
        noteContent: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const exportedBytes = await exportAnnotatedStandardPdf(
      pdfBytes,
      [],
      annotations,
      {
        includeHighlights: true,
        includePageMarkers: false,
        appendNotesPages: false,
      }
    );

    const doc = await PDFDocument.load(exportedBytes);
    expect(doc.getPageCount()).toBe(1);
    const p1 = doc.getPage(0);
    expect(p1.getWidth()).toBe(792);
    expect(p1.getHeight()).toBe(612);
  });
});

describe('Export & Share: PDFNoter Study File Exporter', () => {
  it('generates a valid .pdfnoter ZIP package with complete manifest and data', async () => {
    const pdfBytes = await createTestPdf(2);
    const fingerprint = await computePdfFingerprint(pdfBytes);

    const docRecord: DocumentRecord = {
      id: 'doc-test-123',
      fingerprint,
      fileName: 'Calculus_II.pdf',
      pageCount: 2,
      fileSize: pdfBytes.length,
      lastOpenedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const notes: NoteRecord[] = [
      {
        id: 'n1',
        documentId: docRecord.id,
        pageNumber: 1,
        title: 'Integral calculus',
        content: 'Integration by parts technique.',
        createdAt: 1000,
        updatedAt: 2000,
      },
    ];

    const annotations: AnnotationRecord[] = [
      {
        id: 'a1',
        documentId: docRecord.id,
        pageNumber: 2,
        selectedText: 'Definite integral',
        prefixText: '',
        suffixText: '',
        anchor: {
          pageNumber: 2,
          selectedText: 'Definite integral',
          prefixText: '',
          suffixText: '',
        },
        normalizedRects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.05 }],
        noteTitle: 'Definition',
        noteContent: 'Represents signed area.',
        createdAt: 1500,
        updatedAt: 2500,
      },
    ];

    const bookmarks: BookmarkRecord[] = [
      {
        id: 'b1',
        documentId: docRecord.id,
        pageNumber: 2,
        label: 'Chapter 2 Start',
        createdAt: 3000,
      },
    ];

    const readingProgress: ReadingProgressRecord = {
      documentId: docRecord.id,
      lastPage: 2,
      zoom: 1.25,
      scrollPosition: { x: 0, y: 0 },
      updatedAt: 4000,
    };

    const blob = await exportStudyFile(
      pdfBytes,
      docRecord,
      notes,
      annotations,
      bookmarks,
      readingProgress,
      {
        includeOriginalPdf: true,
        includeNotes: true,
        includeAnnotations: true,
        includeBookmarks: true,
        includeReadingProgress: true,
      }
    );

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);

    // Read ZIP entries
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(zip.file('manifest.json')).toBeDefined();
    expect(zip.file('document.pdf')).toBeDefined();
    expect(zip.file('notes.json')).toBeDefined();
    expect(zip.file('annotations.json')).toBeDefined();

    // Verify manifest
    const manifestStr = await zip.file('manifest.json')!.async('string');
    const manifest = JSON.parse(manifestStr);
    expect(manifest.format).toBe('pdfnoter');
    expect(manifest.version).toBe('1.0');
    expect(manifest.documentFileName).toBe('Calculus_II.pdf');
    expect(manifest.pageCount).toBe(2);
    expect(manifest.documentFingerprint).toBe(fingerprint);

    // Verify notes JSON
    const notesStr = await zip.file('notes.json')!.async('string');
    const parsedNotes = JSON.parse(notesStr);
    expect(parsedNotes).toHaveLength(1);
    expect(parsedNotes[0].title).toBe('Integral calculus');
    expect(parsedNotes[0].pageIndex).toBe(0); // 0-indexed schema

    // Verify annotations JSON
    const annStr = await zip.file('annotations.json')!.async('string');
    const parsedAnn = JSON.parse(annStr);
    expect(parsedAnn).toHaveLength(1);
    expect(parsedAnn[0].selectedText).toBe('Definite integral');
    expect(parsedAnn[0].pageIndex).toBe(1);
  });
});

describe('Export & Share: Study File Security & Validation', () => {
  it('rejects corrupted or non-zip packages', async () => {
    const invalidFile = new File(['not a zip at all'], 'corrupt.pdfnoter', {
      type: 'application/octet-stream',
    });

    const result = await validateStudyFile(invalidFile);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('corrupted');
  });

  it('rejects packages missing manifest.json', async () => {
    const zip = new JSZip();
    zip.file('document.pdf', new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])); // %PDF-
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const file = new File([zipBlob], 'missing_manifest.pdfnoter');

    const result = await validateStudyFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('manifest.json');
  });

  it('rejects packages with unsupported format version', async () => {
    const zip = new JSZip();
    zip.file(
      'manifest.json',
      JSON.stringify({
        format: 'pdfnoter',
        version: '99.0',
        documentFileName: 'test.pdf',
        documentFingerprint: 'dummy',
        pageCount: 1,
        exportTimestamp: Date.now(),
        annotationSchemaVersion: '1.0',
      })
    );
    zip.file('document.pdf', new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]));
    zip.file('notes.json', '[]');
    zip.file('annotations.json', '[]');

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const file = new File([zipBlob], 'unsupported_ver.pdfnoter');

    const result = await validateStudyFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Unsupported version');
  });

  it('rejects packages containing Zip-Slip / path traversal entries', async () => {
    const zip = new JSZip();
    zip.file(
      'manifest.json',
      JSON.stringify({
        format: 'pdfnoter',
        version: '1.0',
        documentFileName: 'safe.pdf',
        documentFingerprint: 'dummy',
        pageCount: 1,
        exportTimestamp: Date.now(),
        annotationSchemaVersion: '1.0',
      })
    );
    zip.file('document.pdf', new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]));
    // Path traversal attempt
    zip.file('../evil.sh', 'malicious code');

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const file = new File([zipBlob], 'zip_slip.pdfnoter');

    const result = await validateStudyFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('illegal path traversal');
  });

  it('rejects packages where document.pdf is not a valid PDF header', async () => {
    const zip = new JSZip();
    zip.file(
      'manifest.json',
      JSON.stringify({
        format: 'pdfnoter',
        version: '1.0',
        documentFileName: 'fake.pdf',
        documentFingerprint: 'dummy',
        pageCount: 1,
        exportTimestamp: Date.now(),
        annotationSchemaVersion: '1.0',
      })
    );
    zip.file('document.pdf', 'NOT_A_PDF_HEADER_JUST_TEXT');
    zip.file('notes.json', '[]');
    zip.file('annotations.json', '[]');

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const file = new File([zipBlob], 'fake_pdf.pdfnoter');

    const result = await validateStudyFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('does not appear to be a valid PDF');
  });
});

describe('Export & Share: End-to-End Round-Trip', () => {
  let testDb: StudyReaderDB;
  let service: DexieStorageService;

  beforeEach(async () => {
    const dbName = `TestDB_RoundTrip_${Math.random().toString(36).substring(7)}`;
    testDb = new StudyReaderDB(dbName);
    await testDb.open();
    service = new DexieStorageService(testDb);
  });

  it('full round-trip: Create notes -> Export .pdfnoter -> Import into fresh database -> Verify restoration', async () => {
    // 1. Create source document and study data
    const pdfBytes = await createTestPdf(3);
    const fingerprint = await computePdfFingerprint(pdfBytes);

    const originalDoc: DocumentRecord = {
      id: 'doc-source-1',
      fingerprint,
      fileName: 'Biology_Genetics.pdf',
      pageCount: 3,
      fileSize: pdfBytes.length,
      lastOpenedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const originalNotes: NoteRecord[] = [
      {
        id: 'n-1',
        documentId: originalDoc.id,
        pageNumber: 1,
        title: 'Mendelian Inheritance',
        content: 'Dominant and recessive alleles in pea plants.',
        createdAt: 1000000,
        updatedAt: 1000500,
      },
      {
        id: 'n-2',
        documentId: originalDoc.id,
        pageNumber: 3,
        title: 'DNA Double Helix',
        content: 'Watson and Crick model with base pairing.',
        createdAt: 1001000,
        updatedAt: 1001500,
      },
    ];

    const originalAnnotations: AnnotationRecord[] = [
      {
        id: 'a-1',
        documentId: originalDoc.id,
        pageNumber: 2,
        selectedText: 'Phenotype vs Genotype',
        prefixText: 'Understanding the ',
        suffixText: ' difference is crucial.',
        anchor: {
          pageNumber: 2,
          selectedText: 'Phenotype vs Genotype',
          prefixText: 'Understanding the ',
          suffixText: ' difference is crucial.',
        },
        normalizedRects: [{ x: 0.15, y: 0.25, width: 0.45, height: 0.035 }],
        noteTitle: 'Key Distinction',
        noteContent: 'Observable physical properties vs genetic makeup.',
        color: '#fef08a',
        createdAt: 2000000,
        updatedAt: 2000500,
      },
    ];

    const originalBookmarks: BookmarkRecord[] = [
      {
        id: 'b-1',
        documentId: originalDoc.id,
        pageNumber: 3,
        label: 'Molecular Genetics',
        createdAt: 3000000,
      },
    ];

    // 2. Export to .pdfnoter
    const blob = await exportStudyFile(
      pdfBytes,
      originalDoc,
      originalNotes,
      originalAnnotations,
      originalBookmarks,
      {
        documentId: originalDoc.id,
        lastPage: 2,
        zoom: 1.5,
        scrollPosition: { x: 0, y: 0 },
        updatedAt: Date.now(),
      },
      {
        includeOriginalPdf: true,
        includeNotes: true,
        includeAnnotations: true,
        includeBookmarks: true,
        includeReadingProgress: true,
      }
    );

    const studyFile = new File([blob], 'Biology_Genetics.pdfnoter');

    // 3. Validate
    const validation = await validateStudyFile(studyFile);
    expect(validation.valid).toBe(true);
    expect(validation.manifest?.documentFileName).toBe('Biology_Genetics.pdf');
    expect(validation.payload?.notes).toHaveLength(2);
    expect(validation.payload?.annotations).toHaveLength(1);
    expect(validation.payload?.bookmarks).toHaveLength(1);

    // 4. Commit Import into the test database
    const importResult = await commitStudyFileImport(validation, 'merge', service);

    expect(importResult.documentRecord).toBeDefined();
    expect(importResult.documentRecord.fileName).toBe('Biology_Genetics.pdf');
    expect(importResult.documentRecord.pageCount).toBe(3);
    expect(importResult.importedNotes).toBe(2);
    expect(importResult.importedAnnotations).toBe(1);
    expect(importResult.importedBookmarks).toBe(1);

    // 5. Verify database records
    const restoredNotes = await service.getNotesForDocument(importResult.documentRecord.id);
    expect(restoredNotes).toHaveLength(2);

    const n1 = restoredNotes.find((n) => n.pageNumber === 1);
    expect(n1).toBeDefined();
    expect(n1?.title).toBe('Mendelian Inheritance');
    expect(n1?.content).toBe('Dominant and recessive alleles in pea plants.');

    const n2 = restoredNotes.find((n) => n.pageNumber === 3);
    expect(n2).toBeDefined();
    expect(n2?.title).toBe('DNA Double Helix');

    const restoredAnn = await service.getAnnotationsForDocument(importResult.documentRecord.id);
    expect(restoredAnn).toHaveLength(1);
    expect(restoredAnn[0].pageNumber).toBe(2);
    expect(restoredAnn[0].selectedText).toBe('Phenotype vs Genotype');
    expect(restoredAnn[0].noteTitle).toBe('Key Distinction');
    expect(restoredAnn[0].normalizedRects[0].x).toBeCloseTo(0.15, 2);
    expect(restoredAnn[0].anchor?.prefixText).toBe('Understanding the ');

    const restoredBookmarks = await service.getBookmarksForDocument(importResult.documentRecord.id);
    expect(restoredBookmarks).toHaveLength(1);
    expect(restoredBookmarks[0].pageNumber).toBe(3);
    expect(restoredBookmarks[0].label).toBe('Molecular Genetics');

    // 6. Verify restored File object can be converted to ArrayBuffer and read
    const fileBuffer = await importResult.file.arrayBuffer();
    expect(fileBuffer.byteLength).toBe(pdfBytes.length);
    const restoredDoc = await PDFDocument.load(fileBuffer);
    expect(restoredDoc.getPageCount()).toBe(3);
  });

  it('creates a non-conflicting new copy when new_copy mode is selected', async () => {
    const pdfBytes = await createTestPdf(1);
    const fingerprint = await computePdfFingerprint(pdfBytes);

    // Save existing document in DB
    const existing = await service.saveDocumentMetadata({
      fingerprint,
      fileName: 'Original.pdf',
      pageCount: 1,
      fileSize: pdfBytes.length,
      lastOpenedAt: Date.now(),
    });

    const docRecord: DocumentRecord = {
      id: existing.id,
      fingerprint,
      fileName: 'Original.pdf',
      pageCount: 1,
      fileSize: pdfBytes.length,
      lastOpenedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const blob = await exportStudyFile(
      pdfBytes,
      docRecord,
      [],
      [],
      [],
      undefined,
      {
        includeOriginalPdf: true,
        includeNotes: true,
        includeAnnotations: true,
        includeBookmarks: true,
        includeReadingProgress: false,
      }
    );

    const studyFile = new File([blob], 'Original.pdfnoter');
    const validation = await validateStudyFile(studyFile);
    expect(validation.valid).toBe(true);

    // Import as new copy
    const importResult = await commitStudyFileImport(validation, 'new_copy', service);

    expect(importResult.documentRecord.id).not.toBe(existing.id);
    expect(importResult.documentRecord.fileName).toContain('(Copy');

    // Verify original still exists unchanged
    const allDocs = await service.getAllDocuments();
    expect(allDocs).toHaveLength(2);
  });
});
