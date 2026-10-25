'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Search,
  Bookmark,
  StickyNote,
  Plus,
  Share2,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

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
  onOpenExportShare: () => void;
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
  onOpenExportShare,
}: ReaderToolbarProps) {
  const [pageInput, setPageInput] = useState(String(currentPage));

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

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
    <>
      {/* Top Header Toolbar */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-2.5 sm:px-4 py-2 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-b border-neutral-200/90 dark:border-neutral-800 shadow-2xs select-none gap-2 transition-colors">
        {/* Left: Back & Title */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <button
            onClick={onBackToLibrary}
            className="flex items-center gap-1 p-1.5 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition shrink-0"
            title="Back to library"
            aria-label="Back to library"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline text-xs font-medium">Library</span>
          </button>

          <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-800 mx-1 hidden sm:block shrink-0" />

          <span
            className="text-xs sm:text-sm font-semibold text-neutral-800 dark:text-neutral-100 truncate block"
            title={fileName}
          >
            {fileName}
          </span>
        </div>

        {/* Center: Pagination Navigation (Visible on tablet and desktop) */}
        <div className="hidden sm:flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            onClick={onPrevPage}
            disabled={currentPage <= 1}
            className="p-1.5 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:pointer-events-none rounded transition"
            title="Previous page (Left arrow)"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <form onSubmit={handlePageSubmit} className="flex items-center text-xs text-neutral-600 dark:text-neutral-300">
            <input
              type="text"
              value={pageInput}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={() => setPageInput(String(currentPage))}
              className="w-10 px-1.5 py-0.5 text-center text-xs font-medium bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 rounded focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              aria-label="Current page number"
            />
            <span className="ml-1 text-neutral-400 dark:text-neutral-500">/ {totalPages || 1}</span>
          </form>

          <button
            onClick={onNextPage}
            disabled={currentPage >= totalPages}
            className="p-1.5 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:pointer-events-none rounded transition"
            title="Next page (Right arrow)"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Zoom Controls (Desktop only) */}
          <div className="hidden lg:flex items-center bg-neutral-100/80 dark:bg-neutral-800/80 rounded-lg p-0.5 border border-neutral-200/60 dark:border-neutral-700/60">
            <button
              onClick={onZoomOut}
              className="p-1 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white rounded hover:bg-white dark:hover:bg-neutral-700 transition"
              title="Zoom out"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300 px-1.5 min-w-[3rem] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={onZoomIn}
              className="p-1 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white rounded hover:bg-white dark:hover:bg-neutral-700 transition"
              title="Zoom in"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onFitWidth}
              className="p-1 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white rounded hover:bg-white dark:hover:bg-neutral-700 transition ml-0.5"
              title="Fit to width"
              aria-label="Fit to width"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search */}
          <button
            onClick={onOpenSearch}
            className="p-1.5 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition"
            title="Search text (Ctrl+F)"
            aria-label="Search document text"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Bookmarks */}
          <button
            onClick={onOpenBookmarks}
            className="relative p-1.5 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition"
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
            className={`relative flex items-center gap-1 p-1.5 sm:px-2 sm:py-1.5 rounded-lg text-xs font-medium transition ${
              hasNotesOnCurrentPage
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/80 border border-amber-300 dark:border-amber-700/60'
                : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
            title="Open sticky notes on this page"
            aria-label="Open sticky notes"
          >
            <StickyNote className="w-4 h-4 text-amber-600 dark:text-amber-400 fill-amber-300 dark:fill-amber-400/30 shrink-0" />
            <span className="text-[11px] font-bold">{notesCount}</span>
            {hasNotesOnCurrentPage && (
              <span
                className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full ring-2 ring-white dark:ring-neutral-900"
                title="Notes on this page"
              />
            )}
          </button>

          {/* Export & Share */}
          <button
            onClick={onOpenExportShare}
            className="p-1.5 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition"
            title="Export & Share"
            aria-label="Export & Share"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* Theme & Night PDF Filter Toggle */}
          <ThemeToggle showPdfInvertOption={true} />

          {/* Primary Action: Add Page Note */}
          <button
            onClick={onAddPageNote}
            className="flex items-center gap-1 px-2 py-1.5 sm:px-2.5 sm:py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-medium rounded-lg shadow-xs transition"
            title="Add note to current page"
            aria-label="Add page note"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Note</span>
          </button>
        </div>
      </header>

      {/* Floating Bottom Bar for Mobile Devices */}
      <div className="sm:hidden fixed bottom-3 inset-x-3 z-30 flex items-center justify-between px-3 py-1.5 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md rounded-2xl shadow-xl border border-neutral-200/90 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs select-none animate-in slide-in-from-bottom duration-200">
        {/* Pagination Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={onPrevPage}
            disabled={currentPage <= 1}
            className="p-1.5 text-neutral-700 dark:text-neutral-300 active:bg-neutral-100 dark:active:bg-neutral-800 disabled:opacity-30 rounded-lg"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <form onSubmit={handlePageSubmit} className="flex items-center">
            <input
              type="text"
              value={pageInput}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={() => setPageInput(String(currentPage))}
              className="w-8 px-1 py-0.5 text-center text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded border border-neutral-300 dark:border-neutral-700 focus:outline-hidden"
              aria-label="Current page number"
            />
            <span className="ml-1 text-neutral-400 dark:text-neutral-500 text-[11px]">/ {totalPages || 1}</span>
          </form>

          <button
            onClick={onNextPage}
            disabled={currentPage >= totalPages}
            className="p-1.5 text-neutral-700 dark:text-neutral-300 active:bg-neutral-100 dark:active:bg-neutral-800 disabled:opacity-30 rounded-lg"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Separator */}
        <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-800 mx-1" />

        {/* Mobile Zoom Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={onZoomOut}
            className="p-1.5 text-neutral-700 dark:text-neutral-300 active:bg-neutral-100 dark:active:bg-neutral-800 rounded-lg"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 min-w-[2.2rem] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={onZoomIn}
            className="p-1.5 text-neutral-700 dark:text-neutral-300 active:bg-neutral-100 dark:active:bg-neutral-800 rounded-lg"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onFitWidth}
            className="p-1.5 text-indigo-600 dark:text-indigo-400 active:bg-indigo-50 dark:active:bg-indigo-950/50 rounded-lg ml-0.5"
            title="Fit to width"
            aria-label="Fit to width"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>
  );
}
