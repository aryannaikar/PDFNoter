'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Upload,
  Search,
  FileText,
  Clock,
  Trash2,
  Database,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  FileUp,
  FolderOpen,
  Package,
} from 'lucide-react';
import { storageService } from '@/services/storage/dexieStorageService';
import { computePdfFingerprint } from '@/lib/pdf/fingerprint';
import { requestPersistentStorage } from '@/lib/db/database';
import type { DocumentRecord } from '@/types';
import { BackupModal } from './BackupModal';
import { ExportShareModal } from '@/components/export/ExportShareModal';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

interface LibraryViewProps {
  onOpenDocument: (file: File, docRecord: DocumentRecord) => void;
}

export function LibraryView({ onOpenDocument }: LibraryViewProps) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [docNotesCount, setDocNotesCount] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [targetReopenDoc, setTargetReopenDoc] = useState<DocumentRecord | null>(null);
  const [isStoragePersisted, setIsStoragePersisted] = useState<boolean | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const reopenInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = async () => {
    try {
      const docs = await storageService.getAllDocuments();
      setDocuments(docs);

      // Load note counts for each doc
      const counts: Record<string, number> = {};
      for (const d of docs) {
        const [notes, ann] = await Promise.all([
          storageService.getNotesForDocument(d.id),
          storageService.getAnnotationsForDocument(d.id),
        ]);
        counts[d.id] = notes.length + ann.length;
      }
      setDocNotesCount(counts);
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  };

  useEffect(() => {
    loadDocuments();

    // Check storage persistence
    if (typeof window !== 'undefined' && navigator.storage && navigator.storage.persisted) {
      navigator.storage.persisted().then(setIsStoragePersisted).catch(() => {});
    }
  }, []);

  const handleRequestStorage = async () => {
    const granted = await requestPersistentStorage();
    setIsStoragePersisted(granted);
    if (granted) {
      alert('Persistent browser storage granted. Your notes are protected against automatic browser cache clearing.');
    } else {
      alert('Persistent storage could not be granted by the browser. You can still export your notes as JSON anytime.');
    }
  };

  // Process a selected PDF or .pdfnoter file
  const processSelectedFile = async (file: File, expectedDoc?: DocumentRecord) => {
    if (file.name.toLowerCase().endsWith('.pdfnoter') || file.name.toLowerCase().endsWith('.zip')) {
      setIsImportModalOpen(true);
      return;
    }

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setErrorMessage('Please select a valid PDF file or a .pdfnoter study package.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const fingerprint = await computePdfFingerprint(arrayBuffer);

      if (expectedDoc && expectedDoc.fingerprint !== fingerprint) {
        setErrorMessage(
          `Fingerprint mismatch! The selected file does not match "${expectedDoc.fileName}". Its contents have changed.`
        );
        setIsProcessing(false);
        return;
      }

      // Check or create doc record
      let docRecord = await storageService.getDocumentByFingerprint(fingerprint);

      if (!docRecord) {
        docRecord = await storageService.saveDocumentMetadata({
          fingerprint,
          fileName: file.name,
          pageCount: 0,
          fileSize: file.size,
          lastOpenedAt: Date.now(),
        });
      } else {
        await storageService.updateDocumentLastOpened(docRecord.id);
      }

      onOpenDocument(file, docRecord);
    } catch (err: any) {
      console.error('File processing error:', err);
      setErrorMessage(`Failed to open PDF: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
      setTargetReopenDoc(null);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file, targetReopenDoc || undefined);
    }
    // Reset file input value
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const handleDeleteDocument = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this document and all its associated notes, annotations, and bookmarks?')) {
      await storageService.deleteDocument(id);
      loadDocuments();
    }
  };

  const filteredDocs = documents.filter((doc) =>
    doc.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-neutral-50/60 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col font-sans transition-colors duration-200">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf,.pdfnoter,.zip"
        onChange={handleFileInputChange}
        className="hidden"
      />
      <input
        ref={reopenInputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Header */}
      <header className="border-b border-neutral-200/80 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md sticky top-0 z-30 transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200 dark:shadow-none">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-50 tracking-tight">Offline PDF Study Reader</h1>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Local-First • Privacy Focused • Interactive Notes</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />

            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-2xs transition"
              title="Import a shared PDFNoter study package (.pdfnoter)"
            >
              <Package className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="hidden sm:inline">Import Study File</span>
              <span className="sm:hidden">Import</span>
            </button>

            <button
              onClick={() => setIsBackupOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-2xs transition"
            >
              <Database className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
              <span>Backup & Restore</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg shadow-xs shadow-indigo-200 dark:shadow-none transition"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Open PDF</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-8">
        {errorMessage && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <div className="flex-1">
              <p className="font-semibold mb-0.5">Could not open PDF</p>
              <p>{errorMessage}</p>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-800">
              ✕
            </button>
          </div>
        )}

        {/* Drag & Drop Hero Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 scale-[1.01]'
              : 'border-neutral-300/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-neutral-50/40 dark:hover:bg-neutral-800/40 shadow-xs'
          }`}
        >
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
            <FileUp className="w-7 h-7" />
          </div>
          <h2 className="text-base font-semibold text-neutral-800 dark:text-neutral-100 mb-1">
            {isProcessing ? 'Verifying document fingerprint...' : 'Choose a PDF or drag and drop it here'}
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-md mx-auto mb-4">
            PDFs remain directly on your device. We compute a SHA-256 fingerprint to associate your notes and reading progress automatically.
          </p>
          <button
            type="button"
            disabled={isProcessing}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 dark:bg-neutral-100 hover:bg-neutral-800 dark:hover:bg-white text-white dark:text-neutral-900 text-xs font-medium rounded-lg transition"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Select PDF File</span>
          </button>
        </div>

        {/* Storage Persistence Advisory */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 bg-neutral-100/70 dark:bg-neutral-900/70 border border-neutral-200/70 dark:border-neutral-800 rounded-xl text-xs text-neutral-600 dark:text-neutral-300 gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              {isStoragePersisted
                ? 'Persistent storage active: Browser will not evict notes.'
                : 'Browser data notice: Clearing cookies & history can delete local notes. Enable persistent storage or export backups.'}
            </span>
          </div>
          {!isStoragePersisted && (
            <button
              onClick={handleRequestStorage}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 underline shrink-0"
            >
              Request Persistence
            </button>
          )}
        </div>

        {/* Recently Opened Documents Section */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">Recent Documents</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Previously annotated PDFs</p>
            </div>

            {documents.length > 0 && (
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter documents..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
              </div>
            )}
          </div>

          {documents.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/70 dark:border-neutral-800 p-6">
              <BookOpen className="w-10 h-10 text-neutral-300 dark:text-neutral-700 mx-auto mb-3 stroke-1" />
              <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 mb-1">No documents opened yet</h4>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 max-w-sm mx-auto">
                Select your first study PDF above. Add page notes or highlight text, and your explanations stay hidden until you click them.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocs.map((doc) => {
                const noteCount = docNotesCount[doc.id] || 0;
                const formattedDate = new Date(doc.lastOpenedAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });

                return (
                  <div
                    key={doc.id}
                    className="group bg-white dark:bg-neutral-900/90 rounded-xl border border-neutral-200/80 dark:border-neutral-800 hover:border-indigo-400/80 dark:hover:border-indigo-500 p-4 shadow-2xs hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate" title={doc.fileName}>
                            {doc.fileName}
                          </span>
                        </div>
                        <button
                          onClick={(e) => handleDeleteDocument(doc.id, e)}
                          className="p-1 text-neutral-400 hover:text-rose-600 rounded transition opacity-0 group-hover:opacity-100"
                          title="Remove document and notes"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-neutral-500 dark:text-neutral-400 mb-4">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-neutral-400 dark:text-neutral-500" />
                          {formattedDate}
                        </span>
                        {doc.pageCount > 0 && <span>• {doc.pageCount} pages</span>}
                        <span>• {noteCount} note{noteCount === 1 ? '' : 's'}</span>
                      </div>
                    </div>

                    {/* Action: Re-locate file */}
                    <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
                      <span className="text-[10px] text-neutral-400">
                        Local file selection required
                      </span>
                      <button
                        onClick={() => {
                          setTargetReopenDoc(doc);
                          reopenInputRef.current?.click();
                        }}
                        className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        <span>Reopen PDF</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Backup & Restore Modal */}
      <BackupModal
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
        onDataRestored={loadDocuments}
      />

      {/* Import Study File Modal */}
      <ExportShareModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        defaultTab="import"
        onImportSuccess={(file, docRecord) => {
          loadDocuments();
          onOpenDocument(file, docRecord);
        }}
      />
    </div>
  );
}
