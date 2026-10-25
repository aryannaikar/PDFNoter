# Offline PDF Study Reader

A privacy-focused, local-first **Offline PDF Study Reader** Progressive Web App (PWA) designed for students. The core innovation is **page-specific and text-linked study notes that remain hidden until the user clicks their markers**, preserving a clean reading canvas.

---

## Key Features

1. **Local-First & Complete Privacy**:
   - Original PDFs remain on the user's filesystem and are never uploaded to any server.
   - All document metadata, notes, annotations, bookmarks, and reading progress are stored locally in **IndexedDB** using **Dexie.js**.
   - No authentication, accounts, or telemetry required.

2. **Hidden Note Markers & Floating Cards**:
   - **Page Notes**: Add revision reminders, formulas, or summaries to any page. A subtle marker appears in the margin; clicking it opens a floating card with title, multiline body, and optional research source URL.
   - **Text-Linked Annotations**: Select words, sentences, or paragraphs in the PDF to reveal the "Add study note" contextual action. Annotations highlight the text and place an accessible marker that dynamically scales with any zoom level.

3. **SHA-256 PDF Fingerprinting**:
   - Computes a SHA-256 content hash using the browser's Web Crypto API.
   - Reopening the same PDF automatically reconnects all existing notes, annotations, bookmarks, and restores the exact reading page and zoom level.

4. **PDF.js High-Definition Rendering & Text Search**:
   - Crisp rendering on high-DPI displays with on-demand/lazy page virtualization for high-page-count PDFs.
   - Native browser text selection via PDF.js text layer.
   - Full-text asynchronous search across pages with snippet previews, navigation, and match counts.

5. **Bookmarks & Reading Progress**:
   - Label and save page bookmarks.
   - Debounced progress persistence restores your last read page and zoom level upon document reopen.

6. **Backup & Restore**:
   - Export all document metadata, notes, annotations, bookmarks, and reading progress to a versioned JSON backup file (`schemaVersion: 1`).
   - Import previously saved backups with safety validation, format checking, and choice of **Merge (Deduplicate & Add)** or **Replace All**.

7. **Installable PWA & 100% Offline Support**:
   - Web App Manifest and custom Service Worker cache the application shell, static assets, and the local `pdf.worker.min.mjs`.
   - Once loaded and cached, PDFs can be opened, read, and annotated completely offline without network connectivity.

8. **Future Desktop Architecture**:
   - Storage service layer strictly abstracts database operations behind `IStorageService`, enabling clean drop-in support for desktop wrappers such as Tauri with SQLite.

---

## Technology Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict type checking)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **PDF Engine**: [PDF.js](https://mozilla.github.io/pdf.js/) (`pdfjs-dist`)
- **Database**: [Dexie.js](https://dexie.org/) (IndexedDB wrapper)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Unit Testing**: [Vitest](https://vitest.dev/) with `jsdom` and `fake-indexeddb`
- **End-to-End Testing**: [Playwright](https://playwright.dev/)

---

## Getting Started

### Prerequisites

- Node.js 18+ (tested on Node v24)
- npm 9+

### 1. Installation

```bash
npm install
```

### 2. Run Locally in Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Run Automated Unit Tests

Runs 11 Vitest unit tests verifying Dexie database migrations, CRUD operations, multi-note handling, URL validation, coordinate normalization, and backup export/import:

```bash
npm test
```

### 4. Run End-to-End (E2E) Tests

Runs the Playwright automated suite validating the full user flow (selecting PDF, adding page notes, verifying initial hidden state, revealing on click, editing, bookmarking, and restoring from library):

```bash
npm run test:e2e
```

### 5. Type Checking & Linting

```bash
npx tsc --noEmit
npm run lint
```

### 6. Production Build

```bash
npm run build
npm start
```

---

## User Guide & Workflows

### Opening a Document
- Drag and drop any `.pdf` file into the upload zone or click **Select PDF File**.
- The reader calculates the SHA-256 fingerprint. If you have annotated this document before, all your notes and reading progress are immediately restored.

### Adding a Page Note
1. Navigate to the page you want to annotate.
2. Click **Add Note** in the top reader toolbar.
3. Enter an optional title, your explanation, and an optional research URL (e.g. Wikipedia reference).
4. Click **Save Note**.
5. The note body is hidden and a marker appears in the top-right margin.
6. Click the marker anytime to view, edit, or delete the note.

### Adding a Text Highlight / Annotation
1. Select any word or passage in the PDF document using your cursor.
2. A floating **Add study note** button appears directly above your selection.
3. Click the button to open the note editor with the selected text pre-associated.
4. Save the note. The text will receive a subtle highlight and a marker pin.
5. Click either the highlight or marker pin to open the note card.

### Search and Bookmarks
- **Search (Ctrl+F / ⌘+F)**: Search across all pages with context snippets. Use arrow buttons to cycle between matches.
- **Bookmarks**: Open the Bookmarks panel on the right to bookmark pages and jump between them.

### Backup & Restore
1. In the Library screen, click **Backup & Restore**.
2. Click **Export JSON** to download a portable snapshot of all your notes and metadata.
3. To restore on another device or browser, select your JSON backup and choose **Merge** or **Replace All**.

---

## Offline PWA Usage

1. Open the application in Google Chrome, Edge, or Safari.
2. Click the **Install** icon in the address bar (or "Add to Home Screen" on mobile/tablet).
3. The service worker caches the application shell and PDF.js worker.
4. You can now launch the app from your desktop or home screen with **no internet connection required**.

---

## Architecture Overview

```
pdf_notes/
├── app/
│   ├── layout.tsx                # PWA meta, manifest link, PwaProvider
│   ├── page.tsx                  # Root switcher (LibraryView <-> PdfReaderView)
│   └── globals.css               # Design system & PDF.js text layer selection rules
├── components/
│   ├── library/
│   │   ├── LibraryView.tsx       # Home library, drag & drop, recent docs
│   │   └── BackupModal.tsx       # JSON backup export and validated import
│   ├── reader/
│   │   ├── PdfReaderView.tsx     # Main reader controller, progress restoration
│   │   ├── ReaderToolbar.tsx     # Toolbar with page jump, zoom, notes badge
│   │   ├── PdfPageItem.tsx       # Virtualized page item with canvas & text layer
│   │   ├── PageAnnotationLayer.tsx # Subtle markers, highlights & note popovers
│   │   ├── SearchBar.tsx         # Asynchronous full-text search with snippets
│   │   ├── BookmarksDrawer.tsx   # Page bookmarking & navigation
│   │   └── NotesDrawer.tsx       # Overview & filter for all notes in document
│   ├── notes/
│   │   ├── NoteEditorModal.tsx   # Note editor with unsaved changes warning
│   │   └── NoteCard.tsx          # Floating popover revealing hidden note content
│   └── pwa/
│       └── PwaProvider.tsx       # Service worker lifecycle & offline indicator
├── lib/
│   ├── db/
│   │   └── database.ts           # Dexie database & storage quota utilities
│   ├── pdf/
│   │   ├── fingerprint.ts        # SHA-256 Web Crypto / fallback hasher
│   │   ├── selection.ts          # Selection anchor extraction & normalization
│   │   └── search.ts             # Asynchronous multi-page text search
│   └── utils/
│       └── url.ts                # Safe URL validation (blocks javascript:, etc.)
├── services/storage/
│   ├── IStorageService.ts        # Clean interface contract for Browser / Desktop
│   └── dexieStorageService.ts    # Production Dexie repository implementation
├── public/
│   ├── manifest.json             # Web App Manifest
│   ├── sw.js                     # Versioned offline service worker
│   ├── pdf.worker.min.mjs        # Bundled PDF.js worker (offline)
│   ├── icon-192.png              # PWA icon
│   └── icon-512.png              # PWA icon
├── tests/
│   ├── setup.ts                  # Vitest fake-indexeddb setup
│   ├── storage.test.ts           # 11 unit tests for storage, notes, backup
│   └── fixtures/sample.pdf       # 2-page test PDF fixture
└── e2e/
    └── reader.spec.ts            # Playwright end-to-end integration tests
```

---

## Limitations and Future Desktop Path

- **OCR for Scanned PDFs**: Text selection and search require PDFs with text streams. Scanned image-only PDFs can be viewed and annotated with page-level notes, but text selection requires OCR, which is planned for version 2.
- **Browser Storage Eviction**: While the app requests persistent browser storage (`navigator.storage.persist()`), manual browser cache purges can delete local storage. Regular JSON backups are recommended.
- **Desktop Application (Tauri)**: All business logic is decoupled through `IStorageService`. A Tauri wrapper can implement SQLite or file-system JSON storage using this exact interface without changing application components.
