'use client';

import React, { useState } from 'react';
import type { DocumentRecord } from '@/types';
import { LibraryView } from '@/components/library/LibraryView';
import { PdfReaderView } from '@/components/reader/PdfReaderView';

export default function HomePage() {
  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [activeDocument, setActiveDocument] = useState<DocumentRecord | null>(null);

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
