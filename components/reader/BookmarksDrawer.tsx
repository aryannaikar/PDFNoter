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
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-80 sm:max-w-[85vw] bg-white shadow-2xl border-l border-neutral-200 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 bg-neutral-50/70">
        <div className="flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-indigo-600" />
          <h2 className="text-sm font-semibold text-neutral-800">Bookmarks</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/50 rounded transition"
          aria-label="Close bookmarks"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Add bookmark button / form */}
      <div className="p-3 border-b border-neutral-100 bg-neutral-50/30">
        {!isAdding ? (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200 rounded-lg transition"
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
              className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-2.5 py-1 text-xs text-neutral-500 hover:bg-neutral-100 rounded"
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
          <div className="text-center py-12 text-neutral-400 text-xs">
            <Bookmark className="w-8 h-8 mx-auto mb-2 text-neutral-300 stroke-1" />
            <p>No bookmarks yet.</p>
            <p className="mt-1 text-[11px] text-neutral-400">Save pages to easily return to them.</p>
          </div>
        ) : (
          bookmarks.map((bm) => (
            <div
              key={bm.id}
              className={`group flex items-center justify-between p-2.5 rounded-lg border transition ${
                bm.pageNumber === currentPage
                  ? 'bg-indigo-50/70 border-indigo-200 text-indigo-900'
                  : 'bg-white hover:bg-neutral-50 border-neutral-200/70 text-neutral-700'
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
                <div className="text-[10px] text-neutral-400">Page {bm.pageNumber}</div>
              </button>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onDeleteBookmark(bm.id)}
                  className="p-1 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded"
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
