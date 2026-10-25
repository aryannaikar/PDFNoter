'use client';

import React, { useState } from 'react';
import type { NoteRecord, AnnotationRecord } from '@/types';
import { denormalizeRect, verifyAnchor } from '@/lib/pdf/selection';
import { NoteCard } from '@/components/notes/NoteCard';
import { StickyNote, Highlighter } from 'lucide-react';

interface PageAnnotationLayerProps {
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  pageNotes: NoteRecord[];
  annotations: AnnotationRecord[];
  pageText?: string;
  onEditNote: (note: NoteRecord) => void;
  onDeleteNote: (id: string) => void;
  onEditAnnotation: (ann: AnnotationRecord) => void;
  onDeleteAnnotation: (id: string) => void;
}

export function PageAnnotationLayer({
  pageWidth,
  pageHeight,
  pageNotes,
  annotations,
  pageText = '',
  onEditNote,
  onDeleteNote,
  onEditAnnotation,
  onDeleteAnnotation,
}: PageAnnotationLayerProps) {
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  if (pageWidth <= 0 || pageHeight <= 0) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-20 overflow-visible"
      style={{ width: pageWidth, height: pageHeight }}
    >
      {/* 1. Page-level Sticky Note Tabs (attached cleanly to the right edge of the page) */}
      {pageNotes.length > 0 && (
        <div className="absolute top-3 right-0 flex flex-col gap-2 pointer-events-auto z-30">
          {pageNotes.map((note, index) => {
            const isOpen = activeItemId === note.id;
            return (
              <div key={note.id} className="relative flex justify-end">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveItemId(isOpen ? null : note.id);
                  }}
                  className={`group flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold shadow-md transition-all duration-150 rounded-l-md border-y border-l ${
                    isOpen
                      ? 'bg-amber-400 text-amber-950 border-amber-500 ring-2 ring-amber-300 translate-x-[-4px]'
                      : 'bg-white dark:bg-neutral-850 hover:bg-amber-50 dark:hover:bg-neutral-800 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700/60 hover:translate-x-[-3px]'
                  }`}
                  title={note.title || `Sticky Note ${index + 1}`}
                  aria-label={`Open note: ${note.title || `Note ${index + 1}`}`}
                >
                  <StickyNote className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 fill-amber-300 dark:fill-amber-400/30 shrink-0" />
                  <span className="max-w-[120px] truncate text-[11px]">
                    {note.title || `Sticky Note ${index + 1}`}
                  </span>
                </button>

                {/* Popover Card */}
                {isOpen && (
                  <>
                    <div
                      className="fixed inset-0 bg-black/30 backdrop-blur-2xs z-40 sm:hidden pointer-events-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveItemId(null);
                      }}
                    />
                    <div className="fixed inset-x-3 bottom-16 sm:absolute sm:inset-auto sm:right-0 sm:top-8 z-50 pointer-events-auto flex justify-center">
                      <NoteCard
                        item={note}
                        isAnnotation={false}
                        onEdit={() => {
                          setActiveItemId(null);
                          onEditNote(note);
                        }}
                        onDelete={() => {
                          setActiveItemId(null);
                          onDeleteNote(note.id);
                        }}
                        onClose={() => setActiveItemId(null)}
                      />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 2. Text-Linked Annotations (Highlights & In-Line Markers) */}
      {annotations.map((ann) => {
        const isOpen = activeItemId === ann.id;
        const verification = verifyAnchor(ann.anchor, pageText);
        const rects = ann.normalizedRects || [];

        // Primary rect to position the marker pin
        const primaryRect = rects[0] ? denormalizeRect(rects[0], pageWidth, pageHeight) : null;

        return (
          <React.Fragment key={ann.id}>
            {/* Highlight overlays on text spans */}
            {rects.map((norm, rIdx) => {
              const px = denormalizeRect(norm, pageWidth, pageHeight);
              return (
                <div
                  key={rIdx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveItemId(isOpen ? null : ann.id);
                  }}
                  style={{
                    left: `${px.left}px`,
                    top: `${px.top}px`,
                    width: `${px.width}px`,
                    height: `${px.height}px`,
                  }}
                  className={`absolute pointer-events-auto cursor-pointer rounded-xs transition-colors ${
                    verification.valid
                      ? (isOpen ? 'bg-amber-300/60 ring-2 ring-amber-400' : 'bg-amber-200/40 hover:bg-amber-300/50')
                      : 'bg-rose-200/50 border-b border-rose-400'
                  }`}
                  title={ann.noteTitle || `Annotation: "${ann.selectedText}"`}
                />
              );
            })}

            {/* Clickable Marker Pin near the start of the annotation */}
            {primaryRect && (
              <div
                style={{
                  left: `${Math.min(pageWidth - 30, Math.max(0, primaryRect.left - 18))}px`,
                  top: `${Math.max(0, primaryRect.top - 6)}px`,
                }}
                className="absolute pointer-events-auto z-30"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveItemId(isOpen ? null : ann.id);
                  }}
                  className={`p-1 rounded-full shadow-sm transition ${
                    isOpen
                      ? 'bg-amber-500 text-white ring-2 ring-amber-300'
                      : 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300'
                  }`}
                  aria-label={`Open annotation for "${ann.selectedText}"`}
                >
                  <Highlighter className="w-3 h-3" />
                </button>

                {/* Popover Card */}
                {isOpen && (
                  <>
                    <div
                      className="fixed inset-0 bg-black/30 backdrop-blur-2xs z-40 sm:hidden pointer-events-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveItemId(null);
                      }}
                    />
                    <div
                      className="fixed inset-x-3 bottom-16 sm:absolute sm:inset-auto z-50 pointer-events-auto flex justify-center"
                      style={
                        typeof window !== 'undefined' && window.innerWidth < 640
                          ? undefined
                          : {
                              left: primaryRect.left > pageWidth / 2 ? 'auto' : '0',
                              right: primaryRect.left > pageWidth / 2 ? '0' : 'auto',
                              top: '28px',
                            }
                      }
                    >
                      <NoteCard
                        item={ann}
                        isAnnotation={true}
                        anchorWarning={verification.warning}
                        onEdit={() => {
                          setActiveItemId(null);
                          onEditAnnotation(ann);
                        }}
                        onDelete={() => {
                          setActiveItemId(null);
                          onDeleteAnnotation(ann.id);
                        }}
                        onClose={() => setActiveItemId(null)}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
