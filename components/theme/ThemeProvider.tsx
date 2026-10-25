'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  actualTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  invertPdf: boolean;
  setInvertPdf: (invert: boolean) => void;
  toggleInvertPdf: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>('light');
  const [invertPdf, setInvertPdfState] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);

  // Load saved preferences on mount
  useEffect(() => {
    setMounted(true);
    try {
      const savedTheme = localStorage.getItem('theme') as Theme | null;
      if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
        setThemeState(savedTheme);
      }

      const savedInvert = localStorage.getItem('invert_pdf');
      if (savedInvert !== null) {
        setInvertPdfState(savedInvert === 'true');
      } else {
        setInvertPdfState(false);
      }
    } catch {
      // Ignore localStorage access restrictions
    }
  }, []);

  // Update .dark class and data-theme on <html> whenever theme changes
  useEffect(() => {
    if (!mounted) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      let resolved: 'light' | 'dark' = 'light';

      if (theme === 'system') {
        resolved = mediaQuery.matches ? 'dark' : 'light';
      } else {
        resolved = theme;
      }

      setActualTheme(resolved);

      const root = document.documentElement;
      if (resolved === 'dark') {
        root.classList.add('dark');
        root.setAttribute('data-theme', 'dark');
      } else {
        root.classList.remove('dark');
        root.setAttribute('data-theme', 'light');
      }
    };

    applyTheme();

    const handleChange = () => {
      if (theme === 'system') {
        applyTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, mounted]);

  const setTheme = (nextTheme: Theme) => {
    setThemeState(nextTheme);
    try {
      localStorage.setItem('theme', nextTheme);
    } catch {
      // Ignore
    }
  };

  const toggleTheme = () => {
    const next = actualTheme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  };

  const setInvertPdf = (nextInvert: boolean) => {
    setInvertPdfState(nextInvert);
    try {
      localStorage.setItem('invert_pdf', String(nextInvert));
    } catch {
      // Ignore
    }
  };

  const toggleInvertPdf = () => {
    setInvertPdf(!invertPdf);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        actualTheme,
        setTheme,
        toggleTheme,
        invertPdf,
        setInvertPdf,
        toggleInvertPdf,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
