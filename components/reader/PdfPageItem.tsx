'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { TextLayer } from 'pdfjs-dist';
import type { NoteRecord, AnnotationRecord } from '@/types';
import { PageAnnotationLayer } from './PageAnnotationLayer';
import { extractSelectionAnchor } from '@/lib/pdf/selection';
import { Highlighter } from 'lucide-react';
import { useTheme } from '@/components/theme/ThemeProvider';

interface PdfPageItemProps {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  pageNotes: NoteRecord[];
  annotations: AnnotationRecord[];
  onAddAnnotationFromSelection: (data: {
    pageNumber: number;
    anchor: any;
    normalizedRects: any[];
    selectedText: string;
  }) => void;
  onEditNote: (note: NoteRecord) => void;
  onDeleteNote: (id: string) => void;
  onEditAnnotation: (ann: AnnotationRecord) => void;
  onDeleteAnnotation: (id: string) => void;
}

export function PdfPageItem({
  pdfDoc,
  pageNumber,
  scale,
  pageNotes,
  annotations,
  onAddAnnotationFromSelection,
  onEditNote,
  onDeleteNote,
  onEditAnnotation,
  onDeleteAnnotation,
}: PdfPageItemProps) {
  const { invertPdf } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);

  const [isVisible, setIsVisible] = useState(false);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 600, height: 800 });
  const [isRendered, setIsRendered] = useState(false);
  const [pageText, setPageText] = useState<string>('');

  // Floating selection action button state
  const [selectionPopup, setSelectionPopup] = useState<{
    x: number;
    y: number;
    range: Range;
    text: string;
  } | null>(null);

  // 1. Intersection Observer for lazy/on-demand rendering of large PDFs
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting);
        });
      },
      { rootMargin: '600px 0px' } // Pre-render 600px before scrolling into view
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 2. Fetch page dimensions initially even before rendering canvas
  useEffect(() => {
    let active = true;
    pdfDoc.getPage(pageNumber).then((page) => {
      if (!active) return;
      const viewport = page.getViewport({ scale });
      setDimensions({ width: viewport.width, height: viewport.height });
    }).catch(console.error);

    return () => {
      active = false;
    };
  }, [pdfDoc, pageNumber, scale]);

  // 3. Render page canvas and text layer when visible
  useEffect(() => {
    if (!isVisible) return;

    let isCancelled = false;
    let renderTask: any = null;

    async function renderPage() {
      try {
        const page: PDFPageProxy = await pdfDoc.getPage(pageNumber);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale });
        setDimensions({ width: viewport.width, height: viewport.height });

        // Setup Canvas with devicePixelRatio for sharp rendering
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined;

        renderTask = page.render({
          canvas,
          canvasContext: ctx,
          viewport,
          transform,
        });

        await renderTask.promise;
        if (isCancelled) return;

        // Setup Text Layer
        const textLayerDiv = textLayerRef.current;
        if (textLayerDiv) {
          textLayerDiv.innerHTML = '';
          textLayerDiv.style.width = `${Math.floor(viewport.width)}px`;
          textLayerDiv.style.height = `${Math.floor(viewport.height)}px`;

          const textContent = await page.getTextContent();
          if (isCancelled) return;

          const textString = textContent.items.map((item: any) => item.str || '').join(' ');
          setPageText(textString);

          // Use PDF.js TextLayer
          try {
            const textLayer = new TextLayer({
              textContentSource: textContent,
              container: textLayerDiv,
              viewport,
            });
            await textLayer.render();
          } catch (textErr) {
            console.warn('TextLayer render warning:', textErr);
          }
        }

        setIsRendered(true);
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          console.error(`Page ${pageNumber} render error:`, err);
        }
      }
    }

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, pageNumber, scale, isVisible]);

  // 4. Handle text selection within this page
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !containerRef.current) {
      setSelectionPopup(null);
      return;
    }

    const text = selection.toString().trim();
    if (!text || text.length < 2) {
      setSelectionPopup(null);
      return;
    }

    const range = selection.getRangeAt(0);
    // Ensure selection is inside this page
    if (!containerRef.current.contains(range.commonAncestorContainer)) {
      setSelectionPopup(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    setSelectionPopup({
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 10,
      range,
      text,
    });
  };

  const handleCreateAnnotation = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectionPopup || !containerRef.current) return;

    const result = extractSelectionAnchor(
      selectionPopup.range,
      pageNumber,
      containerRef.current,
      textLayerRef.current
    );

    if (result) {
      onAddAnnotationFromSelection({
        pageNumber,
        anchor: result.anchor,
        normalizedRects: result.normalizedRects,
        selectedText: selectionPopup.text,
      });
    }

    // Clear selection
    window.getSelection()?.removeAllRanges();
    setSelectionPopup(null);
  };

  return (
    <div
      ref={containerRef}
      id={`page-container-${pageNumber}`}
      data-page-number={pageNumber}
      onMouseUp={handleMouseUp}
      style={{
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`,
      }}
      className={`relative mx-auto my-2 sm:my-6 bg-white dark:bg-neutral-900 shadow-md sm:shadow-xl rounded-sm sm:rounded-md transition-shadow select-text ${
        invertPdf ? 'ring-1 ring-neutral-800' : ''
      }`}
    >
      {isVisible ? (
        <>
          {/* Canvas Layer */}
          <canvas
            ref={canvasRef}
            className={`block rounded-sm sm:rounded-md transition-all duration-200 ${
              invertPdf ? 'dark-pdf-canvas' : ''
            }`}
          />

          {/* PDF.js Text Selection Layer */}
          <div
            ref={textLayerRef}
            className="textLayer absolute inset-0 overflow-hidden leading-none select-text cursor-text"
          />

          {/* Annotations & Page Notes Layer */}
          {isRendered && (
            <PageAnnotationLayer
              pageNumber={pageNumber}
              pageWidth={dimensions.width}
              pageHeight={dimensions.height}
              pageNotes={pageNotes}
              annotations={annotations}
              pageText={pageText}
              onEditNote={onEditNote}
              onDeleteNote={onDeleteNote}
              onEditAnnotation={onEditAnnotation}
              onDeleteAnnotation={onDeleteAnnotation}
            />
          )}

          {/* Floating Contextual Button on Text Selection */}
          {selectionPopup && (
            <div
              style={{
                left: `${selectionPopup.x}px`,
                top: `${selectionPopup.y}px`,
                transform: 'translate(-50%, -100%)',
              }}
              className="absolute z-40 pointer-events-auto animate-in fade-in zoom-in-90 duration-100"
            >
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()} // prevent clearing selection on click
                onClick={handleCreateAnnotation}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-white text-xs font-medium rounded-full shadow-lg transition active:scale-95"
              >
                <Highlighter className="w-3.5 h-3.5 text-amber-400 dark:text-amber-600" />
                <span>Add study note</span>
              </button>
            </div>
          )}
        </>
      ) : (
        /* Placeholder while scrolling far away (saves memory) */
        <div className="w-full h-full flex items-center justify-center bg-neutral-50/50 dark:bg-neutral-900/50 rounded-md border border-neutral-100 dark:border-neutral-800 text-neutral-300 dark:text-neutral-600 text-xs">
          Page {pageNumber}
        </div>
      )}
    </div>
  );
}
