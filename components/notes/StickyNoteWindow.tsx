'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Edit3,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Plus,
  StickyNote,
  ExternalLink,
  Minimize2,
  Maximize2,
  List,
  ZoomIn,
} from 'lucide-react';
import type { NoteRecord, AnnotationRecord } from '@/types';
import { sanitizeUrl } from '@/lib/utils/url';
import { sanitizeImageUrl } from '@/lib/utils/image';

export interface StickyNoteWindowProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: number;
  notes: NoteRecord[];
  annotations: AnnotationRecord[];
  onNavigateToPage: (pageNumber: number) => void;
  onEditNote: (note: NoteRecord) => void;
  onDeleteNote: (id: string) => void;
  onEditAnnotation: (ann: AnnotationRecord) => void;
  onDeleteAnnotation: (id: string) => void;
  onAddNote: () => void;
  onOpenFullList?: () => void;
}

type UnifiedNote =
  | { type: 'note'; item: NoteRecord; pageNumber: number }
  | { type: 'annotation'; item: AnnotationRecord; pageNumber: number };

export function StickyNoteWindow({
  isOpen,
  onClose,
  currentPage,
  notes,
  annotations,
  onNavigateToPage,
  onEditNote,
  onDeleteNote,
  onEditAnnotation,
  onDeleteAnnotation,
  onAddNote,
  onOpenFullList,
}: StickyNoteWindowProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Position state (draggable)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
  });

  // Combine and sort all notes by page number
  const allItems: UnifiedNote[] = useMemo(() => [
    ...notes.map((n) => ({ type: 'note' as const, item: n, pageNumber: n.pageNumber })),
    ...annotations.map((a) => ({ type: 'annotation' as const, item: a, pageNumber: a.pageNumber })),
  ].sort((a, b) => {
    if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
    return (a.item.createdAt || 0) - (b.item.createdAt || 0);
  }), [notes, annotations]);

  // When opening or when current page changes, prioritize showing current page's note
  useEffect(() => {
    if (!isOpen) return;

    const pageNotes = allItems.filter((item) => item.pageNumber === currentPage);
    if (pageNotes.length > 0) {
      const idx = allItems.findIndex((item) => item.pageNumber === currentPage);
      if (idx !== -1) {
        setSelectedIndex(idx);
      }
    } else if (allItems.length > 0) {
      // Find closest note
      let closestIdx = 0;
      let minDiff = Infinity;
      allItems.forEach((item, idx) => {
        const diff = Math.abs(item.pageNumber - currentPage);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      });
      setSelectedIndex(closestIdx);
    }
  }, [isOpen, currentPage, allItems]);

  // Dragging handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag from header handle
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('input')) return;

    setIsDragging(true);
    const initialPos = position || {
      x: Math.max(16, (typeof window !== 'undefined' ? window.innerWidth - 380 : 400)),
      y: 72,
    };

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: initialPos.x,
      posY: initialPos.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;

      const maxX = (typeof window !== 'undefined' ? window.innerWidth - 340 : 800);
      const maxY = (typeof window !== 'undefined' ? window.innerHeight - 200 : 600);

      const nextX = Math.max(10, Math.min(maxX, dragRef.current.posX + dx));
      const nextY = Math.max(56, Math.min(maxY, dragRef.current.posY + dy));

      setPosition({ x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (!isOpen) return null;

  const currentItem = allItems[selectedIndex];
  const totalNotes = allItems.length;

  const isCurrentPage = currentItem ? currentItem.pageNumber === currentPage : false;

  // Title and content extraction
  const isAnnotation = currentItem?.type === 'annotation';
  const title = isAnnotation
    ? (currentItem.item as AnnotationRecord).noteTitle
    : currentItem ? (currentItem.item as NoteRecord).title : undefined;
  const content = isAnnotation
    ? (currentItem.item as AnnotationRecord).noteContent
    : currentItem ? (currentItem.item as NoteRecord).content : '';
  const selectedText = isAnnotation
    ? (currentItem.item as AnnotationRecord).selectedText
    : undefined;
  const sourceUrl = currentItem?.item.sourceUrl ? sanitizeUrl(currentItem.item.sourceUrl) : '';
  const imageUrl = currentItem?.item.imageUrl ? sanitizeImageUrl(currentItem.item.imageUrl) : undefined;

  // Minimized state: crisp tab sticking on the right edge of PDF
  if (isMinimized) {
    return (
      <div
        style={{
          position: 'fixed',
          top: position ? `${position.y}px` : '80px',
          right: '12px',
          zIndex: 45,
        }}
        className="animate-in fade-in zoom-in-95 duration-150"
      >
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-100 font-semibold text-xs rounded-l-xl shadow-xl border-y border-l border-neutral-250 dark:border-neutral-700 transition-all hover:translate-x-[-4px]"
          title="Expand Sticky Note"
        >
          <StickyNote className="w-4 h-4 text-amber-500 fill-amber-200" />
          <span>Sticky Note ({totalNotes})</span>
          <Maximize2 className="w-3 h-3 text-neutral-500 ml-0.5" />
        </button>
      </div>
    );
  }

  return (
    <>
      <div
      style={{
        position: 'fixed',
        left: position ? `${position.x}px` : undefined,
        top: position ? `${position.y}px` : '72px',
        right: position ? undefined : '16px',
        zIndex: 45,
      }}
      className="w-[92vw] sm:w-88 md:w-96 max-w-sm pointer-events-auto select-text animate-in fade-in zoom-in-95 duration-150"
      role="dialog"
      aria-labelledby="sticky-note-title"
    >
      {/* 100% Solid Opaque Card Container - Zero Bleed Through */}
      <div
        style={{
          backgroundColor: 'var(--sticky-bg, #ffffff)',
          color: 'var(--sticky-text, #000000)',
          borderColor: 'var(--sticky-border, #d1d5db)',
          opacity: 1,
        }}
        className="sticky-note-card relative rounded-xl shadow-2xl shadow-black/40 border overflow-hidden flex flex-col transition-all"
      >
        {/* Top Header Bar / Draggable handle */}
        <div
          onMouseDown={handleMouseDown}
          style={{
            backgroundColor: 'var(--sticky-header, #f8fafc)',
            color: 'var(--sticky-text, #000000)',
            borderColor: 'var(--sticky-border, #d1d5db)',
            opacity: 1,
          }}
          className="sticky-note-header w-full border-b pt-2 pb-2 px-3.5 cursor-grab active:cursor-grabbing flex flex-col items-center select-none"
        >
          {/* Subtle drag handle pill */}
          <div className="h-1 w-12 bg-neutral-400 dark:bg-neutral-600 rounded-full mb-1.5" />

          {/* Sticky Note Top Bar Header */}
          <div className="w-full flex items-center justify-between text-xs font-bold text-neutral-900 dark:text-neutral-100">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <StickyNote className="w-3.5 h-3.5 fill-amber-300 dark:fill-amber-400/40" />
              </div>
              <span id="sticky-note-title" className="text-xs font-bold tracking-tight">
                {totalNotes === 0
                  ? `Sticky Note • Page ${currentPage}`
                  : `Sticky Note (${selectedIndex + 1}/${totalNotes})`}
              </span>
            </div>

            {/* Top Bar Actions */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onAddNote}
                className="p-1 text-neutral-700 dark:text-neutral-200 hover:text-black dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-md transition cursor-pointer"
                title="Stick a new note on this page"
                aria-label="Add new sticky note"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="p-1 text-neutral-700 dark:text-neutral-200 hover:text-black dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-md transition cursor-pointer"
                title="Minimize sticky note"
                aria-label="Minimize sticky note"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1 text-neutral-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition cursor-pointer"
                title="Close sticky note"
                aria-label="Close sticky note"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Note Content Area (Solid white in light, solid black in dark) */}
        {totalNotes > 0 && currentItem ? (
          <div
            style={{
              backgroundColor: 'var(--sticky-bg, #ffffff)',
              color: 'var(--sticky-text, #000000)',
              opacity: 1,
            }}
            className="sticky-note-body p-4 flex flex-col space-y-3 max-h-[60vh] overflow-y-auto"
          >
            {/* Page Pin & Navigation Bar */}
            <div className="flex items-center justify-between text-[11px] pb-2 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-1.5">
                <span
                  className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] ${
                    isCurrentPage
                      ? 'bg-amber-500 text-white'
                      : 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 cursor-pointer hover:bg-amber-200 dark:hover:bg-amber-900'
                  }`}
                  onClick={() => {
                    if (!isCurrentPage) onNavigateToPage(currentItem.pageNumber);
                  }}
                  title={isCurrentPage ? 'Attached to current page' : `Click to jump to Page ${currentItem.pageNumber}`}
                >
                  Page {currentItem.pageNumber}
                  {!isCurrentPage && ' ↗'}
                </span>

                <span className="font-semibold text-[11px] truncate max-w-[140px] text-neutral-800 dark:text-neutral-200">
                  {title || (isAnnotation ? 'Text Highlight Note' : 'Page Note')}
                </span>
              </div>

              {/* Note Pager Navigation */}
              {totalNotes > 1 && (
                <div className="flex items-center gap-0.5 bg-neutral-200 dark:bg-neutral-800 rounded-md p-0.5 text-neutral-800 dark:text-neutral-200">
                  <button
                    type="button"
                    onClick={() => {
                      const next = selectedIndex > 0 ? selectedIndex - 1 : totalNotes - 1;
                      setSelectedIndex(next);
                      if (allItems[next]) onNavigateToPage(allItems[next].pageNumber);
                    }}
                    className="p-1 hover:bg-white dark:hover:bg-neutral-700 rounded transition cursor-pointer"
                    title="Previous sticky note"
                    aria-label="Previous sticky note"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-bold px-1.5">
                    {selectedIndex + 1}/{totalNotes}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = selectedIndex < totalNotes - 1 ? selectedIndex + 1 : 0;
                      setSelectedIndex(next);
                      if (allItems[next]) onNavigateToPage(allItems[next].pageNumber);
                    }}
                    className="p-1 hover:bg-white dark:hover:bg-neutral-700 rounded transition cursor-pointer"
                    title="Next sticky note"
                    aria-label="Next sticky note"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Quoted highlight text if annotation */}
            {selectedText && (
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border-l-3 border-amber-400 dark:border-amber-500 rounded-r-md text-xs text-amber-950 dark:text-amber-200 font-serif italic whitespace-pre-wrap break-words leading-relaxed">
                "{selectedText}"
              </div>
            )}

            {/* Note text content - Pure crisp Black on White in Light mode, White on Dark in Dark mode */}
            <div
              style={{
                color: 'var(--sticky-text, #000000)',
              }}
              className={`text-xs whitespace-pre-wrap break-words leading-relaxed min-h-[4rem] font-normal ${
                title?.toLowerCase().includes('code') || /^(\s*#|\s*\/\/|\s*import |\s*def |\s*const |\s*let )/m.test(content)
                  ? 'sticky-note-code font-mono text-[11px] p-2.5 rounded-md border border-neutral-300 dark:border-neutral-700 my-1'
                  : 'my-1'
              }`}
            >
              {content || <span className="opacity-50 italic">Empty note</span>}
            </div>

            {/* Attached Picture / Diagram if present */}
            {imageUrl && (
              <div className="pt-2 border-t border-neutral-200/80 dark:border-neutral-800">
                <div
                  onClick={() => setLightboxOpen(true)}
                  className="relative group rounded-lg overflow-hidden border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900 cursor-pointer max-h-48 flex items-center justify-center transition hover:opacity-95"
                  title="Click to enlarge picture"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt={title || 'Attached picture'}
                    className="w-full object-contain max-h-44 rounded-md"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium gap-1">
                    <ZoomIn className="w-4 h-4" />
                    <span>Click to enlarge</span>
                  </div>
                </div>
              </div>
            )}

            {/* Source URL if present */}
            {sourceUrl && (
              <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
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
          </div>
        ) : (
          /* Empty state for page with no notes */
          <div
            style={{
              backgroundColor: 'var(--sticky-bg, #ffffff)',
              color: 'var(--sticky-text, #000000)',
              opacity: 1,
            }}
            className="sticky-note-body p-6 text-center space-y-3"
          >
            <div className="w-10 h-10 mx-auto rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 flex items-center justify-center">
              <StickyNote className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100">No sticky notes on Page {currentPage}</p>
              <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-1">
                Attach quick notes, code snippets, or formulas on this page.
              </p>
            </div>
            <button
              type="button"
              onClick={onAddNote}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Note to Page {currentPage}</span>
            </button>
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
          className="sticky-note-footer px-3.5 py-2.5 border-t flex items-center justify-between text-xs"
        >
          <div className="flex items-center gap-1">
            {onOpenFullList && (
              <button
                type="button"
                onClick={onOpenFullList}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-md transition cursor-pointer"
                title="Search and list all notes"
              >
                <List className="w-3 h-3" />
                <span>All Notes</span>
              </button>
            )}
          </div>

          {currentItem && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (currentItem.type === 'note') {
                    onEditNote(currentItem.item as NoteRecord);
                  } else {
                    onEditAnnotation(currentItem.item as AnnotationRecord);
                  }
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-md transition cursor-pointer"
                title="Edit note text"
                aria-label="Edit note"
              >
                <Edit3 className="w-3 h-3" />
                <span>Edit</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Delete this sticky note?')) {
                    if (currentItem.type === 'note') {
                      onDeleteNote(currentItem.item.id);
                    } else {
                      onDeleteAnnotation(currentItem.item.id);
                    }
                  }
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition cursor-pointer"
                title="Delete note"
                aria-label="Delete note"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>

      {/* Lightbox Modal for enlarged view */}
      {lightboxOpen && imageUrl && (
        <div
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden flex flex-col items-center">
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/90 text-white rounded-full transition cursor-pointer"
              aria-label="Close enlarged picture"
            >
              <X className="w-5 h-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Enlarged note diagram"
              className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}
