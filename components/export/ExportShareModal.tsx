'use client';

import React, { useState } from 'react';
import {
  X,
  Share2,
  FileText,
  Package,
  Upload,
  Download,
  CheckCircle,
  AlertCircle,
  Loader2,
  Info,
  ArrowRight,
  FileUp,
} from 'lucide-react';
import type {
  DocumentRecord,
  NoteRecord,
  AnnotationRecord,
  BookmarkRecord,
  ReadingProgressRecord,
} from '@/types';
import type { StudyFileValidationResult } from '@/types/studyFile';
import { exportAnnotatedStandardPdf } from '@/lib/export/pdfAnnotationExporter';
import { exportStudyFile, downloadBlob } from '@/lib/export/studyFileExporter';
import { validateStudyFile, commitStudyFileImport } from '@/lib/export/studyFileImporter';

interface ExportShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfFile?: File | null;
  documentRecord?: DocumentRecord | null;
  notes?: NoteRecord[];
  annotations?: AnnotationRecord[];
  bookmarks?: BookmarkRecord[];
  readingProgress?: ReadingProgressRecord;
  onImportSuccess?: (file: File, docRecord: DocumentRecord) => void;
  defaultTab?: 'standard' | 'studyfile' | 'import';
}

export function ExportShareModal({
  isOpen,
  onClose,
  pdfFile,
  documentRecord,
  notes = [],
  annotations = [],
  bookmarks = [],
  readingProgress,
  onImportSuccess,
  defaultTab = 'standard',
}: ExportShareModalProps) {
  const [activeTab, setActiveTab] = useState<'standard' | 'studyfile' | 'import'>(defaultTab);

  // Standard PDF options
  const [includeHighlights, setIncludeHighlights] = useState(true);
  const [includePageMarkers, setIncludePageMarkers] = useState(true);
  const [appendNotesPages, setAppendNotesPages] = useState(true);

  // Study File options
  const [includeOriginalPdf, setIncludeOriginalPdf] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeAnnotations, setIncludeAnnotations] = useState(true);
  const [includeBookmarks, setIncludeBookmarks] = useState(true);

  // Import state
  const [importValidation, setImportValidation] = useState<StudyFileValidationResult | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'new_copy'>('merge');
  const [isDraggingImport, setIsDraggingImport] = useState(false);

  // Status state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const baseFileName = documentRecord?.fileName.replace(/\.pdf$/i, '') || 'study_document';

  // --- 1. Export as Standard PDF ---
  const handleExportStandardPdf = async () => {
    if (!pdfFile) {
      setStatusMessage({ type: 'error', text: 'PDF file data is not loaded in memory.' });
      return;
    }

    setIsProcessing(true);
    setStatusMessage(null);
    setProgressPercent(10);
    setProgressMessage('Reading document...');

    try {
      const buffer = await pdfFile.arrayBuffer();

      const exportedBytes = await exportAnnotatedStandardPdf(
        buffer,
        notes,
        annotations,
        {
          includeHighlights,
          includePageMarkers,
          appendNotesPages,
          notesTitle: `${documentRecord?.fileName || 'Document'} - Study Notes`,
        },
        (percent, message) => {
          setProgressPercent(percent);
          setProgressMessage(message);
        }
      );

      const blob = new Blob([new Uint8Array(exportedBytes)], { type: 'application/pdf' });
      downloadBlob(blob, `${baseFileName}_annotated.pdf`);

      setStatusMessage({
        type: 'success',
        text: 'Standard PDF exported successfully with embedded study annotations!',
      });
    } catch (err: any) {
      console.error('Export standard PDF error:', err);
      setStatusMessage({ type: 'error', text: `Export failed: ${err.message || 'Unknown error'}` });
    } finally {
      setIsProcessing(false);
    }
  };

  // --- 2. Export as PDFNoter Study File ---
  const handleExportStudyFile = async () => {
    if (!pdfFile || !documentRecord) {
      setStatusMessage({ type: 'error', text: 'Document record is missing.' });
      return;
    }

    setIsProcessing(true);
    setStatusMessage(null);
    setProgressPercent(10);
    setProgressMessage('Packaging study session...');

    try {
      const buffer = await pdfFile.arrayBuffer();

      const blob = await exportStudyFile(
        buffer,
        documentRecord,
        notes,
        annotations,
        bookmarks,
        readingProgress,
        {
          includeOriginalPdf,
          includeNotes,
          includeAnnotations,
          includeBookmarks,
          includeReadingProgress: true,
        },
        (percent, message) => {
          setProgressPercent(percent);
          setProgressMessage(message);
        }
      );

      downloadBlob(blob, `${baseFileName}.pdfnoter`);

      setStatusMessage({
        type: 'success',
        text: 'Portable .pdfnoter file exported! You can share this file via email, Google Drive, WhatsApp, or USB.',
      });
    } catch (err: any) {
      console.error('Export study file error:', err);
      setStatusMessage({ type: 'error', text: `Export failed: ${err.message || 'Unknown error'}` });
    } finally {
      setIsProcessing(false);
    }
  };

  // --- 3. Import PDFNoter Study File ---
  const handleSelectImportFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdfnoter') && !file.name.toLowerCase().endsWith('.zip')) {
      setStatusMessage({
        type: 'error',
        text: 'Please select a valid .pdfnoter study package file.',
      });
      return;
    }

    setIsProcessing(true);
    setStatusMessage(null);
    setProgressMessage('Inspecting study package...');
    setProgressPercent(30);

    try {
      const result = await validateStudyFile(file);
      if (!result.valid) {
        setStatusMessage({ type: 'error', text: result.error || 'Invalid study file.' });
        setImportValidation(null);
      } else {
        setImportValidation(result);
        setStatusMessage(null);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Validation failed: ${err.message}` });
      setImportValidation(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCommitImport = async () => {
    if (!importValidation || !importValidation.valid) return;

    setIsProcessing(true);
    setStatusMessage(null);
    setProgressMessage('Restoring document and study notes...');
    setProgressPercent(50);

    try {
      const result = await commitStudyFileImport(importValidation, importMode);

      setStatusMessage({
        type: 'success',
        text: `Successfully imported "${result.documentRecord.fileName}" with ${result.importedNotes} notes and ${result.importedAnnotations} annotations!`,
      });

      if (onImportSuccess) {
        setTimeout(() => {
          onImportSuccess(result.file, result.documentRecord);
          onClose();
        }, 800);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Import failed: ${err.message}` });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[92vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-share-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 bg-neutral-50/80">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 id="export-share-title" className="text-base font-bold text-neutral-800">
                Export & Share
              </h2>
              <p className="text-[11px] text-neutral-500">
                {documentRecord ? documentRecord.fileName : 'Study Session Exchange'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/50 rounded-lg transition"
            aria-label="Close export dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-neutral-200 px-5 bg-neutral-50/40 text-xs font-medium">
          <button
            onClick={() => {
              setActiveTab('standard');
              setStatusMessage(null);
            }}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'standard'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Standard PDF</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('studyfile');
              setStatusMessage(null);
            }}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'studyfile'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>PDFNoter File (.pdfnoter)</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('import');
              setStatusMessage(null);
            }}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'import'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Study File</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Status Alert */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2.5 animate-in fade-in ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">{statusMessage.text}</div>
            </div>
          )}

          {/* Progress Bar when processing */}
          {isProcessing && (
            <div className="p-3 bg-indigo-50/80 border border-indigo-100 rounded-xl space-y-1.5 animate-in fade-in">
              <div className="flex items-center justify-between text-xs font-medium text-indigo-900">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                  {progressMessage || 'Processing...'}
                </span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full bg-indigo-200/50 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-indigo-600 h-full transition-all duration-300"
                  style={{ width: `${Math.max(5, progressPercent)}%` }}
                />
              </div>
            </div>
          )}

          {/* TAB 1: Standard PDF */}
          {activeTab === 'standard' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl text-xs text-indigo-900 leading-relaxed">
                <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  Generates an independent, standalone PDF with embedded visual highlights and an optional study notes appendix. It can be opened in <strong>any standard PDF viewer</strong> (Acrobat, Apple Books, Chrome, mobile readers).
                </span>
              </div>

              <div className="space-y-2.5 border border-neutral-200 rounded-xl p-4 bg-white">
                <h3 className="text-xs font-semibold text-neutral-800 uppercase tracking-wider">
                  Export Options
                </h3>

                <label className="flex items-center gap-2 text-xs text-neutral-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeHighlights}
                    onChange={(e) => setIncludeHighlights(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span>Embed text highlights directly onto document pages</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-neutral-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includePageMarkers}
                    onChange={(e) => setIncludePageMarkers(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span>Draw subtle page note indicators in margin</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-neutral-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={appendNotesPages}
                    onChange={(e) => setAppendNotesPages(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span>Append study notes summary pages at the end of the PDF</span>
                </label>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-[11px] text-neutral-400">
                  {notes.length} page notes • {annotations.length} highlights
                </span>
                <button
                  type="button"
                  onClick={handleExportStandardPdf}
                  disabled={isProcessing || !pdfFile}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg shadow-xs transition disabled:opacity-50"
                >
                  {isProcessing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>{isProcessing ? progressMessage || 'Exporting...' : 'Export Standard PDF'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: PDFNoter Study File (.pdfnoter) */}
          {activeTab === 'studyfile' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-3 bg-amber-50/70 border border-amber-200/70 rounded-xl text-xs text-amber-950 leading-relaxed">
                <Package className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Creates an all-in-one <strong>.pdfnoter</strong> study package containing the original PDF and your editable hidden study notes. When shared and opened in PDFNoter on another computer or phone, all interactive study notes are restored in their exact locations!
                </span>
              </div>

              <div className="space-y-2.5 border border-neutral-200 rounded-xl p-4 bg-white">
                <h3 className="text-xs font-semibold text-neutral-800 uppercase tracking-wider">
                  Package Contents
                </h3>

                <label className="flex items-center gap-2 text-xs text-neutral-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeOriginalPdf}
                    onChange={(e) => setIncludeOriginalPdf(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span>Include original PDF document (standalone file-sharing)</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-neutral-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeNotes}
                    onChange={(e) => setIncludeNotes(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span>Include page-specific study notes ({notes.length})</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-neutral-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAnnotations}
                    onChange={(e) => setIncludeAnnotations(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span>Include text highlights & annotations ({annotations.length})</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-neutral-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeBookmarks}
                    onChange={(e) => setIncludeBookmarks(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span>Include bookmarks & reading progress ({bookmarks.length})</span>
                </label>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-[11px] text-neutral-400">
                  Compressed ZIP package (.pdfnoter)
                </span>
                <button
                  type="button"
                  onClick={handleExportStudyFile}
                  disabled={isProcessing || !pdfFile}
                  className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium rounded-lg shadow-xs transition disabled:opacity-50"
                >
                  {isProcessing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>{isProcessing ? progressMessage || 'Packaging...' : 'Export .pdfnoter File'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: Import PDFNoter Study File */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              {/* Drag & Drop Zone */}
              {!importValidation ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingImport(true);
                  }}
                  onDragLeave={() => setIsDraggingImport(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingImport(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleSelectImportFile(file);
                  }}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition cursor-pointer ${
                    isDraggingImport
                      ? 'border-indigo-500 bg-indigo-50/60'
                      : 'border-neutral-300 hover:border-indigo-400 bg-neutral-50/50'
                  }`}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.pdfnoter,.zip';
                    input.onchange = (e: any) => {
                      const file = e.target.files?.[0];
                      if (file) handleSelectImportFile(file);
                    };
                    input.click();
                  }}
                >
                  <FileUp className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-neutral-800">
                    Select a .pdfnoter file or drop it here
                  </p>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    Opens an exported study session with all original notes & highlights
                  </p>
                </div>
              ) : (
                /* Inspection Summary Card */
                <div className="p-4 bg-indigo-50/70 border border-indigo-200/80 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-indigo-950">
                        {importValidation.manifest?.document.fileName}
                      </h4>
                      <p className="text-[11px] text-indigo-700">
                        Exported {new Date(importValidation.manifest?.exportedAt || '').toLocaleDateString()} • {importValidation.manifest?.document.pageCount} pages
                      </p>
                    </div>
                    <button
                      onClick={() => setImportValidation(null)}
                      className="text-xs text-neutral-500 hover:text-neutral-800 underline"
                    >
                      Choose Different File
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 bg-white rounded-lg border border-indigo-100">
                      <div className="font-bold text-indigo-900">{importValidation.notes?.length || 0}</div>
                      <div className="text-[10px] text-neutral-500">Page Notes</div>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-indigo-100">
                      <div className="font-bold text-indigo-900">{importValidation.annotations?.length || 0}</div>
                      <div className="text-[10px] text-neutral-500">Highlights</div>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-indigo-100">
                      <div className="font-bold text-indigo-900">{importValidation.bookmarks?.length || 0}</div>
                      <div className="text-[10px] text-neutral-500">Bookmarks</div>
                    </div>
                  </div>

                  {/* Conflict Strategy */}
                  <div className="pt-2 border-t border-indigo-200/60">
                    <span className="block text-[11px] font-semibold text-indigo-950 mb-1.5">
                      Import Mode
                    </span>
                    <div className="flex gap-4 text-xs text-neutral-700">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="studyImportMode"
                          checked={importMode === 'merge'}
                          onChange={() => setImportMode('merge')}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Merge (Combine & Deduplicate)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="studyImportMode"
                          checked={importMode === 'new_copy'}
                          onChange={() => setImportMode('new_copy')}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Import as Separate Copy</span>
                      </label>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleCommitImport}
                      disabled={isProcessing}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg shadow-xs transition disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ArrowRight className="w-3.5 h-3.5" />
                      )}
                      <span>{isProcessing ? progressMessage || 'Importing...' : 'Restore & Open Document'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
