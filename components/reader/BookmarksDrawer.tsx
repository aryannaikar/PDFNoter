'use client';

import React, { useState } from 'react';
import { X, Bookmark, Plus, Trash2 } from 'lucide-react';
import type { BookmarkRecord } from '@/types';

interface BookmarksDrawerProps {
  isOpen: boolean;
  currentPage: number;
  bookmarks: BookmarkRecord[];
  onClose: () => void;
  onNavigateToPage: (pageNumber: number) => void;
  onAddBookmark: (pageNumber: number, label: string) => Promise<void>;
  onDeleteBookmark: (id: string) => Promise<void>;
}

export function BookmarksDrawer({
  isOpen,
  currentPage,
  bookmarks,
  onClose,
  onNavigateToPage,
  onAddBookmark,
  onDeleteBookmark,
}: BookmarksDrawerProps) {
  const [label, setLabel] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  if (!isOpen) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAddBookmark(currentPage, label.trim() || `Page ${currentPage}`);
    setLabel('');
    setIsAdding(false);
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 sm:hidden animate-in fade-in duration-150"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-80 sm:max-w-[85vw] bg-white dark:bg-neutral-900 shadow-2xl border-l border-neutral-200 dark:border-neutral-800 flex flex-col animate-in slide-in-from-right duration-200 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/80">
        <div className="flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">Bookmarks</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-800 rounded transition"
          aria-label="Close bookmarks"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Add bookmark button / form */}
      <div className="p-3 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-900/40">
        {!isAdding ? (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 rounded-lg transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Bookmark Page {currentPage}</span>
          </button>
        ) : (
          <form onSubmit={handleAdd} className="space-y-2">
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={`Page ${currentPage} label (e.g. Chapter 3)`}
              autoFocus
              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-700 rounded-md focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-2.5 py-1 text-xs text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-xs"
              >
                Save
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Bookmarks List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {bookmarks.length === 0 ? (
          <div className="text-center py-12 text-neutral-400 dark:text-neutral-500 text-xs">
            <Bookmark className="w-8 h-8 mx-auto mb-2 text-neutral-300 dark:text-neutral-700 stroke-1" />
            <p>No bookmarks yet.</p>
            <p className="mt-1 text-[11px] text-neutral-400 dark:text-neutral-500">Save pages to easily return to them.</p>
          </div>
        ) : (
          bookmarks.map((bm) => (
            <div
              key={bm.id}
              className={`group flex items-center justify-between p-2.5 rounded-lg border transition ${
                bm.pageNumber === currentPage
                  ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200'
                  : 'bg-white dark:bg-neutral-850 hover:bg-neutral-50 dark:hover:bg-neutral-800 border-neutral-200/70 dark:border-neutral-800 text-neutral-700 dark:text-neutral-200'
              }`}
            >
              <button
                onClick={() => {
                  onNavigateToPage(bm.pageNumber);
                  onClose();
                }}
                className="flex-1 text-left min-w-0"
              >
                <div className="text-xs font-medium truncate">{bm.label}</div>
                <div className="text-[10px] text-neutral-400 dark:text-neutral-500">Page {bm.pageNumber}</div>
              </button>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onDeleteBookmark(bm.id)}
                  className="p-1 text-neutral-400 dark:text-neutral-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded"
                  title="Delete bookmark"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
    </>
  );
}
