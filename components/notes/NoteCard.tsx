'use client';

import React from 'react';
import { X, ExternalLink, Edit3, Trash2, Calendar, StickyNote, AlertTriangle } from 'lucide-react';
import type { NoteRecord, AnnotationRecord } from '@/types';
import { sanitizeUrl } from '@/lib/utils/url';

interface NoteCardProps {
  item: NoteRecord | AnnotationRecord;
  isAnnotation?: boolean;
  anchorWarning?: string;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function NoteCard({
  item,
  isAnnotation = false,
  anchorWarning,
  onEdit,
  onDelete,
  onClose,
}: NoteCardProps) {
  const isAnn = isAnnotation || 'anchor' in item;
  const title = isAnn ? (item as AnnotationRecord).noteTitle : (item as NoteRecord).title;
  const content = isAnn ? (item as AnnotationRecord).noteContent : (item as NoteRecord).content;
  const selectedText = isAnn ? (item as AnnotationRecord).selectedText : undefined;
  const sourceUrl = item.sourceUrl ? sanitizeUrl(item.sourceUrl) : '';
  const dateFormatted = new Date(item.updatedAt || item.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      style={{
        backgroundColor: 'var(--sticky-bg, #ffffff)',
        color: 'var(--sticky-text, #000000)',
        borderColor: 'var(--sticky-border, #d1d5db)',
        opacity: 1,
      }}
      className="sticky-note-card w-80 max-w-[90vw] rounded-xl shadow-2xl shadow-black/40 border overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150 transition-all"
      role="region"
      aria-label="Sticky note details"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Header */}
      <div
        style={{
          backgroundColor: 'var(--sticky-header, #f8fafc)',
          color: 'var(--sticky-text, #000000)',
          borderColor: 'var(--sticky-border, #d1d5db)',
          opacity: 1,
        }}
        className="sticky-note-header border-b pt-2 pb-2 px-3 flex flex-col items-center"
      >
        {/* Subtle pill */}
        <div className="h-1 w-12 bg-neutral-400 dark:bg-neutral-600 rounded-full mb-1.5" />

        <div className="w-full flex items-center justify-between text-xs font-bold text-neutral-900 dark:text-neutral-100">
          <div className="flex items-center gap-1.5 truncate">
            <div className="w-5 h-5 rounded-md bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <StickyNote className="w-3.5 h-3.5 fill-amber-300 dark:fill-amber-400/40" />
            </div>
            <span className="truncate">{title || (isAnn ? 'Text Annotation' : `Page ${item.pageNumber} Note`)}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition cursor-pointer"
            aria-label="Close sticky note"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Anchor warning if text moved */}
      {anchorWarning && (
        <div className="flex items-start gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-xs text-amber-950 dark:text-amber-200">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <span>{anchorWarning}</span>
        </div>
      )}

      {/* Quote if annotation */}
      {selectedText && (
        <div className="px-3 pt-2.5">
          <div className="px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/40 border-l-3 border-amber-400 dark:border-amber-500 rounded-r-md text-xs text-amber-950 dark:text-amber-200 italic font-serif whitespace-pre-wrap break-words leading-relaxed">
            "{selectedText}"
          </div>
        </div>
      )}

      {/* Content - Pure crisp Black on White in Light mode, White on Dark in Dark mode */}
      <div
        style={{
          backgroundColor: 'var(--sticky-bg, #ffffff)',
          color: 'var(--sticky-text, #000000)',
          opacity: 1,
        }}
        className="sticky-note-body p-3.5"
      >
        <div
          style={{
            color: 'var(--sticky-text, #000000)',
          }}
          className={`text-xs whitespace-pre-wrap break-words leading-relaxed max-h-64 overflow-y-auto font-normal ${
            title?.toLowerCase().includes('code') || /^(\s*#|\s*\/\/|\s*import |\s*def |\s*const |\s*let )/m.test(content)
              ? 'sticky-note-code font-mono text-[11px] p-2.5 rounded-md border border-neutral-300 dark:border-neutral-700 my-1'
              : ''
          }`}
        >
          {content || <span className="opacity-50 italic">No note text written yet.</span>}
        </div>
      </div>

      {/* Source URL if present */}
      {sourceUrl && (
        <div className="px-3.5 py-1.5 border-t border-neutral-200 dark:border-neutral-800">
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline truncate max-w-full"
            title={sourceUrl}
          >
            <ExternalLink className="w-3 h-3 shrink-0" />
            <span className="truncate">{sourceUrl}</span>
          </a>
        </div>
      )}

      {/* Footer Actions */}
      <div
        style={{
          backgroundColor: 'var(--sticky-header, #f8fafc)',
          color: 'var(--sticky-text, #000000)',
          borderColor: 'var(--sticky-border, #d1d5db)',
          opacity: 1,
        }}
        className="sticky-note-footer flex items-center justify-between px-3.5 py-2 border-t text-[11px]"
      >
        <span className="flex items-center gap-1 text-[10px] text-neutral-600 dark:text-neutral-400">
          <Calendar className="w-3 h-3 text-neutral-400" />
          {dateFormatted}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="flex items-center gap-1 px-2.5 py-1 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-md transition font-semibold cursor-pointer"
            aria-label="Edit note"
          >
            <Edit3 className="w-3 h-3" />
            <span>Edit</span>
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1 px-2.5 py-1 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition font-semibold cursor-pointer"
            aria-label="Delete note"
          >
            <Trash2 className="w-3 h-3" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}
