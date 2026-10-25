'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Search,
  Bookmark,
  FileText,
  Plus,
} from 'lucide-react';

interface ReaderToolbarProps {
  fileName: string;
  currentPage: number;
  totalPages: number;
  scale: number;
  hasNotesOnCurrentPage: boolean;
  notesCount: number;
  bookmarksCount: number;
  onBackToLibrary: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onJumpToPage: (page: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitWidth: () => void;
  onOpenSearch: () => void;
  onOpenBookmarks: () => void;
  onOpenNotes: () => void;
  onAddPageNote: () => void;
}

export function ReaderToolbar({
  fileName,
  currentPage,
  totalPages,
  scale,
  hasNotesOnCurrentPage,
  notesCount,
  bookmarksCount,
  onBackToLibrary,
  onPrevPage,
  onNextPage,
  onJumpToPage,
  onZoomIn,
  onZoomOut,
  onFitWidth,
  onOpenSearch,
  onOpenBookmarks,
  onOpenNotes,
  onAddPageNote,
}: ReaderToolbarProps) {
  const [pageInput, setPageInput] = useState(String(currentPage));

  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(pageInput, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      onJumpToPage(p);
    } else {
      setPageInput(String(currentPage));
    }
  };

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-3 md:px-4 py-2 bg-white/95 backdrop-blur-md border-b border-neutral-200/90 shadow-2xs select-none">
      {/* Left: Back & Title */}
      <div className="flex items-center gap-2 min-w-0 max-w-[28%] md:max-w-[32%]">
        <button
          onClick={onBackToLibrary}
          className="flex items-center gap-1.5 p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition"
          title="Back to library"
          aria-label="Back to library"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline text-xs font-medium">Library</span>
        </button>

        <div className="h-4 w-px bg-neutral-200 mx-1 hidden sm:block" />

        <span className="text-xs font-semibold text-neutral-800 truncate" title={fileName}>
          {fileName}
        </span>
      </div>

      {/* Center: Pagination Navigation */}
      <div className="flex items-center gap-1 sm:gap-2">
        <button
          onClick={onPrevPage}
          disabled={currentPage <= 1}
          className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 disabled:opacity-30 disabled:pointer-events-none rounded transition"
          title="Previous page (Left arrow)"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <form onSubmit={handlePageSubmit} className="flex items-center text-xs text-neutral-600">
          <input
            type="text"
            value={pageInput}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setPageInput(e.target.value)}
            onBlur={() => setPageInput(String(currentPage))}
            className="w-10 px-1.5 py-0.5 text-center text-xs font-medium bg-neutral-50 border border-neutral-300 rounded focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            aria-label="Current page number"
          />
          <span className="ml-1 text-neutral-400">/ {totalPages || 1}</span>
        </form>

        <button
          onClick={onNextPage}
          disabled={currentPage >= totalPages}
          className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 disabled:opacity-30 disabled:pointer-events-none rounded transition"
          title="Next page (Right arrow)"
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Right: Zoom & Tool Actions */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        {/* Zoom Controls */}
        <div className="hidden lg:flex items-center bg-neutral-100/80 rounded-lg p-0.5 border border-neutral-200/60">
          <button
            onClick={onZoomOut}
            className="p-1 text-neutral-600 hover:text-neutral-900 rounded hover:bg-white transition"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-medium text-neutral-600 px-1.5 min-w-[3rem] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={onZoomIn}
            className="p-1 text-neutral-600 hover:text-neutral-900 rounded hover:bg-white transition"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onFitWidth}
            className="p-1 text-neutral-600 hover:text-neutral-900 rounded hover:bg-white transition ml-0.5"
            title="Fit to width"
            aria-label="Fit to width"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search */}
        <button
          onClick={onOpenSearch}
          className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition"
          title="Search text (Ctrl+F)"
          aria-label="Search document text"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Bookmarks */}
        <button
          onClick={onOpenBookmarks}
          className="relative p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition"
          title="Bookmarks"
          aria-label="Bookmarks"
        >
          <Bookmark className="w-4 h-4" />
          {bookmarksCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-indigo-600 rounded-full" />
          )}
        </button>

        {/* Notes overview */}
        <button
          onClick={onOpenNotes}
          className={`relative flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition ${
            hasNotesOnCurrentPage
              ? 'bg-amber-100/70 text-amber-900 hover:bg-amber-200/70'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
          }`}
          title="View all notes"
          aria-label="View all notes"
        >
          <FileText className="w-4 h-4" />
          <span className="hidden md:inline">{notesCount}</span>
          {hasNotesOnCurrentPage && (
            <span
              className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full"
              title="Notes on this page"
            />
          )}
        </button>

        {/* Primary Action: Add Page Note */}
        <button
          onClick={onAddPageNote}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-medium rounded-lg shadow-xs transition"
          title="Add note to current page"
          aria-label="Add page note"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Add Note</span>
        </button>
      </div>
    </header>
  );
}
