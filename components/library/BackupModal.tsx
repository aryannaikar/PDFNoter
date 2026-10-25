'use client';

import React, { useState } from 'react';
import { X, Download, Upload, AlertTriangle, CheckCircle, Database, Loader2 } from 'lucide-react';
import { storageService } from '@/services/storage/dexieStorageService';
import type { BackupData } from '@/types';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataRestored: () => void;
}

export function BackupModal({ isOpen, onClose, onDataRestored }: BackupModalProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [parsedBackup, setParsedBackup] = useState<BackupData | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  if (!isOpen) return null;

  // Handle Export
  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await storageService.exportBackup();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pdf_study_notes_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setSuccess('Backup exported successfully! Keep this JSON file safe.');
    } catch (err: any) {
      setError(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Handle file selection for import
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(null);
    setImportSummary(null);
    setParsedBackup(null);

    if (file.size > 20 * 1024 * 1024) {
      setError('File is too large (maximum 20MB allowed)');
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid JSON file');
      }
      if (parsed.schemaVersion !== 1) {
        throw new Error(`Unsupported schema version (${parsed.schemaVersion || 'unknown'}). Supported: 1`);
      }
      if (!Array.isArray(parsed.documents) || !Array.isArray(parsed.notes) || !Array.isArray(parsed.annotations)) {
        throw new Error('Malformed backup: documents, notes, and annotations must be arrays');
      }

      setParsedBackup(parsed);
      setImportSummary(
        `Found ${parsed.documents.length} document(s), ${parsed.notes.length} note(s), ${parsed.annotations.length} annotation(s), and ${parsed.bookmarks?.length || 0} bookmark(s).`
      );
    } catch (err: any) {
      setError(`Failed to read backup file: ${err.message}`);
    }
  };

  // Apply import
  const handleApplyImport = async () => {
    if (!parsedBackup) return;

    if (importMode === 'replace') {
      const confirmed = window.confirm(
        'WARNING: "Replace All" will overwrite all your current notes, bookmarks, and documents with this backup. Continue?'
      );
      if (!confirmed) return;
    }

    setIsImporting(true);
    setError(null);
    try {
      const res = await storageService.importBackup(parsedBackup, importMode);
      setSuccess(
        `Successfully restored ${res.importedDocs} documents, ${res.importedNotes} notes, ${res.importedAnnotations} annotations, and ${res.importedBookmarks} bookmarks!`
      );
      setParsedBackup(null);
      onDataRestored();
    } catch (err: any) {
      setError(`Import failed: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="backup-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 bg-neutral-50/70">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600" />
            <h2 id="backup-modal-title" className="text-base font-semibold text-neutral-800">
              Backup & Restore
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/50 rounded-lg transition"
            aria-label="Close backup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="flex items-start gap-2 p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2 p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* Privacy & Storage Explainer */}
          <div className="p-3.5 bg-neutral-50 border border-neutral-200/70 rounded-xl text-xs text-neutral-600 leading-relaxed">
            <p className="font-semibold text-neutral-800 mb-1">Local-First Storage Guarantee</p>
            <p>
              Your PDF notes, highlights, and bookmarks are kept 100% locally inside your browser's IndexedDB. Clearing browser site data will erase this database. Use the <strong>Export Backup</strong> feature to save your notes to a secure JSON file.
            </p>
          </div>

          {/* Export Section */}
          <div className="border border-neutral-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-neutral-800">Export All Notes</h3>
                <p className="text-xs text-neutral-500">Download a versioned JSON backup of all metadata, notes, and annotations.</p>
              </div>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium rounded-lg shadow-xs transition shrink-0"
              >
                {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>Export JSON</span>
              </button>
            </div>
          </div>

          {/* Import Section */}
          <div className="border border-neutral-200 rounded-xl p-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-neutral-800">Restore from Backup</h3>
              <p className="text-xs text-neutral-500">Select a previously exported JSON backup file.</p>
            </div>

            <input
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="block w-full text-xs text-neutral-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
            />

            {parsedBackup && (
              <div className="mt-3 p-3 bg-indigo-50/60 border border-indigo-100 rounded-lg space-y-3">
                <p className="text-xs text-indigo-900 font-medium">{importSummary}</p>

                {/* Import Mode Radio */}
                <div className="space-y-1.5">
                  <span className="block text-[11px] font-semibold text-neutral-700 uppercase tracking-wider">
                    Import Strategy
                  </span>
                  <div className="flex gap-4 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'merge'}
                        onChange={() => setImportMode('merge')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Merge (Deduplicate & Add)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-rose-700">
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                        className="text-rose-600 focus:ring-rose-500"
                      />
                      <span>Replace All</span>
                    </label>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleApplyImport}
                    disabled={isImporting}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg shadow-xs transition"
                  >
                    {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    <span>Confirm & Restore</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
