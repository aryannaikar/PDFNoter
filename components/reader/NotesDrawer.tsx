'use client';

import React, { useState } from 'react';
import { X, FileText, Highlighter, Search, ArrowRight, ExternalLink, Image as ImageIcon } from 'lucide-react';
import type { NoteRecord, AnnotationRecord } from '@/types';
import { sanitizeUrl } from '@/lib/utils/url';
import { sanitizeImageUrl } from '@/lib/utils/image';

interface NotesDrawerProps {
  isOpen: boolean;
  notes: NoteRecord[];
  annotations: AnnotationRecord[];
  onClose: () => void;
  onNavigateToPage: (pageNumber: number) => void;
}

export function NotesDrawer({
  isOpen,
  notes,
  annotations,
  onClose,
  onNavigateToPage,
}: NotesDrawerProps) {
  const [filterQuery, setFilterQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'notes' | 'annotations'>('all');

  if (!isOpen) return null;

  // Combine items with discriminator
  const allItems: Array<
    | { type: 'note'; item: NoteRecord; pageNumber: number }
    | { type: 'annotation'; item: AnnotationRecord; pageNumber: number }
  > = [
    ...notes.map((n) => ({ type: 'note' as const, item: n, pageNumber: n.pageNumber })),
    ...annotations.map((a) => ({ type: 'annotation' as const, item: a, pageNumber: a.pageNumber })),
  ].sort((a, b) => a.pageNumber - b.pageNumber);

  const filtered = allItems.filter(({ type, item }) => {
    if (activeTab === 'notes' && type !== 'note') return false;
    if (activeTab === 'annotations' && type !== 'annotation') return false;

    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();

    if (type === 'note') {
      const n = item as NoteRecord;
      return (
        (n.title && n.title.toLowerCase().includes(q)) ||
        n.content.toLowerCase().includes(q)
      );
    } else {
      const a = item as AnnotationRecord;
      return (
        (a.noteTitle && a.noteTitle.toLowerCase().includes(q)) ||
        a.noteContent.toLowerCase().includes(q) ||
        a.selectedText.toLowerCase().includes(q)
      );
    }
  });

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 sm:hidden animate-in fade-in duration-150"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 sm:max-w-[90vw] bg-white dark:bg-neutral-900 shadow-2xl border-l border-neutral-200 dark:border-neutral-800 flex flex-col animate-in slide-in-from-right duration-200 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/80">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
            Study Notes ({notes.length + annotations.length})
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-800 rounded transition"
          aria-label="Close notes"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs & Search */}
      <div className="p-3 border-b border-neutral-100 dark:border-neutral-800 space-y-2">
        <div className="flex rounded-lg bg-neutral-100 dark:bg-neutral-800 p-0.5 text-xs">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 py-1 rounded-md font-medium transition ${
              activeTab === 'all'
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-xs'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            All ({notes.length + annotations.length})
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`flex-1 py-1 rounded-md font-medium transition ${
              activeTab === 'notes'
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-xs'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            Page Notes ({notes.length})
          </button>
          <button
            onClick={() => setActiveTab('annotations')}
            className={`flex-1 py-1 rounded-md font-medium transition ${
              activeTab === 'annotations'
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-xs'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            Text ({annotations.length})
          </button>
        </div>

        <div className="relative">
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter notes..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
          />
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 pointer-events-none" />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-neutral-400 dark:text-neutral-500 text-xs">
            <FileText className="w-8 h-8 mx-auto mb-2 text-neutral-300 dark:text-neutral-700 stroke-1" />
            <p>No notes matching your search.</p>
          </div>
        ) : (
          filtered.map(({ type, item, pageNumber }) => {
            const isNote = type === 'note';
            const title = isNote ? (item as NoteRecord).title : (item as AnnotationRecord).noteTitle;
            const content = isNote ? (item as NoteRecord).content : (item as AnnotationRecord).noteContent;
            const selectedText = !isNote ? (item as AnnotationRecord).selectedText : null;
            const sourceUrl = item.sourceUrl ? sanitizeUrl(item.sourceUrl) : null;
            const imageUrl = item.imageUrl ? sanitizeImageUrl(item.imageUrl) : null;

            return (
              <div
                key={item.id}
                onClick={() => {
                  onNavigateToPage(pageNumber);
                  onClose();
                }}
                className="group p-3 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-850 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-xs transition cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    {isNote ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300">
                        <FileText className="w-2.5 h-2.5" />
                        Page Note
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300">
                        <Highlighter className="w-2.5 h-2.5" />
                        Text Highlight
                      </span>
                    )}
                    {imageUrl && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                        <ImageIcon className="w-2.5 h-2.5" />
                        Picture
                      </span>
                    )}
                    <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                      Page {pageNumber}
                    </span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-neutral-300 dark:text-neutral-600 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition" />
                </div>

                {title && (
                  <div className="text-xs font-medium text-neutral-900 dark:text-neutral-100 mb-1">{title}</div>
                )}

                {selectedText && (
                  <div className="mb-2 px-2.5 py-1.5 bg-amber-50/90 dark:bg-amber-950/40 border-l-3 border-amber-400 dark:border-amber-600 rounded-xs text-[11px] text-amber-950 dark:text-amber-200 italic whitespace-pre-wrap break-words font-serif">
                    "{selectedText}"
                  </div>
                )}

                <div
                  className={`text-xs text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap break-words leading-relaxed ${
                    title?.toLowerCase().includes('code') || /^(\s*#|\s*\/\/|\s*import |\s*def |\s*const |\s*let )/m.test(content)
                      ? 'font-mono text-[11px] bg-neutral-100/90 dark:bg-neutral-800/90 p-2.5 rounded-md border border-neutral-200/80 dark:border-neutral-700/80 my-1.5'
                      : 'font-sans my-1'
                  }`}
                >
                  {content}
                </div>

                {imageUrl && (
                  <div className="mt-2 rounded-md overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900 max-h-32 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt={title || 'Attached picture'}
                      className="max-h-28 w-auto object-contain rounded"
                    />
                  </div>
                )}

                {sourceUrl && (
                  <div className="mt-2 pt-1 border-t border-neutral-100 dark:border-neutral-800 flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 truncate">
                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">{sourceUrl}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
    </>
  );
}
