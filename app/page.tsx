'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { DocumentRecord } from '@/types';
import { LibraryView } from '@/components/library/LibraryView';
import { PdfReaderView } from '@/components/reader/PdfReaderView';

export default function HomePage() {
  const router = useRouter();
  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [activeDocument, setActiveDocument] = useState<DocumentRecord | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('src') || params.get('share') || params.get('url')) {
        router.push(`/share${window.location.search}`);
      }
    }
  }, [router]);

  const handleOpenDocument = (file: File, docRecord: DocumentRecord) => {
    setActiveFile(file);
    setActiveDocument(docRecord);
  };

  const handleBackToLibrary = () => {
    setActiveFile(null);
    setActiveDocument(null);
  };

  if (activeFile && activeDocument) {
    return (
      <PdfReaderView
        file={activeFile}
        documentRecord={activeDocument}
        onBackToLibrary={handleBackToLibrary}
      />
    );
  }

  return <LibraryView onOpenDocument={handleOpenDocument} />;
}
