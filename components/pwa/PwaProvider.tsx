'use client';

import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [isOffline, setIsOffline] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // 1. Monitor online/offline events
    if (typeof window !== 'undefined') {
      setIsOffline(!navigator.onLine);

      const handleOnline = () => setIsOffline(false);
      const handleOffline = () => setIsOffline(true);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // 2. Register Service Worker in production/supporting browsers
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            registration.onupdatefound = () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    setUpdateAvailable(true);
                  }
                };
              }
            };
          })
          .catch((err) => {
            console.warn('Service worker registration failed:', err);
          });
      }

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <>
      {/* Offline Status Banner */}
      {isOffline && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 left-4 z-50 flex items-center gap-2 px-3.5 py-2 bg-neutral-900 text-white text-xs font-medium rounded-xl shadow-xl animate-in slide-in-from-bottom duration-200"
        >
          <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Working Offline. Local notes and reading continue normally.</span>
        </div>
      )}

      {/* SW Update Notification */}
      {updateAvailable && (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-2.5 bg-indigo-900 text-white text-xs font-medium rounded-xl shadow-2xl border border-indigo-700 animate-in slide-in-from-bottom duration-200"
        >
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-indigo-300 animate-spin" />
            <span>A new version of Study Reader is ready.</span>
          </div>
          <button
            onClick={handleReload}
            className="px-2.5 py-1 bg-white text-indigo-900 hover:bg-neutral-100 font-semibold rounded-lg transition"
          >
            Reload
          </button>
        </div>
      )}

      {children}
    </>
  );
}
