'use client';

import React from 'react';
import { Sun, Moon, Eye } from 'lucide-react';
import { useTheme } from './ThemeProvider';

interface ThemeToggleProps {
  showPdfInvertOption?: boolean;
  className?: string;
}

export function ThemeToggle({ showPdfInvertOption = false, className = '' }: ThemeToggleProps) {
  const { actualTheme, toggleTheme, invertPdf, toggleInvertPdf } = useTheme();

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {/* Dark/Light mode toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition active:scale-95 cursor-pointer"
        title={actualTheme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
        aria-label={actualTheme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
      >
        {actualTheme === 'dark' ? (
          <Sun className="w-4 h-4 text-amber-400 transition-transform duration-200 rotate-0 hover:rotate-45" />
        ) : (
          <Moon className="w-4 h-4 text-indigo-600 dark:text-indigo-400 transition-transform duration-200 -rotate-12 hover:rotate-0" />
        )}
      </button>

      {/* Optional PDF Page Inversion (Dark Canvas reading mode) */}
      {showPdfInvertOption && (
        <button
          type="button"
          onClick={toggleInvertPdf}
          className={`p-1.5 rounded-lg text-xs font-medium transition active:scale-95 items-center gap-1 cursor-pointer hidden sm:flex ${
            invertPdf
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
          title={invertPdf ? 'Disable PDF page dark inversion' : 'Invert PDF pages for dark room reading'}
          aria-label={invertPdf ? 'Disable PDF page dark inversion' : 'Invert PDF pages for dark room reading'}
        >
          <Eye className="w-3.5 h-3.5" />
          <span className="hidden xl:inline text-[11px]">Night PDF</span>
        </button>
      )}
    </div>
  );
}
