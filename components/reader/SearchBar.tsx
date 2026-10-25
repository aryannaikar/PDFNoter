'use client';

import React, { useState, useEffect } from 'react';
import { Search, ChevronUp, ChevronDown, X, Loader2, AlertCircle } from 'lucide-react';
import type { SearchMatch } from '@/types';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { searchPdfText } from '@/lib/pdf/search';

interface SearchBarProps {
  pdfDoc: PDFDocumentProxy;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToMatch: (pageNumber: number) => void;
}

export function SearchBar({
  pdfDoc,
  isOpen,
  onClose,
  onNavigateToMatch,
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [hasScannedWarning, setHasScannedWarning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setMatches([]);
      setCurrentIndex(-1);
      setHasScannedWarning(false);
    }
  }, [isOpen]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) {
      setMatches([]);
      setCurrentIndex(-1);
      return;
    }

    setIsSearching(true);
    setHasScannedWarning(false);
    setProgress({ current: 0, total: pdfDoc.numPages });

    try {
      const result = await searchPdfText(pdfDoc, query, (current, total) => {
        setProgress({ current, total });
      });

      setMatches(result.matches);
      if (result.matches.length > 0) {
        setCurrentIndex(0);
        onNavigateToMatch(result.matches[0].pageNumber);
      } else {
        setCurrentIndex(-1);
        if (!result.hasText) {
          setHasScannedWarning(true);
        }
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
      setProgress(null);
    }
  };

  const handleNext = () => {
    if (matches.length === 0) return;
    const nextIdx = (currentIndex + 1) % matches.length;
    setCurrentIndex(nextIdx);
    onNavigateToMatch(matches[nextIdx].pageNumber);
  };

  const handlePrev = () => {
    if (matches.length === 0) return;
    const prevIdx = (currentIndex - 1 + matches.length) % matches.length;
    setCurrentIndex(prevIdx);
    onNavigateToMatch(matches[prevIdx].pageNumber);
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-14 left-2 right-2 sm:left-auto sm:right-4 z-40 sm:w-96 bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200/90 dark:border-neutral-800 p-3 animate-in fade-in slide-in-from-top-2 duration-150 transition-colors">
      <form onSubmit={handleSearch} className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search document text..."
            autoFocus
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
          />
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 pointer-events-none" />
        </div>

        <button
          type="button"
          onClick={handlePrev}
          disabled={matches.length === 0}
          className="p-1.5 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 rounded transition"
          title="Previous match"
          aria-label="Previous match"
        >
          <ChevronUp className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleNext}
          disabled={matches.length === 0}
          className="p-1.5 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 rounded transition"
          title="Next match"
          aria-label="Next match"
        >
          <ChevronDown className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition"
          title="Close search"
          aria-label="Close search"
        >
          <X className="w-4 h-4" />
        </button>
      </form>

      {/* Status Line */}
      <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 px-1">
        {isSearching ? (
          <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>
              Searching pages ({progress?.current || 0}/{progress?.total || pdfDoc.numPages})...
            </span>
          </div>
        ) : matches.length > 0 ? (
          <div className="flex items-center justify-between w-full">
            <span>
              Match {currentIndex + 1} of {matches.length}
            </span>
            <span className="text-neutral-400 dark:text-neutral-500">Page {matches[currentIndex]?.pageNumber}</span>
          </div>
        ) : query.trim() ? (
          <span>No matches found</span>
        ) : (
          <span>Type query and press enter</span>
        )}
      </div>

      {/* Snippet preview */}
      {matches.length > 0 && currentIndex >= 0 && (
        <div className="mt-2 p-2 bg-neutral-50 dark:bg-neutral-800/60 rounded text-xs text-neutral-700 dark:text-neutral-300 italic border border-neutral-100 dark:border-neutral-750 max-h-16 overflow-y-auto">
          "{matches[currentIndex]?.snippet}"
        </div>
      )}

      {/* Scanned PDF warning if 0 text extracted */}
      {hasScannedWarning && (
        <div className="mt-2 p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded border border-amber-200 dark:border-amber-800/50 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <span>
            This PDF appears to be a scanned image without a text layer. Text search requires machine-readable text. OCR support will be available in future updates.
          </span>
        </div>
      )}
    </div>
  );
}
