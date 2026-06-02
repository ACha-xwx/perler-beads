# Findings

## 2026-06-02

- The saved original site under `origins/` confirms the main workbench structure: top mode tabs, left tool rail vertically centered, right 320px side panel, and a floating draggable/resizable minimap in edit mode.
- Current source already had the restored conversion algorithm pieces: dominant/average color mapping, RGB Euclidean distance, BFS-like color merge, and border flood-fill background marking.
- The current app had already removed visible community/share/gallery/open-source links from the header, but stale focus modal/page files remained. They were removed to avoid inconsistent pages.
- The fixed old URL watermark is gone. Download signature remains available as an optional user-controlled export setting, default off.
- In-app browser can open the site and visually confirmed the home workbench, app name, light theme, centered MARD/291 badge, and upload card. Its file chooser/localStorage write paths are restricted, so deeper import automation was not possible there.
- Running `next build` while `next dev` was still active caused a transient `.next` cache conflict (`/_document` ENOENT). Stopping dev, clearing `.next`, and rerunning build resolved it.
