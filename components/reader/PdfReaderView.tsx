'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { storageService } from '@/services/storage/dexieStorageService';
import type {
  DocumentRecord,
  NoteRecord,
  AnnotationRecord,
  BookmarkRecord,
} from '@/types';
import { PdfPageItem } from './PdfPageItem';
import { ReaderToolbar } from './ReaderToolbar';
import { SearchBar } from './SearchBar';
import { BookmarksDrawer } from './BookmarksDrawer';
import { NotesDrawer } from './NotesDrawer';
import { StickyNoteWindow } from '@/components/notes/StickyNoteWindow';
import { NoteEditorModal, NoteEditorData } from '@/components/notes/NoteEditorModal';
import { ExportShareModal } from '@/components/export/ExportShareModal';
import { Loader2, AlertCircle } from 'lucide-react';

interface PdfReaderViewProps {
  file: File | null;
  documentRecord: DocumentRecord;
  onBackToLibrary: () => void;
}

export function PdfReaderView({
  file,
  documentRecord,
  onBackToLibrary,
}: PdfReaderViewProps) {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(true);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Reader state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(documentRecord.pageCount || 1);
  const [scale, setScale] = useState(1.15);

  // Data state
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [annotations, setAnnotations] = useState<AnnotationRecord[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([]);

  // Modals & Panels
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [isStickyNoteOpen, setIsStickyNoteOpen] = useState(false);
  const [isNotesDrawerOpen, setIsNotesDrawerOpen] = useState(false);
  const [isExportShareOpen, setIsExportShareOpen] = useState(false);

  // Editor modal state
  const [editorState, setEditorState] = useState<{
    isOpen: boolean;
    pageNumber: number;
    isAnnotation: boolean;
    initialData?: NoteEditorData;
    editTargetId?: string; // id of note or annotation being edited
    annotationAnchor?: any;
    annotationRects?: any[];
  }>({
    isOpen: false,
    pageNumber: 1,
    isAnnotation: false,
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const saveProgressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Load initial records & reading progress
  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const [loadedNotes, loadedAnn, loadedBm, progress] = await Promise.all([
          storageService.getNotesForDocument(documentRecord.id),
          storageService.getAnnotationsForDocument(documentRecord.id),
          storageService.getBookmarksForDocument(documentRecord.id),
          storageService.getReadingProgress(documentRecord.id),
        ]);

        if (!active) return;
        setNotes(loadedNotes);
        setAnnotations(loadedAnn);
        setBookmarks(loadedBm);

        if (progress) {
          if (progress.lastPage && progress.lastPage > 0) {
            setCurrentPage(progress.lastPage);
          }
          if (progress.zoom && progress.zoom >= 0.5 && progress.zoom <= 3.0) {
            setScale(progress.zoom);
          }
        }
      } catch (err) {
        console.error('Failed to load document records:', err);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [documentRecord.id]);

  // 2. Load PDF file using PDF.js
  useEffect(() => {
    if (!file) {
      setPdfError('No file data available. Please re-open the file from the library.');
      setIsLoadingPdf(false);
      return;
    }

    let active = true;
    let loadedDoc: PDFDocumentProxy | null = null;

    async function loadPdfDocument() {
      setIsLoadingPdf(true);
      setPdfError(null);

      try {
        const pdfjs = await import('pdfjs-dist');
        // Point worker to local public path for 100% offline support
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

        const arrayBuffer = await file!.arrayBuffer();
        if (!active) return;

        const loadingTask = pdfjs.getDocument({
          data: new Uint8Array(arrayBuffer),
        });

        loadedDoc = await loadingTask.promise;
        if (!active) {
          if ((loadedDoc as any)?.destroy) {
            (loadedDoc as any).destroy();
          }
          return;
        }

        setPdfDoc(loadedDoc);
        setTotalPages(loadedDoc.numPages);

        // Auto-fit scale on initial document open if no progress zoom was saved
        try {
          const progress = await storageService.getReadingProgress(documentRecord.id);
          if (!progress?.zoom) {
            const firstPage = await loadedDoc.getPage(1);
            const vp1 = firstPage.getViewport({ scale: 1 });
            const viewWidth = scrollContainerRef.current?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 600);
            const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
            const padding = isMobile ? 16 : 48;
            const availableWidth = Math.max(260, viewWidth - padding);
            const fitScale = Math.min(1.8, Math.max(0.3, availableWidth / vp1.width));
            const rounded = Math.round(fitScale * 100) / 100;
            setScale(rounded);
          }
        } catch {
          if (typeof window !== 'undefined' && window.innerWidth < 640) {
            setScale(0.55);
          }
        }

        // Update document page count in database if not set
        if (documentRecord.pageCount !== loadedDoc.numPages) {
          storageService.saveDocumentMetadata({
            id: documentRecord.id,
            fingerprint: documentRecord.fingerprint,
            fileName: documentRecord.fileName,
            pageCount: loadedDoc.numPages,
            fileSize: documentRecord.fileSize,
            lastOpenedAt: Date.now(),
          }).catch(console.warn);
        }

        setIsLoadingPdf(false);
      } catch (err: any) {
        if (!active) return;
        console.error('PDF parsing error:', err);
        if (err.name === 'PasswordException') {
          setPdfError('This PDF document is password-protected. Password decryption is not currently supported.');
        } else if (err.name === 'InvalidPDFException') {
          setPdfError('The selected file is not a valid or supported PDF document.');
        } else {
          setPdfError(`Failed to load PDF document: ${err.message || 'Unknown error'}`);
        }
        setIsLoadingPdf(false);
      }
    }

    loadPdfDocument();

    return () => {
      active = false;
      if (loadedDoc) {
        if ((loadedDoc as any)?.destroy) {
          (loadedDoc as any).destroy();
        }
      }
    };
  }, [file, documentRecord]);

  // 3. Debounced reading progress saving
  const scheduleSaveProgress = useCallback((page: number, zoomLevel: number) => {
    if (saveProgressTimerRef.current) {
      clearTimeout(saveProgressTimerRef.current);
    }
    saveProgressTimerRef.current = setTimeout(() => {
      const scrollPos = scrollContainerRef.current
        ? { x: scrollContainerRef.current.scrollLeft, y: scrollContainerRef.current.scrollTop }
        : { x: 0, y: 0 };

      storageService.saveReadingProgress({
        documentId: documentRecord.id,
        lastPage: page,
        zoom: zoomLevel,
        scrollPosition: scrollPos,
      }).catch(console.warn);
    }, 800);
  }, [documentRecord.id]);

  // 4. Track visible page on scroll
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || !pdfDoc) return;

    const containerTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    const midpoint = containerTop + containerHeight / 3;

    // Find which page is at the midpoint
    for (let p = 1; p <= pdfDoc.numPages; p++) {
      const el = document.getElementById(`page-container-${p}`);
      if (el) {
        const top = el.offsetTop;
        const bottom = top + el.clientHeight;
        if (top <= midpoint && bottom >= midpoint) {
          if (currentPage !== p) {
            setCurrentPage(p);
            scheduleSaveProgress(p, scale);
          }
          break;
        }
      }
    }
  }, [pdfDoc, currentPage, scale, scheduleSaveProgress]);

  // 5. Scroll to page
  const scrollToPage = useCallback((pageNumber: number) => {
    const targetPage = Math.max(1, Math.min(totalPages, pageNumber));
    setCurrentPage(targetPage);
    scheduleSaveProgress(targetPage, scale);

    const el = document.getElementById(`page-container-${targetPage}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [totalPages, scale, scheduleSaveProgress]);

  // 6. Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setIsSearchOpen(true);
      } else if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setIsBookmarksOpen(false);
        setIsStickyNoteOpen(false);
        setIsNotesDrawerOpen(false);
        if (editorState.isOpen) {
          setEditorState((prev) => ({ ...prev, isOpen: false }));
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        if (currentPage > 1) scrollToPage(currentPage - 1);
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        if (currentPage < totalPages) scrollToPage(currentPage + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages, scrollToPage, editorState.isOpen]);

  // Zoom handlers
  const handleZoomIn = () => {
    setScale((prev) => {
      const next = Math.min(2.5, Math.round((prev + 0.15) * 100) / 100);
      scheduleSaveProgress(currentPage, next);
      return next;
    });
  };

  const handleZoomOut = () => {
    setScale((prev) => {
      const next = Math.max(0.3, Math.round((prev - 0.15) * 100) / 100);
      scheduleSaveProgress(currentPage, next);
      return next;
    });
  };

  const handleFitWidth = () => {
    if (pdfDoc) {
      pdfDoc.getPage(1).then((page) => {
        const vp1 = page.getViewport({ scale: 1 });
        const viewWidth = scrollContainerRef.current?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 600);
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
        const padding = isMobile ? 16 : 48;
        const availableWidth = Math.max(260, viewWidth - padding);
        const calculatedScale = Math.min(2.5, Math.max(0.3, availableWidth / vp1.width));
        const rounded = Math.round(calculatedScale * 100) / 100;
        setScale(rounded);
        scheduleSaveProgress(currentPage, rounded);
      }).catch(console.error);
    }
  };

  // --- NOTE & ANNOTATION CRUD ---

  const handleAddPageNote = () => {
    setEditorState({
      isOpen: true,
      pageNumber: currentPage,
      isAnnotation: false,
      initialData: undefined,
      editTargetId: undefined,
    });
  };

  const handleAddAnnotationFromSelection = (data: {
    pageNumber: number;
    anchor: any;
    normalizedRects: any[];
    selectedText: string;
  }) => {
    setEditorState({
      isOpen: true,
      pageNumber: data.pageNumber,
      isAnnotation: true,
      initialData: {
        content: '',
        selectedText: data.selectedText,
      },
      editTargetId: undefined,
      annotationAnchor: data.anchor,
      annotationRects: data.normalizedRects,
    });
  };

  const handleEditNote = (note: NoteRecord) => {
    setEditorState({
      isOpen: true,
      pageNumber: note.pageNumber,
      isAnnotation: false,
      initialData: {
        title: note.title,
        content: note.content,
        sourceUrl: note.sourceUrl,
      },
      editTargetId: note.id,
    });
  };

  const handleDeleteNote = async (id: string) => {
    try {
      await storageService.deleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (err: any) {
      alert(`Failed to delete note: ${err.message}`);
    }
  };

  const handleEditAnnotation = (ann: AnnotationRecord) => {
    setEditorState({
      isOpen: true,
      pageNumber: ann.pageNumber,
      isAnnotation: true,
      initialData: {
        title: ann.noteTitle,
        content: ann.noteContent,
        sourceUrl: ann.sourceUrl,
        selectedText: ann.selectedText,
      },
      editTargetId: ann.id,
    });
  };

  const handleDeleteAnnotation = async (id: string) => {
    try {
      await storageService.deleteAnnotation(id);
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      alert(`Failed to delete annotation: ${err.message}`);
    }
  };

  const handleSaveEditor = async (data: NoteEditorData) => {
    if (editorState.isAnnotation) {
      if (editorState.editTargetId) {
        // Update existing annotation
        const updated = await storageService.updateAnnotation(editorState.editTargetId, {
          noteTitle: data.title,
          noteContent: data.content,
          sourceUrl: data.sourceUrl,
        });
        setAnnotations((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      } else {
        // Create new annotation
        const created = await storageService.createAnnotation({
          documentId: documentRecord.id,
          pageNumber: editorState.pageNumber,
          selectedText: data.selectedText || '',
          prefixText: editorState.annotationAnchor?.prefixText || '',
          suffixText: editorState.annotationAnchor?.suffixText || '',
          anchor: editorState.annotationAnchor,
          normalizedRects: editorState.annotationRects || [],
          noteTitle: data.title,
          noteContent: data.content,
          sourceUrl: data.sourceUrl,
        });
        setAnnotations((prev) => [...prev, created]);
      }
    } else {
      if (editorState.editTargetId) {
        // Update existing page note
        const updated = await storageService.updateNote(editorState.editTargetId, {
          title: data.title,
          content: data.content,
          sourceUrl: data.sourceUrl,
        });
        setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      } else {
        // Create new page note
        const created = await storageService.createNote({
          documentId: documentRecord.id,
          pageNumber: editorState.pageNumber,
          title: data.title,
          content: data.content,
          sourceUrl: data.sourceUrl,
        });
        setNotes((prev) => [...prev, created]);
      }
    }

    setEditorState((prev) => ({ ...prev, isOpen: false }));
  };

  // --- BOOKMARKS ---

  const handleAddBookmark = async (pageNumber: number, label: string) => {
    try {
      const created = await storageService.createBookmark(documentRecord.id, pageNumber, label);
      setBookmarks((prev) => [...prev, created].sort((a, b) => a.pageNumber - b.pageNumber));
    } catch (err: any) {
      alert(`Failed to save bookmark: ${err.message}`);
    }
  };

  const handleDeleteBookmark = async (id: string) => {
    try {
      await storageService.deleteBookmark(id);
      setBookmarks((prev) => prev.filter((b) => b.id !== id));
    } catch (err: any) {
      alert(`Failed to delete bookmark: ${err.message}`);
    }
  };

  const hasNotesOnCurrentPage =
    notes.some((n) => n.pageNumber === currentPage) ||
    annotations.some((a) => a.pageNumber === currentPage);

  return (
    <div className="flex flex-col h-screen w-full bg-neutral-100 dark:bg-neutral-950 overflow-hidden select-none transition-colors">
      {/* Reader Toolbar */}
      <ReaderToolbar
        fileName={documentRecord.fileName}
        currentPage={currentPage}
        totalPages={totalPages}
        scale={scale}
        hasNotesOnCurrentPage={hasNotesOnCurrentPage}
        notesCount={notes.length + annotations.length}
        bookmarksCount={bookmarks.length}
        onBackToLibrary={onBackToLibrary}
        onPrevPage={() => scrollToPage(currentPage - 1)}
        onNextPage={() => scrollToPage(currentPage + 1)}
        onJumpToPage={scrollToPage}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitWidth={handleFitWidth}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenBookmarks={() => setIsBookmarksOpen(true)}
        onOpenNotes={() => setIsStickyNoteOpen((prev) => !prev)}
        onOpenExportShare={() => setIsExportShareOpen(true)}
        onAddPageNote={handleAddPageNote}
      />

      {/* Main PDF Scroll Viewport */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-auto relative px-1 sm:px-6 py-2 sm:py-4 pb-20 sm:pb-6 flex flex-col items-center w-full"
      >
        {isLoadingPdf && (
          <div className="flex flex-col items-center justify-center my-auto py-24 text-neutral-500 dark:text-neutral-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400 mb-3" />
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Loading document pages...</p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">Preparing high-definition text layer</p>
          </div>
        )}

        {pdfError && (
          <div className="max-w-md my-auto p-6 bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-rose-200 dark:border-rose-900/50 text-center">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mb-1">Cannot Read Document</h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-4">{pdfError}</p>
            <button
              onClick={onBackToLibrary}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition"
            >
              Return to Library
            </button>
          </div>
        )}

        {pdfDoc && !isLoadingPdf && !pdfError && (
          <div className="flex flex-col items-center w-full">
            {Array.from({ length: pdfDoc.numPages }, (_, i) => i + 1).map((pNum) => (
              <PdfPageItem
                key={pNum}
                pdfDoc={pdfDoc}
                pageNumber={pNum}
                scale={scale}
                pageNotes={notes.filter((n) => n.pageNumber === pNum)}
                annotations={annotations.filter((a) => a.pageNumber === pNum)}
                onAddAnnotationFromSelection={handleAddAnnotationFromSelection}
                onEditNote={handleEditNote}
                onDeleteNote={handleDeleteNote}
                onEditAnnotation={handleEditAnnotation}
                onDeleteAnnotation={handleDeleteAnnotation}
              />
            ))}
          </div>
        )}
      </div>

      {/* Search Bar Floating Dropdown */}
      {pdfDoc && (
        <SearchBar
          pdfDoc={pdfDoc}
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onNavigateToMatch={scrollToPage}
        />
      )}

      {/* Bookmarks Drawer */}
      <BookmarksDrawer
        isOpen={isBookmarksOpen}
        currentPage={currentPage}
        bookmarks={bookmarks}
        onClose={() => setIsBookmarksOpen(false)}
        onNavigateToPage={scrollToPage}
        onAddBookmark={handleAddBookmark}
        onDeleteBookmark={handleDeleteBookmark}
      />

      {/* Sticky Note Window on PDF */}
      <StickyNoteWindow
        isOpen={isStickyNoteOpen}
        currentPage={currentPage}
        notes={notes}
        annotations={annotations}
        onClose={() => setIsStickyNoteOpen(false)}
        onNavigateToPage={scrollToPage}
        onEditNote={handleEditNote}
        onDeleteNote={handleDeleteNote}
        onEditAnnotation={handleEditAnnotation}
        onDeleteAnnotation={handleDeleteAnnotation}
        onAddNote={handleAddPageNote}
        onOpenFullList={() => {
          setIsStickyNoteOpen(false);
          setIsNotesDrawerOpen(true);
        }}
      />

      {/* Optional Full Notes Drawer */}
      <NotesDrawer
        isOpen={isNotesDrawerOpen}
        notes={notes}
        annotations={annotations}
        onClose={() => setIsNotesDrawerOpen(false)}
        onNavigateToPage={scrollToPage}
      />

      {/* Reusable Note Editor Modal */}
      <NoteEditorModal
        isOpen={editorState.isOpen}
        pageNumber={editorState.pageNumber}
        isAnnotation={editorState.isAnnotation}
        initialData={editorState.initialData}
        onSave={handleSaveEditor}
        onCancel={() => setEditorState((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Export & Share Modal */}
      <ExportShareModal
        isOpen={isExportShareOpen}
        onClose={() => setIsExportShareOpen(false)}
        pdfFile={file}
        documentRecord={documentRecord}
        notes={notes}
        annotations={annotations}
        bookmarks={bookmarks}
        onImportSuccess={async (importedFile, importedDoc) => {
          if (importedDoc.id === documentRecord.id) {
            // Reload notes, annotations, bookmarks
            const [loadedNotes, loadedAnn, loadedBm] = await Promise.all([
              storageService.getNotesForDocument(documentRecord.id),
              storageService.getAnnotationsForDocument(documentRecord.id),
              storageService.getBookmarksForDocument(documentRecord.id),
            ]);
            setNotes(loadedNotes);
            setAnnotations(loadedAnn);
            setBookmarks(loadedBm);
          } else {
            // Imported a new document or copy; return to library
            onBackToLibrary();
          }
        }}
      />
    </div>
  );
}
