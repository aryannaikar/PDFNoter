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
  Link2,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
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
  defaultTab?: 'sharelink' | 'standard' | 'studyfile' | 'import';
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
  defaultTab = 'sharelink',
}: ExportShareModalProps) {
  const [activeTab, setActiveTab] = useState<'sharelink' | 'standard' | 'studyfile' | 'import'>(defaultTab);

  // Web Share Link state
  const [generatedShareLink, setGeneratedShareLink] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Standard PDF options
  const [includeHighlights, setIncludeHighlights] = useState(true);
  const [includePageMarkers, setIncludePageMarkers] = useState(true);
  const [appendNotesPages, setAppendNotesPages] = useState(true);

  // Study File / Share link options
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

  // --- 1. Generate Web Share Link (Editable) ---
  const handleGenerateShareLink = async () => {
    if (!pdfFile || !documentRecord) {
      setStatusMessage({ type: 'error', text: 'Document record is missing.' });
      return;
    }

    setIsProcessing(true);
    setStatusMessage(null);
    setProgressPercent(15);
    setProgressMessage('Bundling PDF and interactive notes...');

    try {
      const buffer = await pdfFile.arrayBuffer();

      const blob = await exportStudyFile(
        buffer,
        documentRecord,
        includeNotes ? notes : [],
        includeAnnotations ? annotations : [],
        includeBookmarks ? bookmarks : [],
        readingProgress,
        {
          includeOriginalPdf: true,
          includeNotes,
          includeAnnotations,
          includeBookmarks,
          includeReadingProgress: true,
        },
        (percent, message) => {
          setProgressPercent(Math.round(percent * 0.45));
          setProgressMessage(message);
        }
      );

      setProgressPercent(50);
      setProgressMessage('Uploading study package to cloud storage...');

      const formData = new FormData();
      const fileName = `${documentRecord.fileName.replace(/\.pdf$/i, '')}.pdfnoter`;
      formData.append('file', blob, fileName);

      const res = await fetch('/api/share/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to upload shared document');
      }

      const data = await res.json();
      if (!data.downloadUrl) {
        throw new Error('No download URL returned from cloud upload');
      }

      setProgressPercent(100);
      setProgressMessage('Shareable link ready!');

      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const shareUrl = `${origin}/share?src=${encodeURIComponent(data.downloadUrl)}&name=${encodeURIComponent(documentRecord.fileName)}`;

      setGeneratedShareLink(shareUrl);
      setStatusMessage({
        type: 'success',
        text: 'Shareable link created! Anyone with this link can view and edit the PDF with all your notes.',
      });
    } catch (err: any) {
      console.error('Share link generation error:', err);
      setStatusMessage({ type: 'error', text: `Failed to create share link: ${err.message || 'Unknown error'}` });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyLink = () => {
    if (!generatedShareLink) return;
    navigator.clipboard.writeText(generatedShareLink);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  // --- 2. Export as Standard PDF ---
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
        text: 'Standard PDF exported successfully with embedded study notes and diagrams!',
      });
    } catch (err: any) {
      console.error('Export standard PDF error:', err);
      setStatusMessage({ type: 'error', text: `Export failed: ${err.message || 'Unknown error'}` });
    } finally {
      setIsProcessing(false);
    }
  };

  // --- 3. Export as PDFNoter Study File ---
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

  // --- 4. Import PDFNoter Study File ---
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col max-h-[92vh] transition-colors"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-share-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/80">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h2 id="export-share-title" className="text-base font-bold text-neutral-800 dark:text-neutral-100">
                Export & Share
              </h2>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate max-w-sm">
                {documentRecord ? documentRecord.fileName : 'Study Session Exchange'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-200/50 dark:hover:bg-neutral-800 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800 px-4 bg-neutral-50/40 dark:bg-neutral-900/40 text-xs font-medium overflow-x-auto">
          {/* TAB 1: Share Link */}
          <button
            onClick={() => {
              setActiveTab('sharelink');
              setStatusMessage(null);
            }}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 shrink-0 transition cursor-pointer ${
              activeTab === 'sharelink'
                ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Share Link (Editable)</span>
            <span className="px-1 py-0.2 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded text-[9px] font-bold">
              NEW
            </span>
          </button>

          {/* TAB 2: Standard PDF */}
          <button
            onClick={() => {
              setActiveTab('standard');
              setStatusMessage(null);
            }}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 shrink-0 transition cursor-pointer ${
              activeTab === 'standard'
                ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Standard PDF</span>
          </button>

          {/* TAB 3: Study File */}
          <button
            onClick={() => {
              setActiveTab('studyfile');
              setStatusMessage(null);
            }}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 shrink-0 transition cursor-pointer ${
              activeTab === 'studyfile'
                ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>.pdfnoter File</span>
          </button>

          {/* TAB 4: Import */}
          <button
            onClick={() => {
              setActiveTab('import');
              setStatusMessage(null);
            }}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 shrink-0 transition cursor-pointer ${
              activeTab === 'import'
                ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Status Alert */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2.5 animate-in fade-in ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 leading-relaxed">{statusMessage.text}</div>
            </div>
          )}

          {/* Progress Bar when processing */}
          {isProcessing && (
            <div className="p-3 bg-indigo-50/80 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 rounded-xl space-y-1.5 animate-in fade-in">
              <div className="flex items-center justify-between text-xs font-medium text-indigo-900 dark:text-indigo-200">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
                  {progressMessage || 'Processing...'}
                </span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full bg-indigo-200/50 dark:bg-indigo-900/50 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-indigo-600 dark:bg-indigo-500 h-full transition-all duration-300"
                  style={{ width: `${Math.max(5, progressPercent)}%` }}
                />
              </div>
            </div>
          )}

          {/* TAB 1: Share Link (Interactive & Editable) */}
          {activeTab === 'sharelink' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-3 bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-xl text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <span>
                  Creates a <strong>direct web link</strong> containing this PDF and all your notes. Anyone who opens the link will view the document with your notes and can <strong>edit, add new notes, or attach pictures directly in their browser</strong>.
                </span>
              </div>

              {/* Share Options */}
              <div className="space-y-2.5 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 bg-white dark:bg-neutral-850">
                <h3 className="text-xs font-semibold text-neutral-800 dark:text-neutral-100 uppercase tracking-wider">
                  Included Study Elements
                </h3>

                <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeNotes}
                    onChange={(e) => setIncludeNotes(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span>Page notes & attached pictures ({notes.length} total)</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAnnotations}
                    onChange={(e) => setIncludeAnnotations(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span>Text highlights & inline notes ({annotations.length} total)</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeBookmarks}
                    onChange={(e) => setIncludeBookmarks(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span>Page bookmarks ({bookmarks.length} total)</span>
                </label>
              </div>

              {/* Generated Link Display */}
              {generatedShareLink ? (
                <div className="space-y-3 p-4 bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Your Share Link is Ready!</span>
                    </span>
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-400">Zero setup required</span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedShareLink}
                      className="flex-1 px-3 py-2 text-xs bg-white dark:bg-neutral-900 border border-emerald-300 dark:border-emerald-700 rounded-lg text-neutral-900 dark:text-neutral-100 font-mono select-all focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className={`px-3 py-2 text-xs font-medium rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
                        isCopied
                          ? 'bg-emerald-600 text-white'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{isCopied ? 'Copied!' : 'Copy Link'}</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <a
                      href={generatedShareLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                    >
                      <span>Open link in new tab to test</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      type="button"
                      onClick={handleGenerateShareLink}
                      disabled={isProcessing}
                      className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 underline cursor-pointer"
                    >
                      Update / Regenerate Link
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerateShareLink}
                  disabled={isProcessing}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Link2 className="w-4 h-4" />
                  )}
                  <span>{isProcessing ? 'Generating Share Link...' : 'Generate Shareable Web Link'}</span>
                </button>
              )}
            </div>
          )}

          {/* TAB 2: Standard PDF */}
          {activeTab === 'standard' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-3 bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-xl text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed">
                <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <span>
                  Generates an independent, standalone PDF with embedded visual highlights and an optional study notes appendix. It can be opened in <strong>any standard PDF viewer</strong> (Acrobat, Apple Books, Chrome, mobile readers).
                </span>
              </div>

              <div className="space-y-2.5 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 bg-white dark:bg-neutral-850">
                <h3 className="text-xs font-semibold text-neutral-800 dark:text-neutral-100 uppercase tracking-wider">
                  Export Options
                </h3>

                <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeHighlights}
                    onChange={(e) => setIncludeHighlights(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span>Embed text highlights directly onto document pages</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includePageMarkers}
                    onChange={(e) => setIncludePageMarkers(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span>Draw subtle page note indicators in margin</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={appendNotesPages}
                    onChange={(e) => setAppendNotesPages(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span>Append study notes & diagram summary pages at the end of the PDF</span>
                </label>
              </div>

              <button
                type="button"
                onClick={handleExportStandardPdf}
                disabled={isProcessing}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>Export Standard PDF</span>
              </button>
            </div>
          )}

          {/* TAB 3: Study File (.pdfnoter) */}
          {activeTab === 'studyfile' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-3 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                <Package className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <span>
                  The <strong>.pdfnoter package</strong> is a standalone bundle holding the PDF and all your hidden notes, attached pictures, highlights, and bookmarks. Anyone can import it back into PDFNoter with zero loss.
                </span>
              </div>

              <div className="space-y-2.5 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 bg-white dark:bg-neutral-850">
                <h3 className="text-xs font-semibold text-neutral-800 dark:text-neutral-100 uppercase tracking-wider">
                  Bundle Contents
                </h3>

                <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeOriginalPdf}
                    onChange={(e) => setIncludeOriginalPdf(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span>Include original PDF document</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeNotes}
                    onChange={(e) => setIncludeNotes(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span>Include page notes ({notes.length} total)</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAnnotations}
                    onChange={(e) => setIncludeAnnotations(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span>Include text annotations ({annotations.length} total)</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeBookmarks}
                    onChange={(e) => setIncludeBookmarks(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span>Include bookmarks ({bookmarks.length} total)</span>
                </label>
              </div>

              <button
                type="button"
                onClick={handleExportStudyFile}
                disabled={isProcessing}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>Download .pdfnoter Package</span>
              </button>
            </div>
          )}

          {/* TAB 4: Import Study File */}
          {activeTab === 'import' && (
            <div className="space-y-4">
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
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                    isDraggingImport
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30'
                      : 'border-neutral-300 dark:border-neutral-700 hover:border-indigo-400 dark:hover:border-indigo-500 bg-neutral-50/50 dark:bg-neutral-850/50'
                  }`}
                >
                  <FileUp className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-100">
                    Click to select or drag and drop a .pdfnoter package
                  </p>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                    Restores the document and all associated notes, attached pictures & highlights
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                        {importValidation.manifest?.documentFileName}
                      </h4>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        {importValidation.manifest?.exportedAt ? `Exported on ${new Date(importValidation.manifest.exportedAt).toLocaleDateString()}` : 'Ready to import'}
                      </p>
                    </div>
                    <button
                      onClick={() => setImportValidation(null)}
                      className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 underline cursor-pointer"
                    >
                      Choose Different File
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 bg-white dark:bg-neutral-800 rounded-lg border border-indigo-100 dark:border-indigo-900/60">
                      <div className="font-bold text-indigo-900 dark:text-indigo-200">{importValidation.notes?.length || 0}</div>
                      <div className="text-[10px] text-neutral-500 dark:text-neutral-400">Page Notes</div>
                    </div>
                    <div className="p-2 bg-white dark:bg-neutral-800 rounded-lg border border-indigo-100 dark:border-indigo-900/60">
                      <div className="font-bold text-indigo-900 dark:text-indigo-200">{importValidation.annotations?.length || 0}</div>
                      <div className="text-[10px] text-neutral-500 dark:text-neutral-400">Highlights</div>
                    </div>
                    <div className="p-2 bg-white dark:bg-neutral-800 rounded-lg border border-indigo-100 dark:border-indigo-900/60">
                      <div className="font-bold text-indigo-900 dark:text-indigo-200">{importValidation.bookmarks?.length || 0}</div>
                      <div className="text-[10px] text-neutral-500 dark:text-neutral-400">Bookmarks</div>
                    </div>
                  </div>

                  {/* Conflict Strategy */}
                  <div className="pt-2 border-t border-indigo-200/60 dark:border-indigo-850">
                    <span className="block text-[11px] font-semibold text-indigo-950 dark:text-indigo-200 mb-1.5">
                      Import Mode
                    </span>
                    <div className="flex gap-4 text-xs text-neutral-700 dark:text-neutral-300">
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
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg shadow-xs transition disabled:opacity-50 cursor-pointer"
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
