'use client';

import React from 'react';
import { X, ExternalLink, Edit3, Trash2, Calendar, FileText, AlertTriangle } from 'lucide-react';
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
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className="w-80 max-w-[90vw] bg-white rounded-xl shadow-xl border border-neutral-200/90 overflow-hidden text-neutral-800 z-50 animate-in fade-in zoom-in-95 duration-150"
      role="region"
      aria-label="Note card details"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-neutral-50/80 border-b border-neutral-100">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 truncate">
          <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span className="truncate">{title || (isAnn ? 'Text Annotation' : 'Page Note')}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/50 rounded transition"
          aria-label="Close note popover"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Anchor warning if text moved */}
      {anchorWarning && (
        <div className="flex items-start gap-1.5 px-3.5 py-2 bg-amber-50 border-b border-amber-200/70 text-xs text-amber-800">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <span>{anchorWarning}</span>
        </div>
      )}

      {/* Quote if annotation */}
      {selectedText && (
        <div className="px-3.5 pt-2.5">
          <div className="px-2.5 py-1.5 bg-amber-50/90 border-l-2 border-amber-400 rounded-xs text-[11px] text-amber-900 italic line-clamp-3">
            "{selectedText}"
          </div>
        </div>
      )}

      {/* Content */}
      <div className="px-3.5 py-2.5">
        <p className="text-xs text-neutral-700 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
          {content}
        </p>
      </div>

      {/* Source URL if present */}
      {sourceUrl && (
        <div className="px-3.5 py-1.5 border-t border-neutral-100/80">
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 hover:underline truncate max-w-full"
            title={sourceUrl}
          >
            <ExternalLink className="w-3 h-3 shrink-0" />
            <span className="truncate">{sourceUrl}</span>
          </a>
        </div>
      )}

      {/* Footer Actions */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-neutral-50/50 border-t border-neutral-100 text-[11px] text-neutral-400">
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {dateFormatted}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="flex items-center gap-1 px-2 py-1 text-neutral-600 hover:text-indigo-600 hover:bg-neutral-100 rounded transition"
            aria-label="Edit note"
          >
            <Edit3 className="w-3 h-3" />
            <span>Edit</span>
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1 px-2 py-1 text-neutral-600 hover:text-rose-600 hover:bg-rose-50 rounded transition"
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
