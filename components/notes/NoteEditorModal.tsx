'use client';

import React, { useState, useEffect } from 'react';
import { X, ExternalLink, AlertCircle, Save } from 'lucide-react';
import { isValidUrl } from '@/lib/utils/url';

export interface NoteEditorData {
  title?: string;
  content: string;
  sourceUrl?: string;
  selectedText?: string; // if text-linked annotation
}

interface NoteEditorModalProps {
  isOpen: boolean;
  initialData?: NoteEditorData;
  pageNumber: number;
  isAnnotation?: boolean;
  onSave: (data: NoteEditorData) => Promise<void>;
  onCancel: () => void;
}

export function NoteEditorModal({
  isOpen,
  initialData,
  pageNumber,
  isAnnotation = false,
  onSave,
  onCancel,
}: NoteEditorModalProps) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [content, setContent] = useState(initialData?.content || '');
  const [sourceUrl, setSourceUrl] = useState(initialData?.sourceUrl || '');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle(initialData?.title || '');
      setContent(initialData?.content || '');
      setSourceUrl(initialData?.sourceUrl || '');
      setError(null);
      setShowUnsavedWarning(false);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const hasChanges =
    (content !== (initialData?.content || '')) ||
    (title !== (initialData?.title || '')) ||
    (sourceUrl !== (initialData?.sourceUrl || ''));

  const handleClose = () => {
    if (hasChanges && !showUnsavedWarning) {
      setShowUnsavedWarning(true);
      return;
    }
    onCancel();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('Note explanation or body cannot be empty.');
      return;
    }

    if (sourceUrl.trim() && !isValidUrl(sourceUrl)) {
      setError('Please provide a valid research URL (e.g. https://en.wikipedia.org/... or domain.com).');
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      await onSave({
        title: title.trim() || undefined,
        content: content.trim(),
        sourceUrl: sourceUrl.trim() || undefined,
        selectedText: initialData?.selectedText,
      });
    } catch (err: any) {
      setError(`Failed to save note: ${err.message || 'Storage error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col max-h-[92vh] overflow-y-auto transition-colors"
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/80">
          <div>
            <h2 id="note-modal-title" className="text-base font-semibold text-neutral-800 dark:text-neutral-100">
              {initialData?.content ? 'Edit Note' : (isAnnotation ? 'Add Text Note' : 'Add Page Note')}
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Page {pageNumber} {isAnnotation ? '• Linked to selected text' : ''}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 rounded-lg transition"
            aria-label="Close note editor"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected text quote if annotation */}
        {initialData?.selectedText && (
          <div className="px-5 pt-3 pb-1">
            <div className="p-2.5 bg-amber-50/80 dark:bg-amber-950/40 border-l-3 border-amber-400 dark:border-amber-600 rounded text-xs text-amber-950 dark:text-amber-200 italic line-clamp-3">
              "{initialData.selectedText}"
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {showUnsavedWarning && (
            <div className="p-3 text-xs bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 rounded-lg flex items-center justify-between">
              <span>You have unsaved changes. Discard them?</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-2 py-1 bg-amber-200/80 hover:bg-amber-300 text-amber-900 rounded font-medium"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={() => setShowUnsavedWarning(false)}
                  className="px-2 py-1 bg-white dark:bg-neutral-800 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 rounded"
                >
                  Keep Editing
                </button>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="note-title" className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Title <span className="text-neutral-400 dark:text-neutral-500 font-normal">(optional)</span>
            </label>
            <input
              id="note-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Formula derivation, Key definition"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              maxLength={150}
            />
          </div>

          <div>
            <label htmlFor="note-content" className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Explanation & Notes <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="note-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your explanation, summary, or revision thoughts here..."
              rows={4}
              required
              className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition resize-y font-sans leading-relaxed"
            />
          </div>

          <div>
            <label htmlFor="note-source-url" className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Research / Source URL <span className="text-neutral-400 dark:text-neutral-500 font-normal">(optional reference)</span>
            </label>
            <div className="relative">
              <input
                id="note-source-url"
                type="text"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://..."
                className="w-full pl-3 pr-8 py-2 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
              <ExternalLink className="absolute right-2.5 top-2.5 w-4 h-4 text-neutral-400 dark:text-neutral-500 pointer-events-none" />
            </div>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-800 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !content.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:pointer-events-none rounded-lg shadow-xs transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Note'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
