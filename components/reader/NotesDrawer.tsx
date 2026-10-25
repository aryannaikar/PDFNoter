'use client';

import React, { useState } from 'react';
import { X, FileText, Highlighter, Search, ArrowRight, ExternalLink } from 'lucide-react';
import type { NoteRecord, AnnotationRecord } from '@/types';
import { sanitizeUrl } from '@/lib/utils/url';

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
    <div className="fixed inset-y-0 right-0 z-50 w-96 max-w-[90vw] bg-white shadow-2xl border-l border-neutral-200 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 bg-neutral-50/70">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-600" />
          <h2 className="text-sm font-semibold text-neutral-800">
            Study Notes ({notes.length + annotations.length})
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/50 rounded transition"
          aria-label="Close notes"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs & Search */}
      <div className="p-3 border-b border-neutral-100 space-y-2">
        <div className="flex rounded-lg bg-neutral-100 p-0.5 text-xs">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 py-1 rounded-md font-medium transition ${
              activeTab === 'all' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            All ({notes.length + annotations.length})
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`flex-1 py-1 rounded-md font-medium transition ${
              activeTab === 'notes' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Page Notes ({notes.length})
          </button>
          <button
            onClick={() => setActiveTab('annotations')}
            className={`flex-1 py-1 rounded-md font-medium transition ${
              activeTab === 'annotations' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
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
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
          />
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-neutral-400 text-xs">
            <FileText className="w-8 h-8 mx-auto mb-2 text-neutral-300 stroke-1" />
            <p>No notes matching your search.</p>
          </div>
        ) : (
          filtered.map(({ type, item, pageNumber }) => {
            const isNote = type === 'note';
            const title = isNote ? (item as NoteRecord).title : (item as AnnotationRecord).noteTitle;
            const content = isNote ? (item as NoteRecord).content : (item as AnnotationRecord).noteContent;
            const selectedText = !isNote ? (item as AnnotationRecord).selectedText : null;
            const sourceUrl = item.sourceUrl ? sanitizeUrl(item.sourceUrl) : null;

            return (
              <div
                key={item.id}
                onClick={() => {
                  onNavigateToPage(pageNumber);
                  onClose();
                }}
                className="group p-3 rounded-lg border border-neutral-200/80 bg-white hover:border-indigo-300 hover:shadow-xs transition cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    {isNote ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-700">
                        <FileText className="w-2.5 h-2.5" />
                        Page Note
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-800">
                        <Highlighter className="w-2.5 h-2.5" />
                        Text Highlight
                      </span>
                    )}
                    <span className="text-[11px] font-semibold text-neutral-700">
                      Page {pageNumber}
                    </span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-neutral-300 group-hover:text-indigo-600 transition" />
                </div>

                {title && (
                  <div className="text-xs font-medium text-neutral-900 mb-1">{title}</div>
                )}

                {selectedText && (
                  <div className="mb-1.5 px-2 py-1 bg-amber-50/70 border-l-2 border-amber-300 rounded-xs text-[11px] text-amber-950 italic line-clamp-2">
                    "{selectedText}"
                  </div>
                )}

                <div className="text-xs text-neutral-600 line-clamp-3 leading-relaxed">
                  {content}
                </div>

                {sourceUrl && (
                  <div className="mt-2 pt-1 border-t border-neutral-100 flex items-center gap-1 text-[11px] text-indigo-600 truncate">
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
  );
}
