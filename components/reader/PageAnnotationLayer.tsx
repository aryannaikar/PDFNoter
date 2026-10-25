'use client';

import React, { useState } from 'react';
import type { NoteRecord, AnnotationRecord } from '@/types';
import { denormalizeRect, verifyAnchor } from '@/lib/pdf/selection';
import { NoteCard } from '@/components/notes/NoteCard';
import { MessageSquare, Highlighter } from 'lucide-react';

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
      {/* 1. Page-level Notes Markers (positioned neatly in the right margin / corner) */}
      {pageNotes.length > 0 && (
        <div className="absolute top-3 right-3 flex flex-col gap-2 pointer-events-auto z-30">
          {pageNotes.map((note, index) => {
            const isOpen = activeItemId === note.id;
            return (
              <div key={note.id} className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveItemId(isOpen ? null : note.id);
                  }}
                  className={`group flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium shadow-md transition-all duration-200 ${
                    isOpen
                      ? 'bg-indigo-600 text-white ring-2 ring-indigo-300'
                      : 'bg-white/95 text-indigo-700 hover:bg-indigo-50 border border-indigo-200/80 backdrop-blur-xs'
                  }`}
                  title={note.title || `Page note ${index + 1}`}
                  aria-label={`Open note: ${note.title || `Note ${index + 1}`}`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span className="max-w-[100px] truncate text-[11px]">
                    {note.title || `Note ${index + 1}`}
                  </span>
                </button>

                {/* Popover Card */}
                {isOpen && (
                  <div className="absolute right-0 top-8 z-50">
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
                  <div
                    className="absolute z-50 mt-1"
                    style={{
                      left: primaryRect.left > pageWidth / 2 ? 'auto' : '0',
                      right: primaryRect.left > pageWidth / 2 ? '0' : 'auto',
                    }}
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
                )}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
