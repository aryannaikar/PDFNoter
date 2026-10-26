'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, AlertCircle, BookOpen, ArrowRight } from 'lucide-react';
import type { DocumentRecord } from '@/types';
import { validateStudyFile, commitStudyFileImport } from '@/lib/export/studyFileImporter';
import { storageService } from '@/services/storage/dexieStorageService';
import { computePdfFingerprint } from '@/lib/pdf/fingerprint';
import { PdfReaderView } from '@/components/reader/PdfReaderView';

function SharePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const src = searchParams.get('src') || searchParams.get('url') || searchParams.get('file');
  const customName = searchParams.get('name') || searchParams.get('title') || 'Shared Document';

  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('Connecting to shared document...');
  const [progressPercent, setProgressPercent] = useState(15);
  const [error, setError] = useState<string | null>(null);

  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [activeDocument, setActiveDocument] = useState<DocumentRecord | null>(null);

  useEffect(() => {
    if (!src) {
      setError('No shared document source found in link URL.');
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    async function loadSharedDocument() {
      try {
        setIsLoading(true);
        setStatusMessage('Downloading study package & notes from cloud...');
        setProgressPercent(30);

        // Download shared package: try direct fetch first (files.catbox.moe supports CORS), fallback to proxy
        let response: Response;
        try {
          response = await fetch(src!);
          if (!response.ok) throw new Error(`Direct download status: ${response.status}`);
        } catch {
          const proxyUrl = `/api/share/fetch?url=${encodeURIComponent(src!)}`;
          response = await fetch(proxyUrl);
        }

        if (!response.ok) {
          throw new Error(`Failed to download shared package (status: ${response.status})`);
        }

        setProgressPercent(60);
        setStatusMessage('Verifying notes, diagrams & annotations...');

        const arrayBuffer = await response.arrayBuffer();
        if (isCancelled) return;

        const blob = new Blob([arrayBuffer]);

        // Attempt unpacking as .pdfnoter package
        const validation = await validateStudyFile(blob);

        if (validation.valid && validation.pdfBytes && validation.manifest) {
          setProgressPercent(85);
          setStatusMessage('Importing interactive notes into your local reader...');

          const importResult = await commitStudyFileImport(validation, 'merge');
          if (isCancelled) return;

          setProgressPercent(100);
          setActiveFile(importResult.file);
          setActiveDocument(importResult.documentRecord);
          setIsLoading(false);
          return;
        }

        // Fallback: If shared source was directly a PDF file
        setProgressPercent(80);
        setStatusMessage('Opening PDF document...');

        const fingerprint = await computePdfFingerprint(arrayBuffer);
        const pdfFile = new File([blob], customName.endsWith('.pdf') ? customName : `${customName}.pdf`, {
          type: 'application/pdf',
        });

        const docRecord = await storageService.saveDocumentMetadata({
          fingerprint,
          fileName: pdfFile.name,
          pageCount: 1,
          fileSize: pdfFile.size,
          lastOpenedAt: Date.now(),
        });

        if (isCancelled) return;

        setProgressPercent(100);
        setActiveFile(pdfFile);
        setActiveDocument(docRecord);
        setIsLoading(false);
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Error loading shared document:', err);
          setError(err.message || 'Failed to open shared document');
          setIsLoading(false);
        }
      }
    }

    loadSharedDocument();

    return () => {
      isCancelled = true;
    };
  }, [src, customName]);

  const handleBackToLibrary = () => {
    router.push('/');
  };

  // If successfully loaded, show the full interactive reader with all notes
  if (activeFile && activeDocument) {
    return (
      <PdfReaderView
        file={activeFile}
        documentRecord={activeDocument}
        onBackToLibrary={handleBackToLibrary}
      />
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 p-8 flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
            <BookOpen className="w-7 h-7" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 truncate max-w-xs">
              {customName}
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {statusMessage}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="w-full space-y-2">
            <div className="w-full h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-neutral-400">
              <span className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />
                Preparing interactive notes
              </span>
              <span>{progressPercent}%</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-rose-200 dark:border-rose-900/50 p-8 flex flex-col items-center text-center space-y-5 animate-in fade-in duration-200">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
            Cannot Open Shared Document
          </h2>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 max-w-xs">
            {error || 'The shared study file could not be loaded or the link is invalid.'}
          </p>
        </div>

        <button
          onClick={handleBackToLibrary}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium shadow-xs transition cursor-pointer"
        >
          <span>Go to Library</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      }
    >
      <SharePageContent />
    </Suspense>
  );
}
