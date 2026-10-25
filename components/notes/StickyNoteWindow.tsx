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
} from 'lucide-react';
import type { NoteRecord, AnnotationRecord } from '@/types';
import { sanitizeUrl } from '@/lib/utils/url';

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

  // Minimized state: cute Post-It tab sticking on the right edge of PDF
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
          className="flex items-center gap-1.5 px-3 py-2 bg-[#fef9c3] hover:bg-[#fef08a] text-amber-950 font-semibold text-xs rounded-l-xl shadow-xl border-y border-l border-amber-300 transition-all hover:translate-x-[-4px]"
          title="Expand Sticky Note"
        >
          <StickyNote className="w-4 h-4 text-amber-600 fill-amber-300" />
          <span>Sticky Note ({totalNotes})</span>
          <Maximize2 className="w-3 h-3 text-amber-700 ml-0.5" />
        </button>
      </div>
    );
  }

  return (
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
      {/* Sticky Note Body (Authentic Post-It Paper Aesthetic) */}
      <div className="relative bg-[#fef9c3] rounded-sm sm:rounded-md shadow-2xl shadow-amber-950/25 border border-amber-300/80 overflow-hidden flex flex-col text-neutral-800 transition-all">
        {/* Top Washi Tape / Tape Strip Effect */}
        <div
          onMouseDown={handleMouseDown}
          className="w-full bg-[#fef08a]/90 border-b border-amber-300/60 pt-2 pb-1.5 px-3 cursor-grab active:cursor-grabbing flex flex-col items-center select-none"
        >
          {/* Simulated semi-transparent adhesive tape */}
          <div className="h-2.5 w-24 bg-white/50 backdrop-blur-xs rounded-xs border border-white/60 shadow-2xs mb-1" />

          {/* Sticky Note Top Bar Header */}
          <div className="w-full flex items-center justify-between text-xs font-semibold text-amber-950">
            <div className="flex items-center gap-1.5">
              <StickyNote className="w-4 h-4 text-amber-700 fill-amber-400 shrink-0" />
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
                className="p-1 text-amber-800 hover:text-amber-950 hover:bg-amber-200/60 rounded transition"
                title="Stick a new note on this page"
                aria-label="Add new sticky note"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="p-1 text-amber-800 hover:text-amber-950 hover:bg-amber-200/60 rounded transition"
                title="Minimize sticky note"
                aria-label="Minimize sticky note"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1 text-amber-800 hover:text-rose-700 hover:bg-amber-200/60 rounded transition"
                title="Close sticky note"
                aria-label="Close sticky note"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Note Content Area */}
        {totalNotes > 0 && currentItem ? (
          <div className="p-3.5 flex flex-col space-y-2.5 max-h-[60vh] overflow-y-auto">
            {/* Page Pin & Navigation Bar */}
            <div className="flex items-center justify-between text-[11px] pb-1.5 border-b border-amber-200/70">
              <div className="flex items-center gap-1.5">
                <span
                  className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] ${
                    isCurrentPage
                      ? 'bg-amber-500 text-white'
                      : 'bg-amber-200 text-amber-900 cursor-pointer hover:bg-amber-300'
                  }`}
                  onClick={() => {
                    if (!isCurrentPage) onNavigateToPage(currentItem.pageNumber);
                  }}
                  title={isCurrentPage ? 'Attached to current page' : `Click to jump to Page ${currentItem.pageNumber}`}
                >
                  Page {currentItem.pageNumber}
                  {!isCurrentPage && ' ↗'}
                </span>

                <span className="text-amber-800/80 font-medium text-[11px] truncate max-w-[140px]">
                  {title || (isAnnotation ? 'Text Highlight Note' : 'Page Note')}
                </span>
              </div>

              {/* Note Pager Navigation (flip like physical sticky notes in a book) */}
              {totalNotes > 1 && (
                <div className="flex items-center gap-0.5 bg-amber-200/60 rounded-md p-0.5 text-amber-900">
                  <button
                    type="button"
                    onClick={() => {
                      const next = selectedIndex > 0 ? selectedIndex - 1 : totalNotes - 1;
                      setSelectedIndex(next);
                      if (allItems[next]) onNavigateToPage(allItems[next].pageNumber);
                    }}
                    className="p-0.5 hover:bg-amber-300/80 rounded transition"
                    title="Previous sticky note"
                    aria-label="Previous sticky note"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-semibold px-1">
                    {selectedIndex + 1}/{totalNotes}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = selectedIndex < totalNotes - 1 ? selectedIndex + 1 : 0;
                      setSelectedIndex(next);
                      if (allItems[next]) onNavigateToPage(allItems[next].pageNumber);
                    }}
                    className="p-0.5 hover:bg-amber-300/80 rounded transition"
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
              <div className="p-2 bg-amber-200/50 border-l-3 border-amber-500 rounded-r-xs text-xs text-amber-950 font-serif italic whitespace-pre-wrap break-words leading-relaxed">
                "{selectedText}"
              </div>
            )}

            {/* Note text content */}
            <div
              className={`text-xs text-amber-950 whitespace-pre-wrap break-words leading-relaxed min-h-[4rem] ${
                title?.toLowerCase().includes('code') || /^(\s*#|\s*\/\/|\s*import |\s*def |\s*const |\s*let )/m.test(content)
                  ? 'font-mono text-[11px] bg-amber-200/50 p-2.5 rounded border border-amber-300/70 my-1'
                  : 'font-sans my-1'
              }`}
            >
              {content || <span className="text-amber-800/50 italic">Empty note</span>}
            </div>

            {/* Source URL if present */}
            {sourceUrl && (
              <div className="pt-1.5 border-t border-amber-200/50">
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-900 hover:text-indigo-700 hover:underline truncate max-w-full"
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
          <div className="p-6 text-center space-y-3">
            <div className="w-10 h-10 mx-auto rounded-full bg-amber-200/70 text-amber-800 flex items-center justify-center">
              <StickyNote className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-950">No sticky notes on Page {currentPage}</p>
              <p className="text-[11px] text-amber-800/80 mt-1">
                Stick quick notes or formulas on this page just like in a physical textbook.
              </p>
            </div>
            <button
              type="button"
              onClick={onAddNote}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-900 hover:bg-amber-950 text-white rounded-lg text-xs font-medium shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Sticky Note to Page {currentPage}</span>
            </button>
          </div>
        )}

        {/* Footer Actions */}
        <div className="px-3 py-2 bg-[#fef08a]/60 border-t border-amber-300/50 flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-1">
            {onOpenFullList && (
              <button
                type="button"
                onClick={onOpenFullList}
                className="flex items-center gap-1 px-1.5 py-1 text-[11px] text-amber-900 hover:bg-amber-200/80 rounded transition"
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
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-amber-950 hover:bg-amber-200/80 rounded transition"
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
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100 rounded transition"
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
  );
}
