# Progress

## 2026-06-02

- Added `src/components/EditorMinimap.tsx`: floating edit-mode minimap with drag, resize, close, and click-to-center behavior.
- Updated `EditorToolRail` to include a minimap toggle button while keeping the original left-centered vertical rail.
- Rendered the minimap inside the edit canvas stage, not inside the right layer/panel area.
- Changed download watermark/signature default to off in both page state and `imageDownloader` fallback.
- Removed stale `FocusModePreDownloadModal` and old `/focus` page now that focus mode is integrated into the main workbench.
- Added/expanded animations for tool buttons, minimap, download option rows, panel cards, mode tabs, preview board, focus bottom palette, and reduced-motion handling.
- Fixed touch drag painting so brush/eraser do not repeat the initial cell again on touch end.
- Verified: `npx tsc --noEmit` passed.
- Verified: `npm run build` passed after stopping dev server and clearing `.next`.
- Restarted local dev server at `http://localhost:3000/`.
