'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ExternalLink,
  AlertCircle,
  Save,
  Image as ImageIcon,
  UploadCloud,
  Trash2,
  ZoomIn,
  Link as LinkIcon,
  Loader2,
} from 'lucide-react';
import { isValidUrl } from '@/lib/utils/url';
import { compressAndProcessImage, sanitizeImageUrl, isValidImageUrl } from '@/lib/utils/image';

export interface NoteEditorData {
  title?: string;
  content: string;
  sourceUrl?: string;
  imageUrl?: string;
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
  const [imageUrl, setImageUrl] = useState<string | undefined>(initialData?.imageUrl);
  const [imageInputMode, setImageInputMode] = useState<'upload' | 'url'>('upload');
  const [urlInputValue, setUrlInputValue] = useState('');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file (PNG, JPEG, WebP, GIF, SVG).');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('Image file is too large. Please select an image under 20MB.');
      return;
    }

    setError(null);
    setIsProcessingImage(true);
    try {
      const compressedDataUrl = await compressAndProcessImage(file);
      setImageUrl(compressedDataUrl);
    } catch (err: any) {
      setError(`Failed to process image: ${err.message || 'Image encoding failed'}`);
    } finally {
      setIsProcessingImage(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setTitle(initialData?.title || '');
      setContent(initialData?.content || '');
      setSourceUrl(initialData?.sourceUrl || '');
      setImageUrl(initialData?.imageUrl);
      setUrlInputValue(initialData?.imageUrl && !initialData.imageUrl.startsWith('data:') ? initialData.imageUrl : '');
      setImageInputMode('upload');
      setError(null);
      setShowUnsavedWarning(false);
    }
  }, [isOpen, initialData]);

  // Handle clipboard paste of image anywhere in modal
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            await processImageFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  if (!isOpen) return null;

  const hasChanges =
    content !== (initialData?.content || '') ||
    title !== (initialData?.title || '') ||
    sourceUrl !== (initialData?.sourceUrl || '') ||
    (imageUrl || undefined) !== (initialData?.imageUrl || undefined);

  const handleClose = () => {
    if (hasChanges && !showUnsavedWarning) {
      setShowUnsavedWarning(true);
      return;
    }
    onCancel();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processImageFile(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      await processImageFile(file);
    }
  };

  const handleApplyUrlImage = () => {
    if (!urlInputValue.trim()) {
      setImageUrl(undefined);
      return;
    }
    if (!isValidImageUrl(urlInputValue)) {
      setError('Please enter a valid HTTP/HTTPS image URL.');
      return;
    }
    const safe = sanitizeImageUrl(urlInputValue);
    if (!safe) {
      setError('Invalid or disallowed image URL format.');
      return;
    }
    setImageUrl(safe);
    setError(null);
  };

  const handleRemoveImage = () => {
    setImageUrl(undefined);
    setUrlInputValue('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
        imageUrl: imageUrl || undefined,
        selectedText: initialData?.selectedText,
      });
    } catch (err: any) {
      setError(`Failed to save note: ${err.message || 'Storage error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col max-h-[92vh] transition-colors"
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
            className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 rounded-lg transition cursor-pointer"
            aria-label="Close note editor"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected text quote if annotation */}
        {initialData?.selectedText && (
          <div className="px-5 pt-3 pb-1">
            <div className="p-2.5 bg-amber-50/80 dark:bg-amber-950/40 border-l-3 border-amber-400 dark:border-amber-600 rounded text-xs text-amber-950 dark:text-amber-200 italic line-clamp-3 font-serif">
              "{initialData.selectedText}"
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto flex-1">
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
                  className="px-2 py-1 bg-amber-200/80 hover:bg-amber-300 text-amber-900 rounded font-medium cursor-pointer"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={() => setShowUnsavedWarning(false)}
                  className="px-2 py-1 bg-white dark:bg-neutral-800 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 rounded cursor-pointer"
                >
                  Keep Editing
                </button>
              </div>
            </div>
          )}

          {/* Title */}
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

          {/* Content */}
          <div>
            <label htmlFor="note-content" className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Explanation & Notes <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="note-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your explanation, summary, or study thoughts here..."
              rows={4}
              required
              className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition resize-y font-sans leading-relaxed"
            />
          </div>

          {/* Picture / Image Attachment Section */}
          <div className="space-y-2 pt-1 border-t border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
                <span>Attach Picture / Diagram</span>
                <span className="text-neutral-400 dark:text-neutral-500 font-normal">(optional)</span>
              </label>

              {!imageUrl && (
                <div className="flex items-center text-[11px] gap-2">
                  <button
                    type="button"
                    onClick={() => setImageInputMode('upload')}
                    className={`transition font-medium ${
                      imageInputMode === 'upload'
                        ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                        : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
                    }`}
                  >
                    Upload File
                  </button>
                  <span className="text-neutral-300 dark:text-neutral-700">•</span>
                  <button
                    type="button"
                    onClick={() => setImageInputMode('url')}
                    className={`transition font-medium ${
                      imageInputMode === 'url'
                        ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                        : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
                    }`}
                  >
                    Image URL
                  </button>
                </div>
              )}
            </div>

            {/* Hidden native file input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* If an image is currently attached */}
            {imageUrl ? (
              <div className="p-3 bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 rounded-lg space-y-2.5 animate-in fade-in duration-150">
                <div className="relative group rounded-md overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900 max-h-56 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="Attached note diagram"
                    className="object-contain max-h-52 w-auto max-w-full rounded"
                  />
                  {/* Hover action overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setLightboxOpen(true)}
                      className="p-1.5 bg-white/90 hover:bg-white text-neutral-800 rounded-md shadow-xs text-xs flex items-center gap-1 font-medium transition cursor-pointer"
                      title="View full image"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-1.5 bg-white/90 hover:bg-white text-neutral-800 rounded-md shadow-xs text-xs flex items-center gap-1 font-medium transition cursor-pointer"
                      title="Replace image"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Replace</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md shadow-xs text-xs flex items-center gap-1 font-medium transition cursor-pointer"
                      title="Remove image"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    ✓ Picture attached
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Change Picture
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : isProcessingImage ? (
              <div className="p-6 border-2 border-dashed border-indigo-300 dark:border-indigo-700 rounded-lg flex flex-col items-center justify-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-xs font-medium">Compressing & preparing image...</span>
              </div>
            ) : imageInputMode === 'upload' ? (
              /* Drag & Drop / Upload Box */
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(true);
                }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-4 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition ${
                  isDraggingOver
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30'
                    : 'border-neutral-300 dark:border-neutral-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-1.5">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
                  Click to upload or drag & drop a picture
                </p>
                <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                  PNG, JPG, WebP, GIF, or paste from clipboard (Ctrl+V)
                </p>
              </div>
            ) : (
              /* Image URL Box */
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={urlInputValue}
                    onChange={(e) => setUrlInputValue(e.target.value)}
                    placeholder="https://example.com/diagram.png"
                    className="w-full pl-8 pr-3 py-2 text-xs bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                  />
                  <LinkIcon className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 pointer-events-none" />
                </div>
                <button
                  type="button"
                  onClick={handleApplyUrlImage}
                  className="px-3 py-2 text-xs font-medium bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 rounded-lg border border-indigo-200 dark:border-indigo-800 transition cursor-pointer"
                >
                  Apply
                </button>
              </div>
            )}
          </div>

          {/* Research / Source URL */}
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
              className="px-4 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-800 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !content.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:pointer-events-none rounded-lg shadow-xs transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Note'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Lightbox Modal for enlarged view */}
      {lightboxOpen && imageUrl && (
        <div
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden flex flex-col items-center">
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/90 text-white rounded-full transition cursor-pointer"
              aria-label="Close enlarged picture"
            >
              <X className="w-5 h-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Enlarged note diagram"
              className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
