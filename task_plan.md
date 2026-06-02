# Task Plan

## Goal
Restore the saved original Perler Beads workbench behavior from `origins/` as the baseline, remove public/community pieces, and add polished light-theme design and motion without broadly changing the original workflow.

## Status
- [x] Keep original four-mode workbench structure: optimize, edit, preview, focus.
- [x] Remove public/community/share/open-source/gallery/support/privacy/message-board traces from current app surface.
- [x] Keep all color systems: MARD, COCO, 漫漫, 盼盼, 咪小窝.
- [x] Use English app name `BeadForge`; default theme is light black/white; default font is serif.
- [x] Keep MARD 291 badge centered.
- [x] Preserve original editor layout: left vertical tool rail centered, right 320px side panel outside canvas area.
- [x] Restore original-like editor minimap: floating, draggable, resizable, with tool rail toggle.
- [x] Restore layer controls distinction: sticker button uses a diamond/star symbol, layer button uses plus.
- [x] Keep brush/eraser drag painting behavior and prevent duplicate touch-end paint.
- [x] Remove fixed URL watermark behavior; download signature is optional and off by default.
- [x] Make preview/focus modes live inside the same workbench style.
- [x] Add motion and polished interaction styling across tabs, panels, palette, buttons, minimap, download options, and focus strips.
- [x] Verify with TypeScript and production build.

## Remaining Notes
- Browser file chooser cannot be automated directly in the in-app browser, so import UI was visually checked and build/type checks passed. The underlying import code path remains intact.
- `origins/` is preserved untouched.
