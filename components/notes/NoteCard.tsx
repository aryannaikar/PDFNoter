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
      className="w-80 max-w-[90vw] bg-[#fef9c3] rounded-sm sm:rounded-md shadow-2xl shadow-amber-950/25 border border-amber-300/80 overflow-hidden text-neutral-800 z-50 animate-in fade-in zoom-in-95 duration-150"
      role="region"
      aria-label="Sticky note details"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Simulated Adhesive Tape Header */}
      <div className="bg-[#fef08a] border-b border-amber-300/60 pt-2 pb-1.5 px-3 flex flex-col items-center">
        {/* Semi-transparent tape strip */}
        <div className="h-2 w-20 bg-white/50 backdrop-blur-xs rounded-xs border border-white/60 shadow-2xs mb-1" />

        <div className="w-full flex items-center justify-between text-xs font-semibold text-amber-950">
          <div className="flex items-center gap-1.5 truncate">
            <StickyNote className="w-3.5 h-3.5 text-amber-700 fill-amber-400 shrink-0" />
            <span className="truncate">{title || (isAnn ? 'Text Annotation' : `Page ${item.pageNumber} Note`)}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-amber-800 hover:text-rose-700 hover:bg-amber-200/60 rounded transition"
            aria-label="Close sticky note"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Anchor warning if text moved */}
      {anchorWarning && (
        <div className="flex items-start gap-1.5 px-3 py-1.5 bg-amber-200/70 border-b border-amber-300 text-xs text-amber-900">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
          <span>{anchorWarning}</span>
        </div>
      )}

      {/* Quote if annotation */}
      {selectedText && (
        <div className="px-3 pt-2.5">
          <div className="px-2.5 py-1.5 bg-amber-200/50 border-l-3 border-amber-500 rounded-r-xs text-xs text-amber-950 italic font-serif whitespace-pre-wrap break-words leading-relaxed">
            "{selectedText}"
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-3">
        <div
          className={`text-xs text-amber-950 whitespace-pre-wrap break-words leading-relaxed max-h-64 overflow-y-auto ${
            title?.toLowerCase().includes('code') || /^(\s*#|\s*\/\/|\s*import |\s*def |\s*const |\s*let )/m.test(content)
              ? 'font-mono text-[11px] bg-amber-200/50 p-2.5 rounded border border-amber-300/70 my-1'
              : 'font-sans'
          }`}
        >
          {content || <span className="text-amber-800/50 italic">No note text written yet.</span>}
        </div>
      </div>

      {/* Source URL if present */}
      {sourceUrl && (
        <div className="px-3 py-1.5 border-t border-amber-200/60">
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-900 hover:text-indigo-800 hover:underline truncate max-w-full"
            title={sourceUrl}
          >
            <ExternalLink className="w-3 h-3 shrink-0" />
            <span className="truncate">{sourceUrl}</span>
          </a>
        </div>
      )}

      {/* Footer Actions */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#fef08a]/60 border-t border-amber-300/50 text-[11px] text-amber-800">
        <span className="flex items-center gap-1 text-[10px]">
          <Calendar className="w-3 h-3 text-amber-700" />
          {dateFormatted}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="flex items-center gap-1 px-2 py-0.5 text-amber-900 hover:bg-amber-200/80 rounded transition font-medium"
            aria-label="Edit note"
          >
            <Edit3 className="w-3 h-3" />
            <span>Edit</span>
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1 px-2 py-0.5 text-rose-700 hover:bg-rose-100 rounded transition font-medium"
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
