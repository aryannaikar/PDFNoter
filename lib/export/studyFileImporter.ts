import JSZip from 'jszip';
import type {
  NoteRecord,
  AnnotationRecord,
  BookmarkRecord,
  ReadingProgressRecord,
} from '@/types';
import type {
  StudyFileManifest,
  StudyFilePayload,
  StudyFileValidationResult,
  StudyFileImportResult,
} from '@/types/studyFile';
import { computePdfFingerprint } from '@/lib/pdf/fingerprint';
import { sanitizeUrl } from '@/lib/utils/url';
import { sanitizeImageUrl } from '@/lib/utils/image';
import { storageService } from '@/services/storage/dexieStorageService';

const MAX_ZIP_SIZE = 150 * 1024 * 1024; // 150MB limit

/**
 * Validates and unpacks a .pdfnoter file without saving it to database yet.
 * Performs zip slip protection, format checks, and schema validation.
 */
export async function validateStudyFile(
  fileOrBuffer: File | Blob | ArrayBuffer
): Promise<StudyFileValidationResult> {
  try {
    if (fileOrBuffer instanceof Blob && fileOrBuffer.size > MAX_ZIP_SIZE) {
      return { valid: false, error: 'File exceeds maximum supported size (150MB).' };
    }

    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(fileOrBuffer);

    // 1. Path traversal & Zip-slip check
    for (const filename of Object.keys(loadedZip.files)) {
      if (
        filename.includes('..') ||
        filename.startsWith('/') ||
        filename.startsWith('\\') ||
        filename.includes(':')
      ) {
        return {
          valid: false,
          error: 'Security alert: Package contains unsafe file paths (zip-slip / illegal path traversal detected).',
        };
      }
    }

    // 2. Validate manifest.json
    const manifestFile = loadedZip.file('manifest.json');
    if (!manifestFile) {
      return {
        valid: false,
        error: 'Invalid .pdfnoter package: Missing manifest.json.',
      };
    }

    const manifestText = await manifestFile.async('text');
    let manifest: StudyFileManifest;
    try {
      manifest = JSON.parse(manifestText);
    } catch {
      return { valid: false, error: 'Malformed manifest.json: Unable to parse JSON.' };
    }

    if (manifest.format !== 'pdfnoter') {
      return {
        valid: false,
        error: `Unsupported package format "${(manifest as any).format || 'unknown'}". Expected "pdfnoter".`,
      };
    }

    const verStr = String(manifest.version || manifest.formatVersion || '');
    if (!['1', '1.0'].includes(verStr)) {
      return {
        valid: false,
        error: `Unsupported version ${verStr}. Supported version: 1.0.`,
      };
    }

    // Normalize manifest top-level fields
    const docFileName = manifest.documentFileName || manifest.document?.fileName || 'study_document.pdf';
    const docFingerprint = manifest.documentFingerprint || manifest.document?.fingerprint || '';
    const pageCount = Number(manifest.pageCount || manifest.document?.pageCount || 0);

    manifest.documentFileName = docFileName;
    manifest.documentFingerprint = docFingerprint;
    manifest.pageCount = pageCount;
    if (!manifest.document) {
      manifest.document = {
        id: `doc_${Math.random().toString(36).substring(2, 9)}`,
        fileName: docFileName,
        fileSize: 0,
        pageCount,
        fingerprint: docFingerprint,
      };
    }

    // 3. Validate embedded document.pdf
    const pdfEntry = loadedZip.file('document.pdf');
    if (!pdfEntry) {
      return {
        valid: false,
        error: 'Invalid .pdfnoter package: Missing embedded document.pdf.',
      };
    }

    const pdfBytes = await pdfEntry.async('uint8array');
    if (pdfBytes.length < 5) {
      return { valid: false, error: 'Embedded PDF is empty or corrupt.' };
    }

    // Verify PDF magic header (%PDF-)
    const header = String.fromCharCode(...pdfBytes.slice(0, 5));
    if (!header.startsWith('%PDF-')) {
      return { valid: false, error: 'Embedded document does not appear to be a valid PDF file (missing %PDF- header).' };
    }

    manifest.document.fileSize = pdfBytes.length;

    // 4. Validate notes.json
    let notes: NoteRecord[] = [];
    const notesEntry = loadedZip.file('notes.json');
    if (notesEntry) {
      try {
        const rawNotes = JSON.parse(await notesEntry.async('text'));
        if (Array.isArray(rawNotes)) {
          notes = rawNotes
            .filter((n) => n && (typeof n.content === 'string' || typeof n.noteContent === 'string'))
            .map((n) => {
              const pNum = Number(n.pageNumber ?? (n.pageIndex !== undefined ? n.pageIndex + 1 : 1));
              return {
                id: String(n.id || `note_${Math.random().toString(36).substring(2, 9)}`),
                documentId: manifest.document.id,
                pageNumber: pNum > 0 ? pNum : 1,
                title: n.title ? String(n.title).slice(0, 300) : undefined,
                content: String(n.content ?? n.noteContent ?? '').slice(0, 50000),
                sourceUrl: n.sourceUrl ? sanitizeUrl(String(n.sourceUrl)) : undefined,
                imageUrl: n.imageUrl ? sanitizeImageUrl(String(n.imageUrl)) : undefined,
                createdAt: Number(n.createdAt) || Date.now(),
                updatedAt: Number(n.updatedAt) || Date.now(),
              };
            });
        }
      } catch {
        return { valid: false, error: 'Malformed notes.json in study package.' };
      }
    }

    // 5. Validate annotations.json
    let annotations: AnnotationRecord[] = [];
    const annEntry = loadedZip.file('annotations.json');
    if (annEntry) {
      try {
        const rawAnn = JSON.parse(await annEntry.async('text'));
        if (Array.isArray(rawAnn)) {
          annotations = rawAnn.map((a) => {
            const pNum = Number(a.pageNumber ?? (a.pageIndex !== undefined ? a.pageIndex + 1 : 1));
            return {
              id: String(a.id || `ann_${Math.random().toString(36).substring(2, 9)}`),
              documentId: manifest.document.id,
              pageNumber: pNum > 0 ? pNum : 1,
              selectedText: String(a.selectedText || '').slice(0, 10000),
              prefixText: String(a.prefixText || a.anchor?.prefixText || '').slice(0, 1000),
              suffixText: String(a.suffixText || a.anchor?.suffixText || '').slice(0, 1000),
              anchor: a.anchor || {
                pageNumber: pNum > 0 ? pNum : 1,
                selectedText: String(a.selectedText || ''),
                prefixText: '',
                suffixText: '',
              },
              normalizedRects: Array.isArray(a.normalizedRects) ? a.normalizedRects : [],
              noteTitle: a.noteTitle ? String(a.noteTitle).slice(0, 300) : undefined,
              noteContent: String(a.noteContent ?? a.content ?? '').slice(0, 50000),
              sourceUrl: a.sourceUrl ? sanitizeUrl(String(a.sourceUrl)) : undefined,
              imageUrl: a.imageUrl ? sanitizeImageUrl(String(a.imageUrl)) : undefined,
              color: a.color ? String(a.color) : undefined,
              createdAt: Number(a.createdAt) || Date.now(),
              updatedAt: Number(a.updatedAt) || Date.now(),
            };
          });
        }
      } catch {
        return { valid: false, error: 'Malformed annotations.json in study package.' };
      }
    }

    // 6. Optional bookmarks & reading progress
    let bookmarks: BookmarkRecord[] = [];
    const bmEntry = loadedZip.file('bookmarks.json');
    if (bmEntry) {
      try {
        const rawBm = JSON.parse(await bmEntry.async('text'));
        if (Array.isArray(rawBm)) {
          bookmarks = rawBm.map((b) => {
            const pNum = Number(b.pageNumber ?? (b.pageIndex !== undefined ? b.pageIndex + 1 : 1));
            return {
              id: String(b.id || `bm_${Math.random().toString(36).substring(2, 9)}`),
              documentId: manifest.document.id,
              pageNumber: pNum > 0 ? pNum : 1,
              label: String(b.label || `Page ${pNum}`).slice(0, 200),
              createdAt: Number(b.createdAt) || Date.now(),
            };
          });
        }
      } catch {
        // optional
      }
    }

    let readingProgress: ReadingProgressRecord | undefined;
    const progEntry = loadedZip.file('readingProgress.json');
    if (progEntry) {
      try {
        const rawProg = JSON.parse(await progEntry.async('text'));
        if (rawProg) {
          readingProgress = {
            documentId: manifest.document.id,
            lastPage: Number(rawProg.lastPage) || 1,
            zoom: Number(rawProg.zoom) || 1,
            scrollPosition: rawProg.scrollPosition || { x: 0, y: 0 },
            updatedAt: Number(rawProg.updatedAt) || Date.now(),
          };
        }
      } catch {
        // optional
      }
    }

    const payload: StudyFilePayload = {
      manifest,
      notes,
      annotations,
      bookmarks,
      readingProgress,
    };

    return {
      valid: true,
      manifest,
      payload,
      pdfBytes,
      notes,
      annotations,
      bookmarks,
      readingProgress,
    };
  } catch (err: any) {
    return {
      valid: false,
      error: `Failed to read archive: corrupted or invalid ZIP archive (${err.message || 'unknown error'})`,
    };
  }
}

/**
 * Imports a validated study package into the IndexedDB database,
 * re-attaching notes and returning a reconstructed File object for the reader.
 */
export async function commitStudyFileImport(
  validated: StudyFileValidationResult,
  importMode: 'merge' | 'new_copy' = 'merge',
  customStorage?: any
): Promise<StudyFileImportResult> {
  if (!validated.valid || !validated.manifest || !validated.pdfBytes) {
    throw new Error('Cannot commit invalid study package');
  }

  const storage = customStorage || storageService;
  const manifest = validated.manifest;
  const pdfBytes = validated.pdfBytes;
  const fingerprint = await computePdfFingerprint(pdfBytes);

  // Check if document already exists
  const existingDoc = await storage.getDocumentByFingerprint(fingerprint);

  let targetDocId = existingDoc ? existingDoc.id : manifest.document.id;
  let targetFileName = manifest.documentFileName || manifest.document?.fileName || 'study_document.pdf';
  let targetFingerprint = fingerprint;

  if (importMode === 'new_copy') {
    targetDocId = `doc_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
    const baseName = targetFileName.replace(/\.pdf$/i, '');
    targetFileName = `${baseName} (Copy).pdf`;
    if (existingDoc) {
      targetFingerprint = `${fingerprint}#copy_${Date.now()}`;
    }
  } else if (existingDoc) {
    targetDocId = existingDoc.id;
    targetFileName = existingDoc.fileName;
  }

  // Save/Update Document Record
  const docRecord = await storage.saveDocumentMetadata({
    id: targetDocId,
    fingerprint: targetFingerprint,
    fileName: targetFileName,
    pageCount: manifest.pageCount || manifest.document?.pageCount || 0,
    fileSize: pdfBytes.length,
    lastOpenedAt: Date.now(),
  });

  // Re-map document IDs to targetDocId
  const notesToSave = (validated.notes || []).map((n) => ({
    ...n,
    documentId: targetDocId,
  }));

  const annToSave = (validated.annotations || []).map((a) => ({
    ...a,
    documentId: targetDocId,
  }));

  const bmToSave = (validated.bookmarks || []).map((b) => ({
    ...b,
    documentId: targetDocId,
  }));

  // Save notes & annotations into DB
  for (const note of notesToSave) {
    try {
      await storage.createNote(note);
    } catch {
      // If note already exists by id, update it
      await storage.updateNote(note.id, {
        title: note.title,
        content: note.content,
        sourceUrl: note.sourceUrl,
        imageUrl: note.imageUrl,
      });
    }
  }

  for (const ann of annToSave) {
    try {
      await storage.createAnnotation(ann);
    } catch {
      await storage.updateAnnotation(ann.id, {
        noteTitle: ann.noteTitle,
        noteContent: ann.noteContent,
        sourceUrl: ann.sourceUrl,
        imageUrl: ann.imageUrl,
      });
    }
  }

  for (const bm of bmToSave) {
    try {
      await storage.createBookmark(targetDocId, bm.pageNumber, bm.label);
    } catch {
      // ignore duplicate bookmark
    }
  }

  if (validated.readingProgress) {
    await storage.saveReadingProgress({
      documentId: targetDocId,
      lastPage: validated.readingProgress.lastPage,
      zoom: validated.readingProgress.zoom,
      scrollPosition: validated.readingProgress.scrollPosition,
    });
  }

  // Reconstruct standard File object for reader component
  const file = new File([new Uint8Array(pdfBytes)], targetFileName, {
    type: 'application/pdf',
    lastModified: Date.now(),
  });

  return {
    documentRecord: docRecord,
    file,
    importedNotes: notesToSave.length,
    importedAnnotations: annToSave.length,
    importedBookmarks: bmToSave.length,
    isExisting: !!existingDoc,
  };
}
