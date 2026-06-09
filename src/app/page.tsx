'use client';

import React, { useState, useRef, ChangeEvent, DragEvent, useEffect, useMemo, useCallback } from 'react';
import InstallPWA from '../components/InstallPWA';
import { APP_NAME, APP_TAGLINE } from '../config/brand';
import {
  appearanceFonts,
  appearanceThemes,
  defaultAppearanceSettings,
  normalizeAppearanceSettings,
  AppearanceSettings,
  AppearanceFont,
  AppearanceTheme,
} from '../config/appearance';

// 导入像素化工具和类型
import {
  PixelationMode,
  calculatePixelGrid,
  PaletteColor,
  MappedPixel,
  hexToRgb,
  colorDistance,
  findClosestPaletteColor
} from '../utils/pixelation';

// 导入新的类型和组件
import { GridDownloadOptions } from '../types/downloadTypes';
import DownloadSettingsModal, { gridLineColorOptions } from '../components/DownloadSettingsModal';
import { downloadImage, importCsvData } from '../utils/imageDownloader';

import { 
  colorSystemOptions, 
  convertPaletteToColorSystem, 
  getColorKeyByHex,
  getMardToHexMapping,
  sortColorsByHue,
  ColorSystem 
} from '../utils/colorSystemUtils';
import PixelatedPreviewCanvas from '../components/PixelatedPreviewCanvas';
import type { CanvasInteractionPhase } from '../components/PixelatedPreviewCanvas';
import EditorMinimap from '../components/EditorMinimap';
import GridTooltip from '../components/GridTooltip';
import CustomPaletteEditor from '../components/CustomPaletteEditor';
import { EditorSidePanel, EditorTool, EditorToolRail } from '../components/EditorTools';
import MagnifierTool from '../components/MagnifierTool';
import MagnifierSelectionOverlay from '../components/MagnifierSelectionOverlay';
import { loadPaletteSelections, savePaletteSelections, presetToSelections, PaletteSelections } from '../utils/localStorageUtils';
import { TRANSPARENT_KEY, transparentColorData } from '../utils/pixelEditingUtils';
import FocusCanvas from '../components/FocusCanvas';
import ColorStatusBar from '../components/ColorStatusBar';
import ColorPanel from '../components/ColorPanel';
import ProgressBar from '../components/ProgressBar';
import ToolBar from '../components/ToolBar';
import CelebrationAnimation from '../components/CelebrationAnimation';
import CompletionCard from '../components/CompletionCard';
import {
  getAllConnectedRegions,
  getConnectedRegion,
  getRegionCenter,
  isRegionCompleted,
  sortRegionsByDistance,
  sortRegionsBySize,
} from '../utils/floodFillUtils';

type WorkspaceMode = 'optimize' | 'edit' | 'preview' | 'focus';
type GridPoint = { row: number; col: number };
type SelectionArea = { startRow: number; startCol: number; endRow: number; endCol: number } | null;
type GuidanceMode = 'nearest' | 'largest' | 'edge-first';
type PreviewMaterial = 'matte' | 'glitter' | 'towel' | 'enamel';
type PreviewBackground = 'white' | 'cream' | 'beige' | 'dark' | 'black' | 'wood' | 'custom';

interface PreviewSettings {
  material: PreviewMaterial;
  edgeEnabled: boolean;
  edgeIntensity: number;
  shadowEnabled: boolean;
  shadowAngle: number;
  shadowDistance: number;
  background: PreviewBackground;
  customBackground: string;
  brandText: string;
}

interface EditorLayer {
  id: string;
  name: string;
  type: 'base' | 'layer' | 'sticker';
  visible: boolean;
  locked: boolean;
}

type StickerShape = 'heart' | 'star' | 'circle' | 'diamond';
type StickerStyle = 'solid' | 'hollow' | 'striped';

interface StickerDraft {
  shape: StickerShape;
  style: StickerStyle;
  color: string;
  size: number;
}

interface StickerInstance extends StickerDraft {
  id: string;
  layerId: string;
  x: number;
  y: number;
}

interface PaintStrokeState {
  active: boolean;
  snapshotSaved: boolean;
  lastPoint: GridPoint | null;
  touchedCells: Set<string>;
  workingData: MappedPixel[][] | null;
}

interface FocusWorkbenchState {
  currentColor: string;
  selectedCell: GridPoint | null;
  canvasScale: number;
  canvasOffset: { x: number; y: number };
  completedCells: Set<string>;
  colorProgress: Record<string, { completed: number; total: number }>;
  recommendedRegion: GridPoint[] | null;
  recommendedCell: GridPoint | null;
  guidanceMode: GuidanceMode;
  gridSectionInterval: number;
  showSectionLines: boolean;
  sectionLineColor: string;
  enableCelebration: boolean;
  showCelebration: boolean;
  showCompletionCard: boolean;
  showColorPanel: boolean;
  showSettingsPanel: boolean;
  isPaused: boolean;
  totalElapsedTime: number;
  lastResumeTime: number;
}

interface FocusColorInfo {
  color: string;
  name: string;
  total: number;
  completed: number;
}

const DEFAULT_GRANULARITY = 51;
const MERGE_THRESHOLD_HELP = '把相近颜色合并成同一色块。0 更保留细节，越高越平滑、颜色越少。';
const DRAFT_STORAGE_KEY = 'beadforgeDraft';
const APPEARANCE_STORAGE_KEY = 'beadforgeAppearance';
const APPEARANCE_VERSION = 2;
const IMPORT_FILE_ACCEPT = 'image/jpeg, image/png, image/gif, .csv, text/csv, application/csv, text/plain';

// 添加自定义动画样式
const floatAnimation = `
  @keyframes beadFloat {
    0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
    50% { transform: translate3d(0, -8px, 0) scale(1.05); }
  }

  @keyframes stageIn {
    from { opacity: 0; transform: translateY(18px) scale(0.985); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @keyframes sweepGlow {
    from { transform: translateX(-140%) skewX(-18deg); opacity: 0; }
    20% { opacity: 1; }
    to { transform: translateX(150%) skewX(-18deg); opacity: 0; }
  }

  @keyframes gridDrift {
    from { background-position: 0 0, 0 0, 0 0; }
    to { background-position: 44px 44px, -36px 28px, 0 0; }
  }

  @keyframes pulseRing {
    0%, 100% { box-shadow: 0 0 0 0 rgba(var(--accent-rgb), 0.25); }
    50% { box-shadow: 0 0 0 10px rgba(var(--accent-rgb), 0); }
  }

  @keyframes paletteBackdropIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes palettePanelIn {
    from { opacity: 0; transform: translateY(22px) scale(0.975); filter: saturate(0.8); }
    to { opacity: 1; transform: translateY(0) scale(1); filter: saturate(1); }
  }

  @keyframes paletteCellIn {
    from { opacity: 0; transform: translateY(12px) scale(0.92); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @keyframes paletteGlowSweep {
    from { transform: translateX(-140%) rotate(18deg); opacity: 0; }
    28% { opacity: 1; }
    to { transform: translateX(180%) rotate(18deg); opacity: 0; }
  }

  @keyframes paletteTabPop {
    0% { transform: scale(0.94); }
    70% { transform: scale(1.04); }
    100% { transform: scale(1); }
  }

  @keyframes installFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }

  @keyframes railSlideIn {
    from { opacity: 0; margin-left: -18px; }
    to { opacity: 1; margin-left: 0; }
  }

  @keyframes panelSlideIn {
    from { opacity: 0; transform: translate3d(24px, 0, 0) scale(0.985); }
    to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
  }

  @keyframes panelRiseIn {
    from { opacity: 0; transform: translate3d(0, 18px, 0) scale(0.985); }
    to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
  }

  @keyframes toolPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(var(--accent-rgb), 0.22); }
    50% { box-shadow: 0 0 0 8px rgba(var(--accent-rgb), 0); }
  }

  @keyframes swatchPop {
    from { opacity: 0; transform: translateY(10px) scale(0.88); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @keyframes cardLiftIn {
    from { opacity: 0; transform: translateY(14px) scale(0.985); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @keyframes previewBoardIn {
    from { opacity: 0; transform: translateY(18px) scale(0.97); filter: blur(4px); }
    to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
  }

  @keyframes previewPaperSettle {
    from { opacity: 0; transform: translateY(14px) scale(0.985); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @keyframes beadShimmer {
    from { background-position: -120% 0; }
    to { background-position: 220% 0; }
  }

  @keyframes minimapIn {
    from { opacity: 0; transform: translate(-8px, -8px) scale(0.94); }
    to { opacity: 1; transform: translate(0, 0) scale(1); }
  }

  @keyframes optionRowIn {
    from { opacity: 0; transform: translateX(14px) scale(0.985); }
    to { opacity: 1; transform: translateX(0) scale(1); }
  }

  @keyframes toolbarSlideUp {
    from { opacity: 0; transform: translateY(18px) scale(0.985); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @keyframes focusChipPop {
    from { opacity: 0; transform: translateY(10px) scale(0.9); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @keyframes focusBeadPulse {
    0%, 100% { box-shadow: inset 0 1px 0 rgba(255,255,255,0.34), 0 0 0 0 rgba(var(--accent-rgb),0.24); }
    50% { box-shadow: inset 0 1px 0 rgba(255,255,255,0.34), 0 0 0 10px rgba(var(--accent-rgb),0); }
  }

  @keyframes brandStripIn {
    from { opacity: 0; transform: translateY(-6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .animate-float {
    animation: beadFloat 5.8s cubic-bezier(0.45, 0, 0.55, 1) infinite;
    will-change: transform;
  }

  .workspace-enter {
    animation: stageIn 760ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .glass-action {
    position: relative;
    overflow: hidden;
    min-height: 44px;
    border-radius: 12px;
    border: 1px solid rgba(var(--line-rgb), 0.38);
    background:
      linear-gradient(135deg, rgba(255,255,255,0.74), rgba(255,255,255,0.34)),
      rgba(var(--panel-rgb), 0.72);
    color: var(--text);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.68), 0 12px 28px rgba(var(--shadow-rgb), 0.09);
    backdrop-filter: blur(18px) saturate(1.25);
    -webkit-backdrop-filter: blur(18px) saturate(1.25);
    transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1), border-color 240ms ease, box-shadow 240ms ease, background 240ms ease;
  }

  .glass-action:hover {
    transform: translateY(-1px);
    border-color: rgba(var(--accent-rgb), 0.38);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.78), 0 18px 40px rgba(var(--shadow-rgb), 0.13);
  }

  .glass-action:active {
    transform: translateY(1px) scale(0.985);
  }

  .glass-action::after {
    content: "";
    position: absolute;
    inset: 0;
    width: 38%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.56), transparent);
    transform: translateX(-140%) skewX(-18deg);
    pointer-events: none;
  }

  .glass-action:hover::after {
    animation: sweepGlow 1200ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .glass-action-primary {
    background:
      linear-gradient(135deg, rgba(var(--accent-rgb), 0.92), rgba(var(--accent-2-rgb), 0.78)),
      rgba(var(--accent-rgb), 0.84);
    color: white;
    border-color: rgba(var(--accent-rgb), 0.5);
  }

  .glass-action-active {
    background:
      linear-gradient(135deg, rgba(var(--accent-rgb), 0.2), rgba(var(--accent-2-rgb), 0.11)),
      rgba(255,255,255,0.66);
    border-color: rgba(var(--accent-rgb), 0.44);
    color: var(--text);
    animation: pulseRing 5.2s ease-in-out infinite;
  }

  .glass-panel {
    border: 1px solid rgba(var(--line-rgb), 0.32);
    background: linear-gradient(145deg, rgba(255,255,255,0.82), rgba(255,255,255,0.48));
    box-shadow: 0 24px 70px rgba(var(--shadow-rgb), 0.1);
    backdrop-filter: blur(22px) saturate(1.28);
    -webkit-backdrop-filter: blur(22px) saturate(1.28);
  }

  .tech-grid-bg {
    background:
      linear-gradient(90deg, rgba(var(--line-rgb), 0.12) 1px, transparent 1px),
      linear-gradient(180deg, rgba(var(--line-rgb), 0.09) 1px, transparent 1px),
      radial-gradient(circle at 50% 48%, rgba(var(--accent-rgb), 0.09), transparent 34%),
      linear-gradient(135deg, var(--page-a), var(--page-b) 52%, var(--page-c));
    background-size: 44px 44px, 36px 36px, auto, auto;
    animation: gridDrift 38s linear infinite;
  }

  .theme-swatch-active {
    box-shadow: 0 0 0 3px rgba(var(--accent-rgb), 0.18), 0 16px 32px rgba(var(--shadow-rgb), 0.1);
  }

  .install-pwa-button {
    animation: installFloat 6.4s cubic-bezier(0.45, 0, 0.55, 1) infinite;
  }

  .mode-tab {
    animation: cardLiftIn 560ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .editor-tool-rail {
    animation: railSlideIn 620ms cubic-bezier(0.16, 1, 0.3, 1) both;
    scrollbar-width: thin;
    scrollbar-color: rgba(var(--line-rgb),0.38) transparent;
  }

  .editor-tool-rail button {
    position: relative;
    overflow: hidden;
  }

  .editor-tool-rail button::after {
    content: "";
    position: absolute;
    inset: 20%;
    border-radius: inherit;
    background: radial-gradient(circle, rgba(var(--accent-rgb),0.22), transparent 70%);
    opacity: 0;
    transform: scale(0.65);
    transition: opacity 260ms ease, transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
    pointer-events: none;
  }

  .editor-tool-rail button:hover::after {
    opacity: 1;
    transform: scale(1.5);
  }

  .editor-side-panel {
    animation: panelSlideIn 680ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .editor-panel-card,
  .preview-panel-card,
  .focus-side-card,
  .download-panel-card,
  .settings-panel-card {
    position: relative;
    overflow: hidden;
    border-radius: 16px;
    border: 1px solid rgba(var(--line-rgb),0.16);
    background:
      radial-gradient(circle at 12% 0%, rgba(var(--accent-rgb),0.09), transparent 42%),
      linear-gradient(135deg, rgba(255,255,255,0.82), rgba(255,255,255,0.46)),
      rgba(var(--panel-rgb),0.72);
    color: var(--text);
    padding: 14px;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.74), 0 18px 44px rgba(var(--shadow-rgb),0.11);
    backdrop-filter: blur(16px) saturate(1.15);
    -webkit-backdrop-filter: blur(16px) saturate(1.15);
    animation: cardLiftIn 720ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .preview-stage,
  .focus-stage,
  .editor-stage {
    background-color: var(--workspace-bg, rgba(var(--panel-rgb),0.52));
    background-image: radial-gradient(rgba(var(--line-rgb),0.14) 1px, transparent 0);
    background-size: 18px 18px;
  }

  .preview-board {
    animation: previewBoardIn 780ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .preview-board::before {
    content: "";
    position: absolute;
    inset: 12px;
    border-radius: inherit;
    pointer-events: none;
    background:
      radial-gradient(circle at 12% 18%, rgba(255,255,255,0.34), transparent 28%),
      radial-gradient(circle at 88% 82%, rgba(var(--accent-rgb),0.12), transparent 30%);
    opacity: 0.72;
  }

  .preview-art-surface {
    transform-origin: center center;
    animation: previewPaperSettle 840ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .preview-signature-zone {
    animation: brandStripIn 720ms cubic-bezier(0.16, 1, 0.3, 1) both;
    animation-delay: 120ms;
  }

  .preview-art {
    image-rendering: pixelated;
  }

  .preview-material-glitter::after,
  .preview-material-enamel::after,
  .preview-material-towel::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    border-radius: inherit;
  }

  .preview-material-glitter::after {
    background:
      radial-gradient(circle at 18% 20%, rgba(255,255,255,0.55) 0 1px, transparent 2px),
      radial-gradient(circle at 70% 62%, rgba(255,255,255,0.42) 0 1px, transparent 2px),
      linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent);
    background-size: 18px 18px, 22px 22px, 180% 100%;
    mix-blend-mode: screen;
    animation: beadShimmer 6.2s ease-in-out infinite;
  }

  .preview-material-enamel::after {
    background: linear-gradient(135deg, rgba(255,255,255,0.5), transparent 42%, rgba(0,0,0,0.08));
  }

  .preview-material-towel::after {
    background:
      repeating-linear-gradient(45deg, rgba(0,0,0,0.05) 0 1px, transparent 1px 4px),
      repeating-linear-gradient(-45deg, rgba(255,255,255,0.15) 0 1px, transparent 1px 5px);
    opacity: 0.62;
  }

  .floating-minimap {
    animation: minimapIn 560ms cubic-bezier(0.16, 1, 0.3, 1) both;
    touch-action: none;
  }

  .floating-minimap canvas {
    transition: filter 260ms ease, transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .floating-minimap canvas:hover {
    filter: saturate(1.12) contrast(1.04);
    transform: scale(1.01);
  }

  .download-option-row {
    animation: optionRowIn 560ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .focus-bottom-palette {
    animation: toolbarSlideUp 620ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .focus-status-bar,
  .focus-progress-bar,
  .focus-toolbar {
    animation: toolbarSlideUp 580ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .focus-current-bead {
    animation: focusBeadPulse 5.2s ease-in-out infinite;
  }

  .focus-color-chip {
    animation: focusChipPop 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
    transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1), background 320ms ease, border-color 320ms ease, box-shadow 320ms ease, opacity 320ms ease;
  }

  .focus-color-chip:hover {
    transform: translateY(-3px) scale(1.03);
    box-shadow: 0 14px 26px rgba(var(--shadow-rgb),0.12);
  }

  .focus-color-chip-active {
    box-shadow: 0 0 0 2px rgba(var(--accent-rgb),0.18), 0 16px 30px rgba(var(--shadow-rgb),0.12);
  }

  .focus-canvas-transform {
    will-change: transform;
  }

  .canvas-scale-control {
    animation: toolbarSlideUp 620ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .canvas-scale-control button {
    transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1), background 320ms ease, color 320ms ease;
  }

  .canvas-scale-control button:hover {
    transform: translateY(-1px);
  }

  .preview-brand-strip {
    animation: brandStripIn 720ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .settings-panel-card {
    border-color: rgba(var(--line-rgb),0.18);
  }

  .settings-shell {
    border: 1px solid rgba(var(--line-rgb),0.22);
    background:
      radial-gradient(circle at 20% 0%, rgba(var(--accent-rgb),0.12), transparent 34%),
      linear-gradient(145deg, rgba(255,255,255,0.92), rgba(255,255,255,0.68));
    color: var(--text);
    box-shadow: 0 34px 100px rgba(var(--shadow-rgb),0.22), inset 0 1px 0 rgba(255,255,255,0.8);
    backdrop-filter: blur(18px) saturate(1.2);
    -webkit-backdrop-filter: blur(18px) saturate(1.2);
  }

  .settings-head {
    background:
      linear-gradient(90deg, rgba(var(--accent-rgb),0.08), rgba(var(--accent-2-rgb),0.05)),
      rgba(255,255,255,0.36);
  }

  .settings-metric {
    border: 1px solid rgba(var(--line-rgb),0.13);
    background: rgba(255,255,255,0.54);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.64);
  }

  .theme-toggle {
    position: relative;
    height: 28px;
    width: 48px;
    flex: 0 0 48px;
    border-radius: 999px;
    border: 1px solid rgba(var(--line-rgb),0.26);
    background: rgba(255,255,255,0.35);
    transition: transform 360ms cubic-bezier(0.16, 1, 0.3, 1), border-color 360ms ease, background 360ms ease, box-shadow 360ms ease;
  }

  .theme-toggle-on {
    border-color: rgba(var(--accent-rgb),0.58);
    background: rgba(var(--accent-rgb),0.18);
    box-shadow: 0 0 24px rgba(var(--accent-rgb),0.18);
  }

  .theme-toggle-knob {
    position: absolute;
    top: 50%;
    left: 4px;
    height: 20px;
    width: 20px;
    border-radius: 999px;
    background: rgba(255,255,255,0.95);
    box-shadow: 0 6px 14px rgba(var(--shadow-rgb),0.18);
    transform: translateY(-50%);
    transition: transform 420ms cubic-bezier(0.16, 1, 0.3, 1), background 360ms ease;
  }

  .theme-toggle-on .theme-toggle-knob {
    transform: translate(19px, -50%);
    background: rgb(var(--accent-rgb));
  }

  .control-range {
    --range-thumb-size: 16px;
    --range-track-height: 6px;
    width: 100%;
    height: 24px;
    margin: 0;
    appearance: none;
    -webkit-appearance: none;
    background: transparent;
    cursor: pointer;
  }

  .control-range::-webkit-slider-runnable-track {
    height: var(--range-track-height);
    border-radius: 999px;
    border: 1px solid rgba(var(--line-rgb),0.26);
    background:
      linear-gradient(90deg, rgb(var(--accent-rgb)), rgb(var(--accent-rgb))) 0/var(--range-progress, 0%) 100% no-repeat,
      rgba(255,255,255,0.56);
    box-shadow: inset 0 1px 2px rgba(var(--shadow-rgb),0.1);
  }

  .control-range::-webkit-slider-thumb {
    width: var(--range-thumb-size);
    height: var(--range-thumb-size);
    margin-top: calc((var(--range-track-height) - var(--range-thumb-size)) / 2 - 1px);
    appearance: none;
    -webkit-appearance: none;
    border-radius: 999px;
    border: 2px solid rgb(var(--accent-rgb));
    background: rgb(var(--accent-rgb));
    box-shadow: 0 4px 12px rgba(var(--shadow-rgb),0.2), 0 0 0 4px rgba(var(--accent-rgb),0.1);
    transition: transform 260ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 260ms ease;
  }

  .control-range:hover::-webkit-slider-thumb {
    transform: scale(1.08);
    box-shadow: 0 6px 16px rgba(var(--shadow-rgb),0.24), 0 0 0 6px rgba(var(--accent-rgb),0.12);
  }

  .control-range::-moz-range-track {
    height: var(--range-track-height);
    border-radius: 999px;
    border: 1px solid rgba(var(--line-rgb),0.26);
    background: rgba(255,255,255,0.56);
  }

  .control-range::-moz-range-progress {
    height: var(--range-track-height);
    border-radius: 999px;
    background: rgb(var(--accent-rgb));
  }

  .control-range::-moz-range-thumb {
    width: var(--range-thumb-size);
    height: var(--range-thumb-size);
    border-radius: 999px;
    border: 2px solid rgb(var(--accent-rgb));
    background: rgb(var(--accent-rgb));
    box-shadow: 0 4px 12px rgba(var(--shadow-rgb),0.2), 0 0 0 4px rgba(var(--accent-rgb),0.1);
  }

  .editor-color-swatch {
    display: grid;
    min-height: 32px;
    place-items: center;
    border-radius: 8px;
    border: 1px solid rgba(0,0,0,0.16);
    box-shadow: none;
    animation: swatchPop 560ms cubic-bezier(0.16, 1, 0.3, 1) both;
    transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1), border-color 320ms ease, box-shadow 320ms ease;
  }

  .editor-color-swatch:hover {
    transform: translateY(-2px) scale(1.04);
    border-color: rgba(var(--accent-rgb),0.58);
  }

  .editor-color-swatch-selected {
    border-color: rgba(var(--accent-rgb),0.82);
    box-shadow: 0 0 0 2px rgba(var(--accent-rgb),0.36), 0 10px 20px rgba(var(--shadow-rgb),0.16);
  }

  .editor-side-panel button,
  .download-panel-card button,
  .settings-panel-card button {
    transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1), background 320ms ease, border-color 320ms ease, color 320ms ease, opacity 320ms ease;
  }

  .editor-side-panel button:hover,
  .download-panel-card button:hover,
  .settings-panel-card button:hover {
    transform: translateY(-1px);
  }

  .editor-side-panel button:active,
  .download-panel-card button:active,
  .settings-panel-card button:active {
    transform: translateY(1px) scale(0.985);
  }

  .palette-backdrop {
    animation: paletteBackdropIn 420ms ease-out both;
  }

  .palette-modal {
    animation: palettePanelIn 720ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .palette-lab {
    --palette-accent: rgb(var(--accent-rgb));
    --palette-accent-2: rgb(var(--accent-2-rgb));
    color: var(--text);
  }

  .palette-lab-head {
    background:
      radial-gradient(circle at 12% 0%, rgba(var(--accent-rgb), 0.14), transparent 34%),
      linear-gradient(90deg, rgba(var(--accent-rgb),0.08), rgba(var(--accent-2-rgb),0.05)),
      rgba(255,255,255,0.36);
  }

  .palette-icon-button,
  .palette-view-button,
  .palette-footer-button,
  .palette-save-button,
  .palette-tab,
  .palette-series-button,
  .palette-color-cell {
    touch-action: manipulation;
  }

  .palette-icon-button,
  .palette-view-button {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
    flex: 0 0 44px;
    padding: 0;
    border-radius: 12px;
    border: 1px solid rgba(var(--line-rgb),0.18);
    background: rgba(255,255,255,0.54);
    color: var(--muted);
    transition: transform 340ms cubic-bezier(0.16, 1, 0.3, 1), background 340ms ease, border-color 340ms ease, color 340ms ease;
  }

  .palette-icon-button:hover,
  .palette-view-button:hover,
  .palette-view-button-active {
    transform: translateY(-1px);
    border-color: rgba(var(--accent-rgb), 0.55);
    background: rgba(var(--accent-rgb), 0.18);
    color: rgb(var(--accent-rgb));
  }

  .palette-tab {
    min-height: 36px;
    border-radius: 10px;
    padding: 0 16px;
    color: var(--muted);
    font-size: 12px;
    font-weight: 700;
    transition: transform 340ms cubic-bezier(0.16, 1, 0.3, 1), background 340ms ease, color 340ms ease;
  }

  .palette-tab:hover {
    transform: translateY(-1px);
    color: var(--text);
    background: rgba(var(--accent-rgb),0.08);
  }

  .palette-tab-active {
    background: rgba(var(--accent-rgb),0.14);
    color: rgb(var(--accent-rgb));
    animation: paletteTabPop 520ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .palette-series-list,
  .palette-color-scroll {
    scrollbar-color: rgba(var(--line-rgb),0.42) rgba(var(--line-rgb),0.08);
  }

  .palette-series-button {
    display: flex;
    width: 100%;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 38px;
    border-radius: 12px;
    padding: 0 12px;
    color: var(--muted);
    font-size: 12px;
    white-space: nowrap;
    transition: transform 340ms cubic-bezier(0.16, 1, 0.3, 1), background 340ms ease, color 340ms ease;
  }

  .palette-series-button span:first-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .palette-series-button span:last-child {
    flex: 0 0 auto;
    font-variant-numeric: tabular-nums;
  }

  .palette-series-button:hover {
    transform: translateX(2px);
    color: var(--text);
    background: rgba(var(--accent-rgb),0.08);
  }

  .palette-series-button-active {
    color: rgb(var(--accent-rgb));
    background: rgba(var(--accent-rgb),0.14);
    box-shadow: 0 10px 24px rgba(var(--shadow-rgb),0.1);
  }

  .palette-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(46px, 1fr));
    align-content: start;
    gap: 8px;
  }

  .palette-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
    align-content: start;
    gap: 8px;
  }

  .palette-color-cell {
    --cell-index: 0;
    position: relative;
    min-height: 48px;
    overflow: hidden;
    border-radius: 10px;
    border: 2px solid rgba(0,0,0,0.12);
    background: var(--cell-color);
    color: rgba(20,20,18,0.74);
    box-shadow: none;
    animation: paletteCellIn 620ms cubic-bezier(0.16, 1, 0.3, 1) both;
    animation-delay: min(calc(var(--cell-index) * 22ms), 480ms);
    transition: transform 340ms cubic-bezier(0.16, 1, 0.3, 1), border-color 340ms ease, box-shadow 340ms ease;
  }

  .palette-color-cell::before {
    content: none;
  }

  .palette-color-cell:hover {
    transform: translateY(-3px) scale(1.035);
    border-color: rgba(var(--accent-rgb),0.58);
    box-shadow: 0 12px 20px rgba(var(--shadow-rgb),0.12);
  }

  .palette-color-cell:hover::before {
    animation: none;
  }

  .palette-color-cell-selected {
    border-color: rgba(var(--accent-rgb),0.86);
    box-shadow: 0 0 0 2px rgba(var(--accent-rgb),0.32), 0 12px 22px rgba(var(--shadow-rgb),0.14);
  }

  .palette-color-fill {
    position: absolute;
    inset: 0;
    background: transparent;
    pointer-events: none;
  }

  .palette-color-key {
    position: relative;
    z-index: 1;
    display: grid;
    min-height: 48px;
    place-items: center;
    padding: 0 4px;
    color: color-mix(in srgb, var(--cell-color) 28%, #12100e 72%);
    font-family: var(--font-geist-mono), "Cascadia Code", Consolas, monospace;
    font-size: 10px;
    font-weight: 800;
    text-shadow: 0 1px 0 rgba(255,255,255,0.35), 0 -1px 0 rgba(0,0,0,0.12);
  }

  .palette-list .palette-color-key {
    justify-content: start;
    padding-left: 14px;
    font-size: 12px;
  }

  .palette-color-check {
    position: absolute;
    right: 3px;
    top: 3px;
    z-index: 2;
    display: grid;
    height: 16px;
    width: 16px;
    place-items: center;
    border-radius: 999px;
    background: rgba(255,255,255,0.82);
    color: rgba(var(--accent-rgb),0.92);
    opacity: 0;
    transform: scale(0.7) rotate(-12deg);
    transition: opacity 230ms ease, transform 280ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .palette-color-cell-selected .palette-color-check {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }

  .palette-footer-button,
  .palette-save-button {
    min-height: 38px;
    border-radius: 10px;
    border: 1px solid rgba(var(--line-rgb),0.18);
    padding: 0 14px;
    background: rgba(255,255,255,0.54);
    color: var(--text);
    font-size: 12px;
    white-space: nowrap;
    transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1), background 240ms ease, border-color 240ms ease;
  }

  .palette-footer-button:hover {
    transform: translateY(-1px);
    border-color: rgba(var(--accent-rgb),0.42);
    background: rgba(var(--accent-rgb),0.08);
  }

  .palette-save-button {
    border-color: rgba(var(--accent-rgb),0.62);
    background: linear-gradient(135deg, rgba(var(--accent-rgb),0.92), rgba(var(--accent-2-rgb),0.78));
    color: white;
    box-shadow: 0 14px 28px rgba(var(--accent-rgb),0.22);
  }

  .palette-save-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 18px 36px rgba(var(--accent-rgb),0.28);
  }

  .mobile-command-bar {
    animation: toolbarSlideUp 620ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .mobile-command-scroll {
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .mobile-command-scroll::-webkit-scrollbar {
    display: none;
  }

  .mobile-panel-scrim {
    animation: paletteBackdropIn 260ms ease-out both;
  }

  .mobile-panel-handle {
    display: none;
    border: 0;
    padding: 0;
    appearance: none;
    color: inherit;
  }

  .mobile-command-bar button,
  .mobile-command-bar label,
  .mode-tab,
  .palette-series-button,
  .palette-tab {
    white-space: nowrap;
  }

  @media (max-width: 1023px) {
    .mobile-workspace-shell {
      overflow-y: auto;
      overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
    }

    .mobile-canvas-column {
      min-height: min(62vh, 620px);
    }

    .workspace-side-panel-shell {
      height: min(44vh, 430px);
      min-height: 280px;
      flex: 0 0 auto;
      opacity: 1;
      pointer-events: auto;
    }

    .workspace-side-panel-shell .editor-side-panel {
      animation: none;
      border-radius: 18px;
      box-shadow: 0 -18px 48px rgba(var(--shadow-rgb),0.12);
    }

    .editor-panel-card,
    .preview-panel-card,
    .focus-side-card,
    .download-panel-card,
    .settings-panel-card {
      padding: 12px;
    }

    .editor-tool-rail {
      left: 0.5rem;
      max-height: calc(100% - 4.75rem);
      gap: 2px;
      border-radius: 14px;
      padding: 4px;
    }

    .editor-tool-rail button {
      min-height: 36px;
      min-width: 36px;
    }

    .editor-tool-rail button:not(:first-child) {
      height: 36px;
      width: 36px;
    }

    .editor-color-swatch {
      min-height: 38px;
    }

    .preview-board {
      max-width: calc(100vw - 28px);
    }

    .canvas-scale-control {
      bottom: 0.75rem;
      max-width: calc(100% - 5.75rem);
    }

    .canvas-scale-control .control-range {
      width: min(28vw, 96px);
    }
  }

  @media (max-width: 767px) {
    .workspace-brand-button {
      display: none;
    }

    .workspace-app {
      min-width: 320px;
    }

    .workspace-app button,
    .workspace-app label,
    .workspace-app select,
    .workspace-app input {
      touch-action: manipulation;
    }

    .workspace-enter {
      border-radius: 16px;
    }

    .mode-switch {
      max-width: 100%;
      overflow-x: auto;
      scrollbar-width: none;
    }

    .mode-switch::-webkit-scrollbar {
      display: none;
    }

    .mode-tab {
      flex: 0 0 auto;
    }

    .mobile-canvas-column {
      min-height: 0;
    }

    .workspace-side-panel-shell {
      position: fixed;
      left: 0.5rem;
      right: 0.5rem;
      bottom: calc(4.55rem + env(safe-area-inset-bottom));
      z-index: 70;
      height: min(56vh, 480px);
      min-height: 310px;
      max-height: calc(100dvh - 6rem - env(safe-area-inset-bottom));
      transform: translateY(calc(100% + 5.75rem));
      opacity: 0;
      pointer-events: none;
      transition: transform 420ms cubic-bezier(0.16, 1, 0.3, 1), opacity 280ms ease;
    }

    .workspace-side-panel-shell[data-mode="focus"] {
      bottom: calc(0.75rem + env(safe-area-inset-bottom));
      height: min(48vh, 410px);
      min-height: 260px;
      max-height: calc(100dvh - 2rem - env(safe-area-inset-bottom));
      transform: translateY(calc(100% + 1.75rem));
    }

    .workspace-side-panel-shell.mobile-panel-open {
      transform: translateY(0);
      opacity: 1;
      pointer-events: auto;
    }

    .mobile-panel-handle {
      display: flex;
      height: 18px;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      border-radius: 18px 18px 0 0;
      background: rgba(var(--panel-rgb),0.84);
    }

    .mobile-panel-handle::before {
      content: "";
      height: 4px;
      width: 42px;
      border-radius: 999px;
      background: rgba(var(--line-rgb),0.46);
    }

    .workspace-side-panel-shell .editor-side-panel {
      height: calc(100% - 18px);
      min-height: 0;
      border-radius: 0 0 18px 18px;
    }

    .mobile-stage-scroll {
      padding: 8px;
      padding-bottom: calc(5.8rem + env(safe-area-inset-bottom));
      overscroll-behavior: contain;
    }

    .mobile-stage-topbar {
      padding-left: 10px;
      padding-right: 10px;
    }

    .mobile-stage-topbar > div:first-child {
      min-width: 0;
    }

    .mobile-upload-card {
      width: calc(100% - 16px);
      max-width: calc(100vw - 48px);
      padding-left: 20px;
      padding-right: 20px;
    }

    .mobile-upload-card .mobile-upload-helper {
      max-width: 30ch;
    }

    .preview-board {
      max-width: calc(100vw - 16px);
    }

    .preview-board.preview-board-pretty {
      padding: 14px 14px 12px;
    }

    .preview-signature-zone {
      margin-top: 8px;
      min-height: 22px;
      padding-left: 8px;
      padding-right: 8px;
      font-size: 11px;
    }

    .canvas-scale-control-viewport {
      position: fixed;
      bottom: calc(5.15rem + env(safe-area-inset-bottom));
      left: 0.75rem;
      right: auto;
      transform: none;
      gap: 4px;
      width: max-content;
      max-width: calc(100vw - 1.5rem);
      justify-content: center;
      padding: 6px 8px;
      z-index: 92;
    }

    .canvas-scale-control-viewport button,
    .canvas-scale-control-stage button {
      height: 30px;
      width: 30px;
      min-width: 30px;
    }

    .canvas-scale-control-viewport .canvas-scale-value,
    .canvas-scale-control-stage .canvas-scale-value {
      min-width: 44px;
      width: auto;
    }

    .canvas-scale-control-viewport .control-range,
    .canvas-scale-control-stage .control-range {
      width: min(33vw, 104px);
    }

    .focus-bottom-palette {
      padding-left: 8px;
      padding-right: 8px;
    }

    .focus-bottom-palette > div:first-child {
      scroll-snap-type: x proximity;
      scrollbar-width: none;
    }

    .focus-bottom-palette > div:first-child::-webkit-scrollbar {
      display: none;
    }

    .focus-color-chip {
      min-width: 68px;
      padding-left: 6px;
      padding-right: 6px;
      scroll-snap-align: start;
    }

    .focus-canvas-pad {
      padding: 8px;
    }

    .focus-status-bar .mx-auto,
    .focus-progress-bar .mx-auto {
      gap: 8px;
    }

    .focus-status-bar .flex-wrap {
      flex-wrap: nowrap;
      overflow: hidden;
    }

    .focus-current-bead {
      height: 2rem;
      width: 2rem;
    }

    .focus-toolbar .glass-action {
      min-width: 0;
      min-height: 44px;
      padding-left: 6px;
      padding-right: 6px;
    }

    .focus-toolbar .glass-action span {
      white-space: nowrap;
    }

    .focus-status-bar {
      padding-left: 10px;
      padding-right: 10px;
    }

    .focus-timer-button {
      min-width: 42px;
      padding-left: 10px;
      padding-right: 10px;
    }

    .focus-timer-button span {
      display: none;
    }

    .focus-progress-bar {
      padding-left: 10px;
      padding-right: 10px;
    }

    .focus-progress-bar .focus-progress-dot {
      height: 7px;
      width: 7px;
    }

    .focus-progress-bar .shrink-0 {
      display: none;
    }

    .install-pwa-button {
      right: 0.75rem;
      bottom: calc(4.9rem + env(safe-area-inset-bottom));
      min-height: 40px;
      padding: 9px 12px;
      font-size: 12px;
      animation: none;
      box-shadow: 0 12px 24px rgba(var(--shadow-rgb),0.12);
      backdrop-filter: blur(10px) saturate(1.08);
      -webkit-backdrop-filter: blur(10px) saturate(1.08);
    }

    .mobile-command-bar {
      bottom: calc(0.5rem + env(safe-area-inset-bottom));
      border-radius: 16px;
      box-shadow: 0 14px 26px rgba(var(--shadow-rgb),0.12);
      backdrop-filter: blur(12px) saturate(1.08);
      -webkit-backdrop-filter: blur(12px) saturate(1.08);
    }

    .mobile-command-bar-inner {
      gap: 6px;
      padding: 6px;
    }

    .mobile-command-fixed {
      flex: 0 0 auto;
      gap: 6px;
    }

    .mobile-command-scroll {
      min-width: 0;
      flex: 1 1 auto;
      overflow-y: hidden;
    }

    .mobile-command-scroll > div {
      gap: 6px;
      width: max-content;
      padding-right: 2px;
    }

    .mobile-command-bar button,
    .mobile-command-bar label {
      min-width: 56px;
      min-height: 40px;
      justify-content: center;
      padding-left: 12px;
      padding-right: 12px;
      scroll-snap-align: start;
    }

    .palette-backdrop {
      align-items: flex-end;
      padding: 8px;
    }

    .palette-modal {
      max-width: 100%;
      max-height: calc(100dvh - 16px);
    }

    .palette-modal .settings-shell {
      border-radius: 18px 18px 0 0;
    }

    .settings-shell {
      max-width: calc(100vw - 16px);
    }

    .settings-head > div:first-child,
    .palette-lab-head > div:first-child {
      min-width: 0;
    }

    .custom-palette-editor {
      height: min(88vh, 760px);
      border-radius: 18px;
    }

    .custom-palette-editor .settings-head,
    .download-settings-panel .settings-head {
      padding: 14px 16px;
    }

    .custom-palette-editor .palette-body {
      padding: 12px 14px 14px;
    }

    .custom-palette-toolbar {
      grid-template-columns: minmax(0,1fr);
      gap: 10px;
      padding-bottom: 12px;
    }

    .custom-palette-toolbar > div:first-child {
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
    }

    .custom-palette-toolbar > div:first-child::-webkit-scrollbar {
      display: none;
    }

    .custom-palette-series {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      overflow-y: hidden;
      padding-bottom: 6px;
      padding-right: 0;
      scrollbar-width: thin;
    }

    .custom-palette-series .palette-series-button {
      width: auto;
      min-width: max-content;
      flex: 0 0 auto;
    }

    .palette-grid {
      grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
      gap: 7px;
    }

    .palette-list {
      grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
    }

    .palette-color-cell,
    .palette-color-key {
      min-height: 44px;
    }

    .palette-footer {
      align-items: stretch;
    }

    .palette-footer > div {
      width: 100%;
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
    }

    .palette-footer > div::-webkit-scrollbar {
      display: none;
    }

    .palette-footer-button,
    .palette-save-button {
      flex: 0 0 auto;
      min-height: 42px;
      white-space: nowrap;
    }

    .download-settings-panel {
      max-height: 90vh;
      border-radius: 18px;
    }

    .download-settings-panel .download-body {
      padding: 14px;
    }

    .download-option-row {
      align-items: center;
      gap: 10px;
    }

    .download-option-row > div:first-child {
      min-width: 0;
    }

    .download-option-row .theme-toggle,
    .download-option-row button[aria-pressed] {
      flex-shrink: 0;
    }

    .editor-panel-card button,
    .preview-panel-card button,
    .focus-side-card button,
    .download-panel-card button,
    .settings-panel-card button {
      white-space: nowrap;
    }

    .mobile-stage-scroll-with-editor-rail {
      padding-left: 5rem;
    }

    .mobile-editor-popover {
      left: 0.5rem;
      top: 0.75rem;
      bottom: calc(5.5rem + env(safe-area-inset-bottom));
      display: flex;
      align-items: center;
      width: auto;
      pointer-events: none;
      animation: railSlideIn 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
      z-index: 92;
    }

    .mobile-editor-popover .editor-tool-rail-drawer {
      min-width: 78px;
      width: 78px;
      max-height: 100%;
      gap: 6px;
      padding: 8px 6px;
      border-radius: 26px;
      border: 1px solid rgba(var(--line-rgb),0.18);
      background: rgba(var(--panel-rgb),0.94);
      box-shadow: 0 16px 30px rgba(var(--shadow-rgb),0.14);
      backdrop-filter: blur(12px) saturate(1.08);
      -webkit-backdrop-filter: blur(12px) saturate(1.08);
      pointer-events: auto;
    }

    .mobile-editor-popover .editor-tool-rail-drawer button {
      flex-shrink: 0;
    }

    .mobile-editor-popover .editor-tool-rail-drawer > button:not(:first-child) {
      height: 42px;
      width: 42px;
    }

    .tech-grid-bg,
    .animate-float,
    .focus-current-bead {
      animation: none;
    }

    .glass-action::after,
    .editor-tool-rail button::after {
      display: none;
    }

    .glass-action,
    .preview-board,
    .workspace-side-panel-shell .editor-side-panel,
    .settings-shell,
    .palette-modal {
      box-shadow: 0 14px 28px rgba(var(--shadow-rgb),0.1);
      backdrop-filter: blur(12px) saturate(1.08);
      -webkit-backdrop-filter: blur(12px) saturate(1.08);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .animate-float,
    .workspace-enter,
    .glass-action:hover::after,
    .glass-action-active,
    .tech-grid-bg,
    .install-pwa-button,
    .palette-backdrop,
    .palette-modal,
    .palette-color-cell,
    .palette-tab-active,
    .palette-color-cell:hover::before,
    .mode-tab,
    .editor-tool-rail,
    .editor-side-panel,
    .editor-panel-card,
    .preview-panel-card,
    .focus-side-card,
    .download-panel-card,
    .settings-panel-card,
    .editor-color-swatch,
    .preview-board,
    .preview-art-surface,
    .preview-signature-zone,
    .preview-material-glitter::after,
    .floating-minimap,
    .download-option-row,
    .focus-bottom-palette,
    .focus-status-bar,
    .focus-progress-bar,
    .focus-toolbar,
    .focus-current-bead,
    .focus-color-chip,
    .canvas-scale-control,
    .preview-brand-strip,
    .mobile-command-bar {
      animation: none;
    }

    .glass-action,
    .palette-icon-button,
    .palette-view-button,
    .palette-footer-button,
    .palette-save-button,
    .palette-tab,
    .palette-series-button,
    .palette-color-cell,
    .palette-color-check,
    .theme-toggle,
    .theme-toggle-knob,
    .editor-color-swatch,
    .editor-side-panel button,
    .editor-tool-rail button::after,
    .floating-minimap canvas,
    .download-panel-card button,
    .settings-panel-card button {
      transition: none;
    }
  }
`;

// Helper function for sorting color keys - 保留原有实现，因为未在utils中导出
function sortColorKeys(a: string, b: string): number {
  const regex = /^([A-Z]+)(\d+)$/;
  const matchA = a.match(regex);
  const matchB = b.match(regex);

  if (matchA && matchB) {
    const prefixA = matchA[1];
    const numA = parseInt(matchA[2], 10);
    const prefixB = matchB[1];
    const numB = parseInt(matchB[2], 10);

    if (prefixA !== prefixB) {
      return prefixA.localeCompare(prefixB); // Sort by prefix first (A, B, C...)
    }
    return numA - numB; // Then sort by number (1, 2, 10...)
  }
  // Fallback for keys that don't match the standard pattern (e.g., T1, ZG1)
  return a.localeCompare(b);
}

// --- Define available palette key sets ---
// 从colorSystemMapping.json获取所有MARD色号
const mardToHexMapping = getMardToHexMapping();

// Pre-process the FULL palette data once - 使用colorSystemMapping而不是beadPaletteData
const fullBeadPalette: PaletteColor[] = Object.entries(mardToHexMapping)
  .map(([mardKey, hex]) => {
    const rgb = hexToRgb(hex);
    if (!rgb) {
      console.warn(`Invalid hex code "${hex}" for MARD key "${mardKey}". Skipping.`);
      return null;
    }
    // 使用hex值作为key，符合新的架构设计
    return { key: hex, hex, rgb };
  })
  .filter((color): color is PaletteColor => color !== null);

function BeadLogo({ compact = false }: { compact?: boolean }) {
  const colors = ['#3b82f6', '#f05a7e', '#f6c453', '#22c55e'];

  return (
    <div className={`grid grid-cols-2 gap-1 ${compact ? 'p-1.5 rounded-lg' : 'p-2 rounded-2xl'} border border-[rgba(var(--line-rgb),0.36)] bg-white/55 shadow-sm`}>
      {colors.map((color, index) => (
        <span
          key={color}
          className={`${compact ? 'h-2 w-2' : 'h-3 w-3'} rounded-full animate-float border border-black/5`}
          style={{ backgroundColor: color, animationDelay: `${index * 120}ms` }}
        />
      ))}
    </div>
  );
}

function ToggleRow({
  label,
  helper,
  checked,
  onChange,
}: {
  label: string;
  helper?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-[rgba(var(--line-rgb),0.14)] bg-white/42 px-3 py-2.5 text-left transition hover:bg-white/66"
      aria-pressed={checked}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-[var(--text)]">{label}</span>
        {helper && <span className="mt-0.5 block text-[11px] leading-4 text-[var(--muted)]">{helper}</span>}
      </span>
      <span className={`theme-toggle ${checked ? 'theme-toggle-on' : ''}`}>
        <span className="theme-toggle-knob" />
      </span>
    </button>
  );
}

function StickerMark({
  sticker,
  viewScale = 1,
}: {
  sticker: StickerInstance;
  viewScale?: number;
}) {
  const shapeClass = sticker.shape === 'circle'
    ? 'rounded-full'
    : sticker.shape === 'diamond'
      ? 'rotate-45 rounded-sm'
      : sticker.shape === 'star'
        ? 'rounded-[4px]'
        : 'rounded-[45%_45%_35%_35%]';
  const size = Math.max(18, sticker.size * 8) * viewScale;
  const style: React.CSSProperties = {
    width: size,
    height: size,
    backgroundColor: sticker.style === 'hollow' ? 'transparent' : sticker.color,
    borderColor: sticker.color,
    backgroundImage: sticker.style === 'striped'
      ? `repeating-linear-gradient(45deg, ${sticker.color} 0 5px, rgba(255,255,255,0.2) 5px 10px)`
      : undefined,
  };

  if (sticker.shape === 'star') {
    return (
      <span
        className="block text-center leading-none drop-shadow-sm"
        style={{ color: sticker.color, fontSize: size }}
      >
        ★
      </span>
    );
  }

  if (sticker.shape === 'heart') {
    return (
      <span
        className="block text-center leading-none drop-shadow-sm"
        style={{ color: sticker.color, fontSize: size }}
      >
        ♥
      </span>
    );
  }

  return <span className={`block border-2 shadow-sm ${shapeClass}`} style={style} />;
}

function CanvasScaleControl({
  scale,
  onChange,
  variant = 'stage',
}: {
  scale: number;
  onChange: (scale: number) => void;
  variant?: 'stage' | 'viewport';
}) {
  const setScale = (value: number) => onChange(Math.max(0.5, Math.min(2, Number(value.toFixed(2)))));
  const shellClassName =
    variant === 'viewport'
      ? 'canvas-scale-control canvas-scale-control-viewport fixed z-[74] flex items-center gap-2 rounded-xl border border-[rgba(var(--line-rgb),0.16)] bg-[rgba(var(--panel-rgb),0.78)] px-2.5 py-2 text-xs text-[var(--text)] shadow-[0_16px_38px_rgba(var(--shadow-rgb),0.14)] backdrop-blur-xl'
      : 'canvas-scale-control canvas-scale-control-stage absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-[rgba(var(--line-rgb),0.16)] bg-[rgba(var(--panel-rgb),0.78)] px-2.5 py-2 text-xs text-[var(--text)] shadow-[0_16px_38px_rgba(var(--shadow-rgb),0.14)] backdrop-blur-xl';

  return (
    <div className={shellClassName} aria-label="画布缩放">
      <span className="hidden text-[10px] font-medium text-[var(--muted)] sm:inline">画布缩放</span>
      <button type="button" onClick={() => setScale(scale - 0.1)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/62" aria-label="缩小画布">-</button>
      <input
        type="range"
        min="0.5"
        max="2"
        step="0.05"
        value={scale}
        onChange={event => setScale(Number(event.target.value))}
        className="control-range w-28"
        style={{ '--range-progress': `${((scale - 0.5) / 1.5) * 100}%` } as React.CSSProperties}
      />
      <button type="button" onClick={() => setScale(scale + 0.1)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/62" aria-label="放大画布">+</button>
      <button type="button" onClick={() => setScale(1)} className="canvas-scale-value min-w-12 rounded-lg px-2 py-1 font-mono text-[11px] tabular-nums hover:bg-white/62">{Math.round(scale * 100)}%</button>
    </div>
  );
}

function PreviewSidePanel({
  settings,
  onSettingsChange,
  onDownload,
}: {
  settings: PreviewSettings;
  onSettingsChange: (settings: PreviewSettings) => void;
  onDownload: () => void;
}) {
  const setValue = <K extends keyof PreviewSettings>(key: K, value: PreviewSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const materials: Array<{ key: PreviewMaterial; label: string }> = [
    { key: 'matte', label: '磨砂' },
    { key: 'glitter', label: '格力特' },
    { key: 'towel', label: '毛巾' },
    { key: 'enamel', label: '搪瓷巾' },
  ];
  const backgrounds: Array<{ key: PreviewBackground; label: string }> = [
    { key: 'white', label: '白色' },
    { key: 'cream', label: '奶白' },
    { key: 'beige', label: '米色' },
    { key: 'dark', label: '深色' },
    { key: 'black', label: '黑色' },
    { key: 'wood', label: '木纹' },
    { key: 'custom', label: '自定义' },
  ];

  return (
    <aside className="editor-side-panel flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[rgba(var(--line-rgb),0.18)] bg-[rgba(var(--panel-rgb),0.84)] text-[var(--text)] shadow-[-18px_0_48px_rgba(var(--shadow-rgb),0.12)] backdrop-blur-2xl">
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        <section className="preview-panel-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">熨烫预览</div>
              <div className="mt-1 text-[11px] leading-4 text-[var(--muted)]">预览拼豆熨烫后的真实效果，可调整材质、阴影和边缘效果。</div>
            </div>
            <button type="button" onClick={onDownload} className="glass-action min-h-[36px] shrink-0 whitespace-nowrap px-3 text-xs font-medium">下载</button>
          </div>
        </section>

        <section className="preview-panel-card" style={{ animationDelay: '45ms' }}>
          <div className="mb-3 text-sm font-bold">材质</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {materials.map(item => (
              <button
                key={item.key}
                type="button"
                onClick={() => setValue('material', item.key)}
                className={`rounded-lg border px-2 py-2 transition ${settings.material === item.key ? 'border-[rgba(var(--accent-rgb),0.58)] bg-[rgba(var(--accent-rgb),0.14)] text-[var(--text)]' : 'border-[rgba(var(--line-rgb),0.15)] bg-white/48 text-[var(--muted)] hover:bg-white/68'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <section className="preview-panel-card" style={{ animationDelay: '90ms' }}>
          <div className="mb-3 text-sm font-bold">边缘效果</div>
          <div className="space-y-3">
            <ToggleRow
              label="弧形边缘"
              helper="模拟热熔膨出后的圆润边缘，让像素块更像熨烫后的拼豆。"
              checked={settings.edgeEnabled}
              onChange={checked => setValue('edgeEnabled', checked)}
            />
            <label className="grid gap-1 text-[11px] text-[var(--muted)]">
              <span className="flex items-center justify-between">
                <span>弧度</span>
                <span className="tabular-nums">{settings.edgeIntensity}%</span>
              </span>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.edgeIntensity}
                onChange={event => setValue('edgeIntensity', Number(event.target.value))}
                className="control-range"
                style={{ '--range-progress': `${settings.edgeIntensity}%` } as React.CSSProperties}
              />
            </label>
          </div>
        </section>

        <section className="preview-panel-card" style={{ animationDelay: '135ms' }}>
          <div className="mb-3 text-sm font-bold">阴影</div>
          <div className="space-y-3">
            <ToggleRow
              label="显示投影"
              helper="给整张图纸增加轻微落影，让背景层和图纸层分开。"
              checked={settings.shadowEnabled}
              onChange={checked => setValue('shadowEnabled', checked)}
            />
            <label className="grid gap-1 text-[11px] text-[var(--muted)]">
              <span className="flex items-center justify-between">
                <span>角度</span>
                <span className="tabular-nums">{settings.shadowAngle}°</span>
              </span>
              <input
                type="range"
                min="0"
                max="360"
                value={settings.shadowAngle}
                onChange={event => setValue('shadowAngle', Number(event.target.value))}
                className="control-range"
                style={{ '--range-progress': `${(settings.shadowAngle / 360) * 100}%` } as React.CSSProperties}
              />
            </label>
            <label className="grid gap-1 text-[11px] text-[var(--muted)]">
              <span className="flex items-center justify-between">
                <span>距离</span>
                <span className="tabular-nums">{settings.shadowDistance}px</span>
              </span>
              <input
                type="range"
                min="0"
                max="28"
                value={settings.shadowDistance}
                onChange={event => setValue('shadowDistance', Number(event.target.value))}
                className="control-range"
                style={{ '--range-progress': `${(settings.shadowDistance / 28) * 100}%` } as React.CSSProperties}
              />
            </label>
          </div>
        </section>

        <section className="preview-panel-card" style={{ animationDelay: '180ms' }}>
          <div className="mb-3 text-sm font-bold">背景</div>
          <div className="grid grid-cols-3 gap-2">
            {backgrounds.map(item => (
              <button
                key={item.key}
                type="button"
                onClick={() => setValue('background', item.key)}
                className={`rounded-lg border px-2 py-1.5 text-[11px] transition ${settings.background === item.key ? 'border-[rgba(var(--accent-rgb),0.58)] bg-[rgba(var(--accent-rgb),0.14)] text-[var(--text)]' : 'border-[rgba(var(--line-rgb),0.15)] bg-white/48 text-[var(--muted)] hover:bg-white/68'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          {settings.background === 'custom' && (
            <label className="mt-3 flex items-center justify-between gap-3 text-[11px] text-[var(--muted)]">
              自定义颜色
              <input type="color" value={settings.customBackground} onChange={event => setValue('customBackground', event.target.value)} className="h-8 w-12 rounded border border-[rgba(var(--line-rgb),0.18)] bg-transparent" />
            </label>
          )}
        </section>

        <section className="preview-panel-card" style={{ animationDelay: '225ms' }}>
          <div className="mb-3 text-sm font-bold">品牌文字</div>
          <input
            value={settings.brandText}
            onChange={event => setValue('brandText', event.target.value)}
            placeholder="留空则不显示"
            className="w-full rounded-lg border border-[rgba(var(--line-rgb),0.2)] bg-white/58 px-3 py-2 text-xs text-[var(--text)] outline-none focus:border-[rgba(var(--accent-rgb),0.55)]"
          />
          <div className="mt-2 text-[11px] leading-4 text-[var(--muted)]">显示在图纸下方的背景留白区域。</div>
        </section>
      </div>
    </aside>
  );
}

function FocusSidePanel({
  focusState,
  onFocusStateChange,
  onExportProgress,
  onResetProgress,
}: {
  focusState: FocusWorkbenchState;
  onFocusStateChange: React.Dispatch<React.SetStateAction<FocusWorkbenchState>>;
  onExportProgress: () => void;
  onResetProgress: () => void;
}) {
  const guidanceOptions: Array<{ key: GuidanceMode; label: string }> = [
    { key: 'nearest', label: '最近优先' },
    { key: 'largest', label: '大块优先' },
    { key: 'edge-first', label: '边缘优先' },
  ];
  const sectionColors = ['#007acc', '#28a745', '#dc3545', '#6f42c1', '#fd7e14', '#6c757d'];

  return (
    <aside className="editor-side-panel flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[rgba(var(--line-rgb),0.18)] bg-[rgba(var(--panel-rgb),0.84)] text-[var(--text)] shadow-[-18px_0_48px_rgba(var(--shadow-rgb),0.12)] backdrop-blur-2xl">
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        <section className="focus-side-card">
          <div className="mb-3 text-sm font-bold">引导策略</div>
          <div className="grid grid-cols-3 gap-1.5">
            {guidanceOptions.map(item => (
              <button
                key={item.key}
                type="button"
                onClick={() => onFocusStateChange(prev => ({ ...prev, guidanceMode: item.key }))}
                className={`rounded-lg border px-2 py-2 text-[11px] transition ${focusState.guidanceMode === item.key ? 'border-[rgba(var(--accent-rgb),0.58)] bg-[rgba(var(--accent-rgb),0.14)] text-[var(--text)]' : 'border-[rgba(var(--line-rgb),0.15)] bg-white/48 text-[var(--muted)] hover:bg-white/68'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <section className="focus-side-card" style={{ animationDelay: '45ms' }}>
          <div className="mb-3 text-sm font-bold">网格分割线</div>
          <div className="space-y-3">
            <ToggleRow label="显示分割线" checked={focusState.showSectionLines} onChange={checked => onFocusStateChange(prev => ({ ...prev, showSectionLines: checked }))} />
            <label className="grid gap-1 text-[11px] text-[var(--muted)]">
              分割间隔 {focusState.gridSectionInterval} 格
              <input
                type="range"
                min="5"
                max="20"
                value={focusState.gridSectionInterval}
                onChange={event => onFocusStateChange(prev => ({ ...prev, gridSectionInterval: Number(event.target.value) }))}
                className="control-range"
                style={{ '--range-progress': `${((focusState.gridSectionInterval - 5) / 15) * 100}%` } as React.CSSProperties}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {sectionColors.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => onFocusStateChange(prev => ({ ...prev, sectionLineColor: color }))}
                  className={`h-7 w-7 rounded-lg border-2 transition ${focusState.sectionLineColor === color ? 'scale-110 border-[rgb(var(--accent-rgb))]' : 'border-black/15 hover:border-black/40'}`}
                  style={{ backgroundColor: color }}
                  aria-label={`分割线颜色 ${color}`}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="focus-side-card" style={{ animationDelay: '90ms' }}>
          <div className="mb-3 text-sm font-bold">进度</div>
          <div className="space-y-3">
            <ToggleRow label="完成撒花" checked={focusState.enableCelebration} onChange={checked => onFocusStateChange(prev => ({ ...prev, enableCelebration: checked }))} />
            <button type="button" onClick={onExportProgress} className="glass-action min-h-[40px] w-full px-3 text-xs font-medium">导出进度数据</button>
            <button type="button" onClick={onResetProgress} className="glass-action min-h-[40px] w-full px-3 text-xs font-medium text-red-700">重置所有进度</button>
          </div>
        </section>
      </div>
    </aside>
  );
}

export default function Home() {
  const [originalImageSrc, setOriginalImageSrc] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<number>(DEFAULT_GRANULARITY);
  const [granularityInput, setGranularityInput] = useState<string>(DEFAULT_GRANULARITY.toString());
  const [similarityThreshold, setSimilarityThreshold] = useState<number>(30);
  const [similarityThresholdInput, setSimilarityThresholdInput] = useState<string>("30");
  // 添加像素化模式状态
  const [pixelationMode, setPixelationMode] = useState<PixelationMode>(PixelationMode.Dominant); // 默认为卡通模式
  
  // 新增：色号系统选择状态
  const [selectedColorSystem, setSelectedColorSystem] = useState<ColorSystem>('MARD');
  
  const [activeBeadPalette, setActiveBeadPalette] = useState<PaletteColor[]>(() => {
      return fullBeadPalette; // 默认使用全部颜色
  });
  // 状态变量：存储被排除的颜色（hex值）
  const [excludedColorKeys, setExcludedColorKeys] = useState<Set<string>>(new Set());
  const [showExcludedColors, setShowExcludedColors] = useState<boolean>(false);
  // 用于记录初始网格颜色（hex值），用于显示排除功能
  const [initialGridColorKeys, setInitialGridColorKeys] = useState<Set<string>>(new Set());
  const [mappedPixelData, setMappedPixelData] = useState<MappedPixel[][] | null>(null);
  const [gridDimensions, setGridDimensions] = useState<{ N: number; M: number } | null>(null);
  const [colorCounts, setColorCounts] = useState<{ [key: string]: { count: number; color: string } } | null>(null);
  const [totalBeadCount, setTotalBeadCount] = useState<number>(0);
  const [tooltipData, setTooltipData] = useState<{ x: number, y: number, key: string, color: string } | null>(null);
  const [remapTrigger, setRemapTrigger] = useState<number>(0);
  const [isManualColoringMode, setIsManualColoringMode] = useState<boolean>(false);
  const [selectedColor, setSelectedColor] = useState<MappedPixel | null>(null);
  // 新增：一键擦除模式状态
  const [isEraseMode, setIsEraseMode] = useState<boolean>(false);
  const [customPaletteSelections, setCustomPaletteSelections] = useState<PaletteSelections>({});
  const [isCustomPaletteEditorOpen, setIsCustomPaletteEditorOpen] = useState<boolean>(false);
  const [isCustomPalette, setIsCustomPalette] = useState<boolean>(false);
  const [isAppearancePanelOpen, setIsAppearancePanelOpen] = useState<boolean>(false);
  const [appearanceSettings, setAppearanceSettings] = useState<AppearanceSettings>(defaultAppearanceSettings);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('optimize');
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState<boolean>(false);
  const [isMobileEditorRailOpen, setIsMobileEditorRailOpen] = useState<boolean>(false);
  const intendedWorkspaceModeRef = useRef<WorkspaceMode>('optimize');
  const [activeEditorTool, setActiveEditorTool] = useState<EditorTool>('brush');
  const [showEditorMinimap, setShowEditorMinimap] = useState<boolean>(true);
  const [brushSize, setBrushSize] = useState<number>(1);
  const [brushMirrorX, setBrushMirrorX] = useState<boolean>(false);
  const [brushMirrorY, setBrushMirrorY] = useState<boolean>(false);
  const [eraserSize, setEraserSize] = useState<number>(1);
  const [lineSize, setLineSize] = useState<number>(1);
  const [lineMirrorX, setLineMirrorX] = useState<boolean>(false);
  const [lineMirrorY, setLineMirrorY] = useState<boolean>(false);
  const [rectangleSize, setRectangleSize] = useState<number>(1);
  const [rectangleFilled, setRectangleFilled] = useState<boolean>(false);
  const [rectangleMirrorX, setRectangleMirrorX] = useState<boolean>(false);
  const [rectangleMirrorY, setRectangleMirrorY] = useState<boolean>(false);
  const [pendingLineStart, setPendingLineStart] = useState<GridPoint | null>(null);
  const [pendingRectangleStart, setPendingRectangleStart] = useState<GridPoint | null>(null);
  const [selectionArea, setSelectionArea] = useState<SelectionArea>(null);
  const [previewSettings, setPreviewSettings] = useState<PreviewSettings>({
    material: 'matte',
    edgeEnabled: true,
    edgeIntensity: 30,
    shadowEnabled: true,
    shadowAngle: 135,
    shadowDistance: 8,
    background: 'cream',
    customBackground: '#f4ead8',
    brandText: '',
  });
  const [workspaceCanvasScale, setWorkspaceCanvasScale] = useState<number>(1);
  const [workspaceCanvasScaleTouched, setWorkspaceCanvasScaleTouched] = useState<boolean>(false);
  const [editorLayers, setEditorLayers] = useState<EditorLayer[]>([
    { id: 'base', name: '主体', type: 'base', visible: true, locked: true },
  ]);
  const [activeLayerId, setActiveLayerId] = useState<string>('base');
  const [isStickerPanelOpen, setIsStickerPanelOpen] = useState<boolean>(false);
  const [stickerDraft, setStickerDraft] = useState<StickerDraft>({
    shape: 'circle',
    style: 'solid',
    color: '#E67F5F',
    size: 5,
  });
  const [stickers, setStickers] = useState<StickerInstance[]>([]);
  const [draggingStickerId, setDraggingStickerId] = useState<string | null>(null);
  const [focusState, setFocusState] = useState<FocusWorkbenchState>({
    currentColor: '',
    selectedCell: null,
    canvasScale: 1,
    canvasOffset: { x: 0, y: 0 },
    completedCells: new Set<string>(),
    colorProgress: {},
    recommendedRegion: null,
    recommendedCell: null,
    guidanceMode: 'nearest',
    gridSectionInterval: 10,
    showSectionLines: true,
    sectionLineColor: '#007acc',
    enableCelebration: true,
    showCelebration: false,
    showCompletionCard: false,
    showColorPanel: false,
    showSettingsPanel: false,
    isPaused: false,
    totalElapsedTime: 0,
    lastResumeTime: Date.now(),
  });
  
  // ++ 新增：下载设置相关状态 ++
  const [isDownloadSettingsOpen, setIsDownloadSettingsOpen] = useState<boolean>(false);
  const [downloadOptions, setDownloadOptions] = useState<GridDownloadOptions>({
    showGrid: true,
    gridInterval: 10,
    showCoordinates: true,
    showCellNumbers: true,
    gridLineColor: gridLineColorOptions[0].value,
    includeStats: true, // 默认包含统计信息
    exportCsv: false, // 默认不导出CSV
    authorName: '',
    horizontalMirror: false,
    addWatermark: false,
  });

  // 新增：高亮相关状态
  const [highlightColorKey, setHighlightColorKey] = useState<string | null>(null);

  // 新增：完整色板切换状态
  const [showFullPalette, setShowFullPalette] = useState<boolean>(false);
  
  // 新增：颜色替换相关状态
  const [colorReplaceState, setColorReplaceState] = useState<{
    isActive: boolean;
    step: 'select-source' | 'select-target';
    sourceColor?: { key: string; color: string };
  }>({
    isActive: false,
    step: 'select-source'
  });

  // 新增：放大镜状态
  const [isMagnifierActive, setIsMagnifierActive] = useState<boolean>(false);
  const [magnifierSelectionArea, setMagnifierSelectionArea] = useState<{
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  } | null>(null);

  // 新增：编辑撤回历史栈（多步）
  interface EditSnapshot {
    mappedPixelData: MappedPixel[][];
    colorCounts: { [key: string]: { count: number; color: string } };
    totalBeadCount: number;
  }
  const [editHistory, setEditHistory] = useState<EditSnapshot[]>([]);
  const [redoHistory, setRedoHistory] = useState<EditSnapshot[]>([]);
  const paintStrokeRef = useRef<PaintStrokeState>({
    active: false,
    snapshotSaved: false,
    lastPoint: null,
    touchedCells: new Set<string>(),
    workingData: null,
  });

  // 新增：轻量提示
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  }, []);
  const [isPhoneViewport, setIsPhoneViewport] = useState(false);

  const closeMobileWorkspaceOverlays = useCallback(() => {
    setIsMobilePanelOpen(false);
    setIsMobileEditorRailOpen(false);
  }, []);

  const handleWorkspaceCanvasScaleChange = useCallback((value: number) => {
    setWorkspaceCanvasScaleTouched(true);
    setWorkspaceCanvasScale(value);
  }, []);

  const openCustomPaletteEditor = useCallback(() => {
    closeMobileWorkspaceOverlays();
    setIsCustomPaletteEditorOpen(true);
  }, [closeMobileWorkspaceOverlays]);

  const openDownloadSettings = useCallback(() => {
    closeMobileWorkspaceOverlays();
    setIsDownloadSettingsOpen(true);
  }, [closeMobileWorkspaceOverlays]);

  const triggerMainImport = useCallback(() => {
    mainImportInputRef.current?.click();
    closeMobileWorkspaceOverlays();
  }, [closeMobileWorkspaceOverlays]);

  const toggleAppearancePanel = useCallback(() => {
    closeMobileWorkspaceOverlays();
    setIsAppearancePanelOpen(prev => !prev);
  }, [closeMobileWorkspaceOverlays]);

  const openFocusColorPanel = useCallback(() => {
    closeMobileWorkspaceOverlays();
    setFocusState(prev => ({ ...prev, showColorPanel: true }));
  }, [closeMobileWorkspaceOverlays]);

  const handleToggleMobilePanel = useCallback(() => {
    setIsMobileEditorRailOpen(false);
    setIsMobilePanelOpen(prev => !prev);
  }, []);

  const handleToggleMobileEditorRail = useCallback(() => {
    setIsMobilePanelOpen(false);
    setIsMobileEditorRailOpen(prev => !prev);
  }, []);

  const selectedTheme = appearanceThemes.find(theme => theme.key === appearanceSettings.theme) || appearanceThemes[0];
  const selectedFont = appearanceFonts.find(font => font.key === appearanceSettings.font) || appearanceFonts[0];
  const appearanceStyle = {
    '--ui-font': selectedFont.stack,
  } as React.CSSProperties;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const syncViewport = () => setIsPhoneViewport(mediaQuery.matches);
    syncViewport();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncViewport);
      return () => mediaQuery.removeEventListener('change', syncViewport);
    }

    mediaQuery.addListener(syncViewport);
    return () => mediaQuery.removeListener(syncViewport);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const previousFontSize = root.style.fontSize;
    root.style.fontSize = `${appearanceSettings.scale}%`;

    return () => {
      root.style.fontSize = previousFontSize;
    };
  }, [appearanceSettings.scale]);

  useEffect(() => {
    if (isManualColoringMode) {
      setWorkspaceMode('edit');
      return;
    }

    if (!mappedPixelData) {
      intendedWorkspaceModeRef.current = 'optimize';
      setWorkspaceMode('optimize');
      return;
    }

    setWorkspaceMode(prev => {
      if (prev === 'edit' || prev === 'focus') return 'preview';
      return intendedWorkspaceModeRef.current === 'optimize' ? 'optimize' : prev;
    });
  }, [isManualColoringMode, mappedPixelData]);

  useEffect(() => {
    if (!gridDimensions || workspaceCanvasScaleTouched || typeof window === 'undefined') return;

    const fitCanvasToPhone = () => {
      const isPhone = window.matchMedia('(max-width: 767px)').matches;
      if (!isPhone) return;

      let baseWidth = 500;
      if (gridDimensions.N > 100) {
        const requiredWidthForMinSize = gridDimensions.N * 4;
        const requiredWidthForRecommendedSize = gridDimensions.N * 6;
        const maxWidth = Math.min(1200, window.innerWidth * 0.9);
        baseWidth = Math.min(maxWidth, Math.max(500, requiredWidthForRecommendedSize));
        baseWidth = Math.max(baseWidth, requiredWidthForMinSize);
      }

      const availableWidth = Math.max(280, window.innerWidth - (workspaceMode === 'preview' ? 44 : 24));
      const fittedScale = Math.max(0.5, Math.min(1, Number((availableWidth / baseWidth).toFixed(2))));
      setWorkspaceCanvasScale(fittedScale);
    };

    fitCanvasToPhone();
    window.addEventListener('resize', fitCanvasToPhone);
    return () => window.removeEventListener('resize', fitCanvasToPhone);
  }, [gridDimensions, workspaceMode, workspaceCanvasScaleTouched]);

  const resetPendingEditorGestures = useCallback(() => {
    setPendingLineStart(null);
    setPendingRectangleStart(null);
    setSelectionArea(null);
  }, []);

  const handleWorkspaceModeChange = (mode: WorkspaceMode) => {
    setIsMobilePanelOpen(false);
    setIsMobileEditorRailOpen(false);

    if (mode === 'edit') {
      if (!mappedPixelData || !gridDimensions) return;
      intendedWorkspaceModeRef.current = mode;
      setIsManualColoringMode(true);
      setWorkspaceMode('edit');
      setTooltipData(null);
      if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
        setShowEditorMinimap(false);
      }
      return;
    }

    if (mode === 'focus') {
      if (!mappedPixelData || !gridDimensions || !colorCounts) return;
      intendedWorkspaceModeRef.current = mode;
      enterFocusWorkbench();
      return;
    }

    intendedWorkspaceModeRef.current = mode;
    setIsManualColoringMode(false);
    setWorkspaceMode(mode);
    setSelectedColor(null);
    setTooltipData(null);
    setIsEraseMode(false);
    setColorReplaceState({ isActive: false, step: 'select-source' });
    setHighlightColorKey(null);
    resetPendingEditorGestures();
  };

  const handleEditorToolChange = (tool: EditorTool) => {
    setActiveEditorTool(tool);
    setTooltipData(null);
    setIsEraseMode(false);
    setColorReplaceState({ isActive: false, step: 'select-source' });
    setHighlightColorKey(null);
    if (tool !== 'line') setPendingLineStart(null);
    if (tool !== 'rectangle') setPendingRectangleStart(null);
    if (tool !== 'selection') setSelectionArea(null);
  };

  // 放大镜切换处理函数
  const handleToggleMagnifier = () => {
    const newActiveState = !isMagnifierActive;
    setIsMagnifierActive(newActiveState);
    
    // 如果关闭放大镜，清除选择区域，重新开始
    if (!newActiveState) {
      setMagnifierSelectionArea(null);
    }
  };

  // --- 撤回功能 ---

  // 保存编辑快照到历史栈
  const saveEditSnapshot = useCallback(() => {
    if (!mappedPixelData || !colorCounts) return;
    const snapshot: EditSnapshot = {
      mappedPixelData: mappedPixelData.map(row => row.map(cell => ({ ...cell }))),
      colorCounts: { ...colorCounts },
      totalBeadCount,
    };
    setEditHistory(prev => [...prev.slice(-49), snapshot]);
    setRedoHistory([]);
  }, [mappedPixelData, colorCounts, totalBeadCount]);

  // 编辑模式多步撤回
  const handleUndoEdit = useCallback(() => {
    if (editHistory.length === 0 || !mappedPixelData) return;
    const snapshot = editHistory[editHistory.length - 1];
    const currentSnapshot: EditSnapshot = {
      mappedPixelData: mappedPixelData.map(row => row.map(cell => ({ ...cell }))),
      colorCounts: colorCounts ? { ...colorCounts } : {},
      totalBeadCount,
    };
    setRedoHistory(prev => [...prev.slice(-49), currentSnapshot]);
    setMappedPixelData(snapshot.mappedPixelData);
    setColorCounts(snapshot.colorCounts);
    setTotalBeadCount(snapshot.totalBeadCount);
    setEditHistory(prev => prev.slice(0, -1));
    showToast('已撤销上一步');
  }, [editHistory, mappedPixelData, colorCounts, totalBeadCount, showToast]);

  const handleRedoEdit = useCallback(() => {
    if (redoHistory.length === 0 || !mappedPixelData) return;
    const snapshot = redoHistory[redoHistory.length - 1];
    const currentSnapshot: EditSnapshot = {
      mappedPixelData: mappedPixelData.map(row => row.map(cell => ({ ...cell }))),
      colorCounts: colorCounts ? { ...colorCounts } : {},
      totalBeadCount,
    };
    setEditHistory(prev => [...prev.slice(-49), currentSnapshot]);
    setMappedPixelData(snapshot.mappedPixelData);
    setColorCounts(snapshot.colorCounts);
    setTotalBeadCount(snapshot.totalBeadCount);
    setRedoHistory(prev => prev.slice(0, -1));
    showToast('已恢复上一步');
  }, [redoHistory, mappedPixelData, colorCounts, totalBeadCount, showToast]);

  // 清空编辑历史（参数变化、退出编辑模式等时调用）
  const clearEditHistory = useCallback(() => {
    setEditHistory([]);
    setRedoHistory([]);
    paintStrokeRef.current = {
      active: false,
      snapshotSaved: false,
      lastPoint: null,
      touchedCells: new Set<string>(),
      workingData: null,
    };
  }, []);

  // 放大镜像素编辑处理函数
  const handleMagnifierPixelEdit = (row: number, col: number, colorData: { key: string; color: string }) => {
    if (!mappedPixelData) return;

    const oldPixel = mappedPixelData[row][col];
    if (!oldPixel || oldPixel.key === colorData.key) return;

    // 创建新的像素数据
    const newMappedPixelData = mappedPixelData.map((rowData, r) =>
      rowData.map((pixel, c) => {
        if (r === row && c === col) {
          return {
            key: colorData.key,
            color: colorData.color
          } as MappedPixel;
        }
        return pixel;
      })
    );

    saveEditSnapshot();
    setMappedPixelData(newMappedPixelData);

    // 更新颜色统计
    if (colorCounts) {
      const newColorCounts = { ...colorCounts };

      // 减少原颜色的计数
      if (newColorCounts[oldPixel.key]) {
        newColorCounts[oldPixel.key].count--;
        if (newColorCounts[oldPixel.key].count === 0) {
          delete newColorCounts[oldPixel.key];
        }
      }

      // 增加新颜色的计数
      if (newColorCounts[colorData.key]) {
        newColorCounts[colorData.key].count++;
      } else {
        newColorCounts[colorData.key] = {
          count: 1,
          color: colorData.color
        };
      }

      setColorCounts(newColorCounts);

      // 更新总计数
      const newTotal = Object.values(newColorCounts).reduce((sum, item) => sum + item.count, 0);
      setTotalBeadCount(newTotal);
    }
  };

  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const pixelatedCanvasRef = useRef<HTMLCanvasElement>(null);
  const mainImportInputRef = useRef<HTMLInputElement>(null);
  // ++ 添加: Ref for import file input ++
  const importPaletteInputRef = useRef<HTMLInputElement>(null);
  //const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  // ++ Re-add touch refs needed for tooltip logic ++
  //const touchStartPosRef = useRef<{ x: number; y: number; pageX: number; pageY: number } | null>(null);
  //const touchMovedRef = useRef<boolean>(false);

  // ++ Add a ref for the main element ++
  const mainRef = useRef<HTMLElement>(null);

  // --- Derived State ---

  useEffect(() => {
    try {
      const stored = localStorage.getItem(APPEARANCE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const normalized = normalizeAppearanceSettings({
          ...parsed,
          font: parsed.version ? parsed.font : defaultAppearanceSettings.font,
        });
        setAppearanceSettings(normalized);
        localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify({ ...normalized, version: APPEARANCE_VERSION }));
      } else {
        localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify({ ...defaultAppearanceSettings, version: APPEARANCE_VERSION }));
      }
    } catch (error) {
      console.warn('读取外观设置失败，已使用默认设置:', error);
      setAppearanceSettings(defaultAppearanceSettings);
    }
  }, []);

  // Update active palette based on selection and exclusions
  useEffect(() => {
    const selectionValues = Object.values(customPaletteSelections);
    const useFullPalette = selectionValues.length === 0 || !selectionValues.some(Boolean);
    const newActiveBeadPalette = fullBeadPalette.filter(color => {
      const normalizedHex = color.hex.toUpperCase();
      const isSelectedInCustomPalette = useFullPalette || customPaletteSelections[normalizedHex];
      const isNotExcluded = !excludedColorKeys.has(normalizedHex);
      return isSelectedInCustomPalette && isNotExcluded;
    });
    // 根据选择的色号系统转换调色板
    const convertedPalette = convertPaletteToColorSystem(newActiveBeadPalette, selectedColorSystem);
    setActiveBeadPalette(convertedPalette);
  }, [customPaletteSelections, excludedColorKeys, remapTrigger, selectedColorSystem]);

  // ++ 添加：当状态变化时同步更新输入框的值 ++
  useEffect(() => {
    setGranularityInput(granularity.toString());
    setSimilarityThresholdInput(similarityThreshold.toString());
  }, [granularity, similarityThreshold]);

  // ++ Calculate unique colors currently on the grid for the palette ++
  const currentGridColors = useMemo(() => {
    if (!mappedPixelData) return [];
    // 使用hex值进行去重，避免多个MARD色号对应同一个目标色号系统值时产生重复key
    const uniqueColorsMap = new Map<string, MappedPixel>();
    mappedPixelData.flat().forEach(cell => {
      if (cell && cell.color && !cell.isExternal) {
        const hexKey = cell.color.toUpperCase();
        if (!uniqueColorsMap.has(hexKey)) {
          // 存储hex值作为key，保持颜色信息
          uniqueColorsMap.set(hexKey, { key: cell.key, color: cell.color });
        }
      }
    });
    
    // 转换为数组并为每个hex值生成对应的色号系统显示
    const originalColors = Array.from(uniqueColorsMap.values());
    
    const colorData = originalColors.map(color => {
      const displayKey = getColorKeyByHex(color.color.toUpperCase(), selectedColorSystem);
      return {
        key: displayKey,
        color: color.color
      };
    });

    // 使用色相排序而不是色号排序
    return sortColorsByHue(colorData);
  }, [mappedPixelData, selectedColorSystem]);

  // 初始化时从本地存储加载自定义色板选择
  useEffect(() => {
    // 尝试从localStorage加载
    const savedSelections = loadPaletteSelections();
    if (savedSelections && Object.keys(savedSelections).length > 0) {
      console.log('从localStorage加载的数据键数量:', Object.keys(savedSelections).length);
      // 验证加载的数据是否都是有效的hex值
      const allHexValues = fullBeadPalette.map(color => color.hex.toUpperCase());
      const validSelections: PaletteSelections = {};
      let hasValidData = false;
      let validCount = 0;
      let invalidCount = 0;
      let selectedValidCount = 0;
      
      Object.entries(savedSelections).forEach(([key, value]) => {
        // 严格验证：键必须是有效的hex格式，并且存在于调色板中
        if (/^#[0-9A-F]{6}$/i.test(key) && allHexValues.includes(key.toUpperCase())) {
          validSelections[key.toUpperCase()] = value;
          hasValidData = true;
          validCount++;
          if (value) selectedValidCount++;
        } else {
          invalidCount++;
        }
      });
      
      console.log(`验证结果: 有效键 ${validCount} 个, 选中 ${selectedValidCount} 个, 无效键 ${invalidCount} 个`);
      
      if (hasValidData && selectedValidCount > 0) {
        setCustomPaletteSelections(validSelections);
    setIsCustomPalette(true);
    } else {
        console.log('本地色板无效或没有选中颜色，清除localStorage并重新初始化');
        // 如果本地数据无效或没有选中颜色，清除localStorage并默认选择所有颜色
        localStorage.removeItem('customPerlerPaletteSelections');
        const allHexValues = fullBeadPalette.map(color => color.hex.toUpperCase());
        const initialSelections = presetToSelections(allHexValues, allHexValues);
      setCustomPaletteSelections(initialSelections);
      setIsCustomPalette(false);
    }
    } else {
      console.log('没有localStorage数据，默认选择所有颜色');
      // 如果没有保存的选择，默认选择所有颜色
      const allHexValues = fullBeadPalette.map(color => color.hex.toUpperCase());
      const initialSelections = presetToSelections(allHexValues, allHexValues);
      setCustomPaletteSelections(initialSelections);
      setIsCustomPalette(false);
    }
  }, []); // 只在组件首次加载时执行

  // --- Event Handlers ---

  // 专心拼豆模式在同一工作台内运行，保留预览/编辑上下文。
  const enterFocusWorkbench = () => {
    if (!mappedPixelData || !gridDimensions || !colorCounts) return;

    const progress = Object.entries(colorCounts).reduce<Record<string, { completed: number; total: number }>>((acc, [hex, data]) => {
      acc[hex] = focusState.colorProgress[hex] || { completed: 0, total: data.count };
      return acc;
    }, {});
    const firstColor = Object.keys(progress)[0] || '';

    setFocusState(prev => ({
      ...prev,
      currentColor: prev.currentColor && progress[prev.currentColor] ? prev.currentColor : firstColor,
      colorProgress: progress,
      canvasScale: prev.canvasScale || 1,
      canvasOffset: prev.canvasOffset || { x: 0, y: 0 },
      lastResumeTime: Date.now(),
      isPaused: false,
      showColorPanel: false,
      showSettingsPanel: false,
    }));
    setIsManualColoringMode(false);
    setSelectedColor(null);
    setWorkspaceMode('focus');
    setTooltipData(null);
    setIsEraseMode(false);
    resetPendingEditorGestures();
  };

  const hasWorkInProgress = Boolean(mappedPixelData && gridDimensions && colorCounts);

  const handleAppearanceChange = <K extends keyof AppearanceSettings>(key: K, value: AppearanceSettings[K]) => {
    setAppearanceSettings(prev => {
      const next = normalizeAppearanceSettings({ ...prev, [key]: value });
      if (typeof window !== 'undefined') {
        localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify({ ...next, version: APPEARANCE_VERSION }));
      }
      return next;
    });
  };

  const handleResetAppearance = () => {
    setAppearanceSettings(defaultAppearanceSettings);
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify({ ...defaultAppearanceSettings, version: APPEARANCE_VERSION }));
    showToast('外观已恢复默认');
  };

  const handleSaveDraft = () => {
    if (!mappedPixelData || !gridDimensions || !colorCounts) {
      showToast('还没有可保存的图纸');
      return;
    }

    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
        app: APP_NAME,
        savedAt: new Date().toISOString(),
        originalImageSrc,
        mappedPixelData,
        gridDimensions,
        colorCounts,
        totalBeadCount,
        granularity,
        similarityThreshold,
        pixelationMode,
        selectedColorSystem,
        customPaletteSelections,
        isCustomPalette,
      }));
      showToast('草稿已保存到本机');
      setIsMobilePanelOpen(false);
    } catch (error) {
      console.error('保存草稿失败:', error);
      showToast('保存失败，浏览器存储空间可能不足');
    }
  };

  const handleRestoreDraft = () => {
    try {
      const storedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!storedDraft) {
        showToast('本机没有保存的草稿');
        return;
      }

      const draft = JSON.parse(storedDraft);
      setOriginalImageSrc(draft.originalImageSrc || generateSyntheticImageFromPixelData(draft.mappedPixelData, draft.gridDimensions));
      setMappedPixelData(draft.mappedPixelData);
      setGridDimensions(draft.gridDimensions);
      setColorCounts(draft.colorCounts);
      setTotalBeadCount(draft.totalBeadCount || 0);
      setGranularity(draft.granularity || DEFAULT_GRANULARITY);
      setGranularityInput((draft.granularity || DEFAULT_GRANULARITY).toString());
      setSimilarityThreshold(draft.similarityThreshold ?? 30);
      setSimilarityThresholdInput((draft.similarityThreshold ?? 30).toString());
      setPixelationMode(draft.pixelationMode || PixelationMode.Dominant);
      setSelectedColorSystem(draft.selectedColorSystem || 'MARD');
      setCustomPaletteSelections(draft.customPaletteSelections || customPaletteSelections);
      setIsCustomPalette(Boolean(draft.isCustomPalette));
      setInitialGridColorKeys(new Set(Object.keys(draft.colorCounts || {})));
      setExcludedColorKeys(new Set());
      setIsManualColoringMode(false);
      setSelectedColor(null);
      setIsEraseMode(false);
      setWorkspaceMode('preview');
      intendedWorkspaceModeRef.current = 'preview';
      setWorkspaceCanvasScaleTouched(false);
      setIsMobilePanelOpen(false);
      resetPendingEditorGestures();
      clearEditHistory();
      showToast('已恢复本机草稿');
    } catch (error) {
      console.error('恢复草稿失败:', error);
      showToast('草稿读取失败');
    }
  };

  const handleCopyShoppingList = async () => {
    if (!colorCounts || Object.keys(colorCounts).length === 0) {
      showToast('还没有采购清单');
      return;
    }

    const listText = Object.keys(colorCounts)
      .sort(sortColorKeys)
      .map(hexKey => `${getColorKeyByHex(hexKey, selectedColorSystem)}  ${colorCounts[hexKey].count} 颗  ${hexKey}`)
      .join('\n');

    const text = `${APP_NAME} 采购清单\n尺寸：${gridDimensions?.N ?? '-'} x ${gridDimensions?.M ?? '-'}\n总计：${totalBeadCount} 颗\n\n${listText}`;

    try {
      await navigator.clipboard.writeText(text);
      showToast('采购清单已复制');
    } catch (error) {
      console.error('复制采购清单失败:', error);
      showToast('复制失败，请检查浏览器权限');
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      showToast(`正在导入 ${file.name}`);
      // 检查文件类型是否支持
      const fileName = file.name.toLowerCase();
      const fileType = file.type.toLowerCase();
      
      // 支持的图片类型
      const supportedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      // 支持的CSV MIME类型（不同浏览器可能返回不同的MIME类型）
      const supportedCsvTypes = ['text/csv', 'application/csv', 'text/plain'];

      const isImageFile = supportedImageTypes.includes(fileType) || fileType.startsWith('image/');
      const isCsvFile = supportedCsvTypes.includes(fileType) || fileName.endsWith('.csv');

      if (isImageFile || isCsvFile) {
        setExcludedColorKeys(new Set()); // ++ 重置排除列表 ++
        setWorkspaceMode('optimize');
        intendedWorkspaceModeRef.current = 'optimize';
        resetPendingEditorGestures();
        processFile(file);
      } else {
        alert(`不支持的文件类型: ${file.type || '未知'}。请选择 JPG、PNG、GIF 格式的图片文件，或 CSV 数据文件。\n文件名: ${file.name}`);
        console.warn(`Unsupported file type: ${file.type}, file name: ${file.name}`);
      }
    }
    // 重置文件输入框的值，这样用户可以重新选择同一个文件
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    
    try {
      if (event.dataTransfer.files && event.dataTransfer.files[0]) {
        const file = event.dataTransfer.files[0];
        
        // 使用与handleFileChange相同的文件类型检查逻辑
        const fileName = file.name.toLowerCase();
        const fileType = file.type.toLowerCase();
        
        // 支持的图片类型
        const supportedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        // 支持的CSV MIME类型（不同浏览器可能返回不同的MIME类型）
        const supportedCsvTypes = ['text/csv', 'application/csv', 'text/plain'];

        const isImageFile = supportedImageTypes.includes(fileType) || fileType.startsWith('image/');
        const isCsvFile = supportedCsvTypes.includes(fileType) || fileName.endsWith('.csv');

        if (isImageFile || isCsvFile) {
          setExcludedColorKeys(new Set()); // ++ 重置排除列表 ++
          setWorkspaceMode('optimize');
          intendedWorkspaceModeRef.current = 'optimize';
          resetPendingEditorGestures();
          processFile(file);
        } else {
          alert(`不支持的文件类型: ${file.type || '未知'}。请拖放 JPG、PNG、GIF 格式的图片文件，或 CSV 数据文件。\n文件名: ${file.name}`);
          console.warn(`Unsupported file type: ${file.type}, file name: ${file.name}`);
        }
      }
    } catch (error) {
      console.error("处理拖拽文件时发生错误:", error);
      alert("处理文件时发生错误，请重试。");
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const resetEditorLayers = () => {
    setEditorLayers([{ id: 'base', name: '主体', type: 'base', visible: true, locked: true }]);
    setActiveLayerId('base');
    setStickers([]);
  };

  const handleAddEditorLayer = () => {
    const id = `layer-${Date.now()}`;
    const newLayer: EditorLayer = {
      id,
      name: `图层 ${editorLayers.filter(layer => layer.type === 'layer').length + 1}`,
      type: 'layer',
      visible: true,
      locked: false,
    };
    setEditorLayers(prev => [newLayer, ...prev]);
    setActiveLayerId(id);
    showToast('已添加空白图层');
  };

  const handleAddStickerRequest = () => {
    setIsStickerPanelOpen(true);
  };

  const handleLayerSelect = (id: string) => {
    setActiveLayerId(id);
  };

  const handleToggleLayerVisible = (id: string) => {
    setEditorLayers(prev => prev.map(layer => (
      layer.id === id ? { ...layer, visible: !layer.visible } : layer
    )));
  };

  const handleToggleLayerLock = (id: string) => {
    setEditorLayers(prev => prev.map(layer => (
      layer.id === id ? { ...layer, locked: !layer.locked } : layer
    )));
  };

  const handleDuplicateLayer = (id: string) => {
    const layer = editorLayers.find(item => item.id === id);
    if (!layer) return;

    const nextId = `${layer.type}-${Date.now()}`;
    const duplicate: EditorLayer = {
      ...layer,
      id: nextId,
      name: `${layer.name} 副本`,
      locked: false,
    };
    setEditorLayers(prev => {
      const index = prev.findIndex(item => item.id === id);
      if (index < 0) return [duplicate, ...prev];
      const next = [...prev];
      next.splice(index, 0, duplicate);
      return next;
    });
    if (layer.type === 'sticker') {
      setStickers(prev => [
        ...prev
          .filter(sticker => sticker.layerId === id)
          .map(sticker => ({
            ...sticker,
            id: `${nextId}-${Date.now()}`,
            layerId: nextId,
            x: Math.min(100, sticker.x + 4),
            y: Math.min(100, sticker.y + 4),
          })),
        ...prev,
      ]);
    }
    setActiveLayerId(nextId);
    showToast('已复制图层');
  };

  const handleMoveLayer = (id: string, direction: 'up' | 'down') => {
    setEditorLayers(prev => {
      const index = prev.findIndex(layer => layer.id === id);
      if (index < 0) return prev;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const handleDeleteLayer = (id: string) => {
    const layer = editorLayers.find(item => item.id === id);
    if (!layer || layer.type === 'base') return;

    setEditorLayers(prev => prev.filter(item => item.id !== id));
    setStickers(prev => prev.filter(sticker => sticker.layerId !== id));
    if (activeLayerId === id) {
      setActiveLayerId('base');
    }
    showToast('已删除图层');
  };

  const handleCreateStickerLayer = () => {
    const id = `sticker-${Date.now()}`;
    const newLayer: EditorLayer = {
      id,
      name: `贴纸 · ${stickerDraft.shape}`,
      type: 'sticker',
      visible: true,
      locked: false,
    };
    setEditorLayers(prev => [newLayer, ...prev]);
    setStickers(prev => [
      {
        ...stickerDraft,
        id: `${id}-item`,
        layerId: id,
        x: 50,
        y: 50,
      },
      ...prev,
    ]);
    setActiveLayerId(id);
    setIsStickerPanelOpen(false);
    showToast('已添加贴纸');
  };

  const getStickerLayer = (layerId: string) => editorLayers.find(layer => layer.id === layerId);

  const handleStickerPointerDown = (event: React.PointerEvent<HTMLButtonElement>, stickerId: string) => {
    const sticker = stickers.find(item => item.id === stickerId);
    const layer = sticker ? getStickerLayer(sticker.layerId) : null;
    if (!sticker || !layer || layer.locked || !layer.visible) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingStickerId(stickerId);
    setActiveLayerId(sticker.layerId);
  };

  const handleStickerPointerMove = (event: React.PointerEvent<HTMLButtonElement>, stickerId: string) => {
    if (draggingStickerId !== stickerId) return;

    const board = event.currentTarget.parentElement;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setStickers(prev => prev.map(sticker => (
      sticker.id === stickerId
        ? { ...sticker, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) }
        : sticker
    )));
  };

  const handleStickerPointerEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (draggingStickerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDraggingStickerId(null);
  };

  // 根据mappedPixelData生成合成的originalImageSrc
  const generateSyntheticImageFromPixelData = (pixelData: MappedPixel[][], dimensions: { N: number; M: number }): string => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.error('无法创建canvas上下文');
      return '';
    }
    
    // 设置画布尺寸，每个像素用8x8像素来表示以确保清晰度
    const pixelSize = 8;
    canvas.width = dimensions.N * pixelSize;
    canvas.height = dimensions.M * pixelSize;
    
    // 绘制每个像素
    pixelData.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (cell) {
          // 使用颜色，外部单元格用白色
          const color = cell.isExternal ? '#FFFFFF' : cell.color;
          ctx.fillStyle = color;
          ctx.fillRect(
            colIndex * pixelSize, 
            rowIndex * pixelSize, 
            pixelSize, 
            pixelSize
          );
        }
      });
    });
    
    // 转换为dataURL
    return canvas.toDataURL('image/png');
  };

  const processFile = (file: File) => {
    // 检查文件类型
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    if (fileExtension === 'csv') {
      // 处理CSV文件
      console.log('正在导入CSV文件...');
      importCsvData(file)
        .then(({ mappedPixelData, gridDimensions }) => {
          console.log(`成功导入CSV文件: ${gridDimensions.N}x${gridDimensions.M}`);
          
          // 设置导入的数据
          setMappedPixelData(mappedPixelData);
          setGridDimensions(gridDimensions);
          setOriginalImageSrc(null); // CSV导入时没有原始图片
          
          // 计算颜色统计
          const colorCountsMap: { [key: string]: { count: number; color: string } } = {};
          let totalCount = 0;
          
          mappedPixelData.forEach(row => {
            row.forEach(cell => {
              if (cell && !cell.isExternal) {
                const colorKey = cell.color.toUpperCase();
                if (colorCountsMap[colorKey]) {
                  colorCountsMap[colorKey].count++;
                } else {
                  colorCountsMap[colorKey] = {
                    count: 1,
                    color: cell.color
                  };
                }
                totalCount++;
              }
            });
          });
          
          setColorCounts(colorCountsMap);
          setTotalBeadCount(totalCount);
          setInitialGridColorKeys(new Set(Object.keys(colorCountsMap)));
          
          // 根据mappedPixelData生成合成的originalImageSrc
          const syntheticImageSrc = generateSyntheticImageFromPixelData(mappedPixelData, gridDimensions);
          
          setOriginalImageSrc(syntheticImageSrc);
          
          // 重置状态
          setIsManualColoringMode(false);
          setSelectedColor(null);
          setIsEraseMode(false);
          resetEditorLayers();
          setWorkspaceMode('preview');
          intendedWorkspaceModeRef.current = 'preview';
          setWorkspaceCanvasScaleTouched(false);
          setIsMobilePanelOpen(false);
          resetPendingEditorGestures();
          
          // 设置格子数量为导入的尺寸，避免重新映射时尺寸被修改
          setGranularity(gridDimensions.N);
          setGranularityInput(gridDimensions.N.toString());
          
          alert(`成功导入CSV文件！图纸尺寸：${gridDimensions.N}x${gridDimensions.M}，共使用${Object.keys(colorCountsMap).length}种颜色。`);
        })
        .catch(error => {
          console.error('CSV导入失败:', error);
          alert(`CSV导入失败：${error.message}`);
        });
    } else {
      // 处理图片文件
      const applyImageSrc = (result: string) => {
        setOriginalImageSrc(result);
        setMappedPixelData(null);
        setGridDimensions(null);
        setColorCounts(null);
        setTotalBeadCount(0);
        setInitialGridColorKeys(new Set()); // ++ 重置初始键 ++
        resetEditorLayers();
        // ++ 重置横轴格子数量为默认值 ++
        const defaultGranularity = DEFAULT_GRANULARITY;
        setGranularity(defaultGranularity);
        setGranularityInput(defaultGranularity.toString());
        setWorkspaceCanvasScaleTouched(false);
        setIsMobilePanelOpen(false);
        setRemapTrigger(prev => prev + 1); // Trigger full remap for new image
      };

      const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');

      if (isGif) {
        // GIF 走 createImageBitmap，规范保证返回首帧（default image），再烘焙为 PNG dataURL
        createImageBitmap(file)
          .then((bitmap) => {
            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('无法创建 Canvas 上下文');
            ctx.drawImage(bitmap, 0, 0);
            bitmap.close();
            applyImageSrc(canvas.toDataURL('image/png'));
          })
          .catch((error) => {
            console.error('GIF 处理失败:', error);
            alert('无法读取 GIF 文件。');
            setInitialGridColorKeys(new Set());
          });
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          applyImageSrc(e.target?.result as string);
        };
        reader.onerror = () => {
          console.error("文件读取失败");
          alert("无法读取文件。");
          setInitialGridColorKeys(new Set()); // ++ 重置初始键 ++
        };
        reader.readAsDataURL(file);
      }
      // ++ Reset manual coloring mode when a new file is processed ++
      setIsManualColoringMode(false);
      setSelectedColor(null);
      setIsEraseMode(false);
      setWorkspaceMode('optimize');
      intendedWorkspaceModeRef.current = 'optimize';
      resetPendingEditorGestures();
    }
  };

  // ++ 新增：处理输入框变化的函数 ++
  const handleGranularityInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setGranularityInput(event.target.value);
  };

  // ++ 添加：处理相似度输入框变化的函数 ++
  const handleSimilarityThresholdInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSimilarityThresholdInput(event.target.value);
  };

  // ++ 修改：处理确认按钮点击的函数，同时处理两个参数 ++
  const handleConfirmParameters = () => {
    // 处理格子数
    const minGranularity = 10;
    const maxGranularity = 300;
    let newGranularity = parseInt(granularityInput, 10);

    if (isNaN(newGranularity) || newGranularity < minGranularity) {
      newGranularity = minGranularity;
    } else if (newGranularity > maxGranularity) {
      newGranularity = maxGranularity;
    }

    // 处理相似度阈值
    const minSimilarity = 0;
    const maxSimilarity = 100;
    let newSimilarity = parseInt(similarityThresholdInput, 10);
    
    if (isNaN(newSimilarity) || newSimilarity < minSimilarity) {
      newSimilarity = minSimilarity;
    } else if (newSimilarity > maxSimilarity) {
      newSimilarity = maxSimilarity;
    }

    // 检查值是否有变化
    const granularityChanged = newGranularity !== granularity;
    const similarityChanged = newSimilarity !== similarityThreshold;
    
    if (granularityChanged) {
      console.log(`Confirming new granularity: ${newGranularity}`);
      setGranularity(newGranularity);
    }
    
    if (similarityChanged) {
      console.log(`Confirming new similarity threshold: ${newSimilarity}`);
      setSimilarityThreshold(newSimilarity);
    }
    
    // 只有在有值变化时才触发重映射
    if (granularityChanged || similarityChanged) {
      setRemapTrigger(prev => prev + 1);
      // 退出手动上色模式
      setIsManualColoringMode(false);
      setSelectedColor(null);
    }

    // 始终同步输入框的值
    setGranularityInput(newGranularity.toString());
    setSimilarityThresholdInput(newSimilarity.toString());
  };

  // 添加像素化模式切换处理函数
  const handlePixelationModeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const newMode = event.target.value as PixelationMode;
    if (Object.values(PixelationMode).includes(newMode)) {
        setPixelationMode(newMode);
        setRemapTrigger(prev => prev + 1); // 触发重新映射
        setIsManualColoringMode(false); // 退出手动模式
        setSelectedColor(null);
    } else {
        console.warn(`无效的像素化模式: ${newMode}`);
    }
  };

  // 修改pixelateImage函数接收模式参数
  const pixelateImage = (imageSrc: string, detailLevel: number, threshold: number, currentPalette: PaletteColor[], mode: PixelationMode) => {
    console.log(`Attempting to pixelate with detail: ${detailLevel}, threshold: ${threshold}, mode: ${mode}`);
    const originalCanvas = originalCanvasRef.current ?? document.createElement('canvas');
    const pixelatedCanvas = pixelatedCanvasRef.current ?? document.createElement('canvas');

    const originalCtx = originalCanvas.getContext('2d', { willReadFrequently: true });
    const pixelatedCtx = pixelatedCanvas.getContext('2d');
    if (!originalCtx || !pixelatedCtx) {
      console.error("Canvas context(s) not found.");
      showToast('导入失败：浏览器无法创建画布');
      return;
    }
    console.log("Canvas contexts obtained.");

    if (currentPalette.length === 0) {
        console.error("Cannot pixelate: The selected color palette is empty (likely due to exclusions).");
        alert("错误：当前可用颜色板为空（可能所有颜色都被排除了），无法处理图像。请尝试恢复部分颜色。");
        // Clear previous results visually
        pixelatedCtx.clearRect(0, 0, pixelatedCanvas.width, pixelatedCanvas.height);
        setMappedPixelData(null);
        setGridDimensions(null);
        // Keep colorCounts potentially showing the last valid counts? Or clear them too?
        // setColorCounts(null); // Decide if clearing counts is desired when palette is empty
        // setTotalBeadCount(0);
        return; // Stop processing
    }
    const t1FallbackColor = currentPalette.find(p => p.key === 'T1')
                         || currentPalette.find(p => p.hex.toUpperCase() === '#FFFFFF')
                         || currentPalette[0]; // 使用第一个可用颜色作为备用
    console.log("Using fallback color for empty cells:", t1FallbackColor);

    const img = new window.Image();
    
    img.onerror = (error: Event | string) => {
      console.error("Image loading failed:", error); 
      showToast('导入失败：无法加载图片');
      setOriginalImageSrc(null); 
      setMappedPixelData(null); 
      setGridDimensions(null); 
      setColorCounts(null); 
      setInitialGridColorKeys(new Set());
    };
    
    img.onload = () => {
      try {
        console.log("Image loaded successfully.");
        const aspectRatio = img.height / img.width;
        const N = detailLevel;
        const M = Math.max(1, Math.round(N * aspectRatio));
        if (N <= 0 || M <= 0) {
          console.error("Invalid grid dimensions:", { N, M });
          showToast('导入失败：图片尺寸异常');
          return;
        }
        console.log(`Grid size: ${N}x${M}`);

        // 动态调整画布尺寸：当格子数量大于100时，增加画布尺寸以保持每个格子的可见性
        const baseWidth = 500;
        const minCellSize = 4; // 每个格子的最小尺寸（像素）
        const recommendedCellSize = 6; // 推荐的格子尺寸（像素）
        
        let outputWidth = baseWidth;
        
        // 如果格子数量大于100，计算需要的画布宽度
        if (N > 100) {
          const requiredWidthForMinSize = N * minCellSize;
          const requiredWidthForRecommendedSize = N * recommendedCellSize;
          
          // 使用推荐尺寸，但不超过屏幕宽度的90%（最大1200px）
          const maxWidth = Math.min(1200, window.innerWidth * 0.9);
          outputWidth = Math.min(maxWidth, Math.max(baseWidth, requiredWidthForRecommendedSize));
          
          // 确保不小于最小要求
          outputWidth = Math.max(outputWidth, requiredWidthForMinSize);
          
          console.log(`Large grid detected (${N} columns). Adjusted canvas width from ${baseWidth} to ${outputWidth}px (cell size: ${Math.round(outputWidth / N)}px)`);
        }
        
        const outputHeight = Math.round(outputWidth * aspectRatio);
        
        // 在控制台提示用户画布尺寸变化
        if (N > 100) {
          console.log(`由于格子数量较多 (${N}x${M})，画布已自动放大以保持清晰度。可以使用水平滚动查看完整图像。`);
        }
        originalCanvas.width = img.width; originalCanvas.height = img.height;
        pixelatedCanvas.width = outputWidth; pixelatedCanvas.height = outputHeight;
        console.log(`Canvas dimensions: Original ${img.width}x${img.height}, Output ${outputWidth}x${outputHeight}`);

        originalCtx.drawImage(img, 0, 0, img.width, img.height);
        console.log("Original image drawn.");

        // 1. 使用calculatePixelGrid进行初始颜色映射
        console.log("Starting initial color mapping using calculatePixelGrid...");
        const initialMappedData = calculatePixelGrid(
            originalCtx,
            img.width,
            img.height,
            N,
            M,
            currentPalette, 
            mode,
            t1FallbackColor
        );
        console.log(`Initial data mapping complete using mode ${mode}. Starting connected-region color merging...`);

        const keyToColorDataMap = new Map<string, PaletteColor>();
        currentPalette.forEach(p => keyToColorDataMap.set(p.key, p));

        const mergedData: MappedPixel[][] = initialMappedData.map(row =>
          row.map(cell => ({ ...cell, isExternal: false }))
        );
        const visitedForMerge = Array(M).fill(null).map(() => Array(N).fill(false));
        const similarityThresholdValue = threshold;
        const directions: GridPoint[] = [
          { row: -1, col: 0 },
          { row: 1, col: 0 },
          { row: 0, col: -1 },
          { row: 0, col: 1 },
        ];

        for (let row = 0; row < M; row++) {
          for (let col = 0; col < N; col++) {
            if (visitedForMerge[row][col]) continue;
            const seedCell = mergedData[row][col];
            const seedRgb = hexToRgb(seedCell.color);
            if (!seedCell || !seedRgb) {
              visitedForMerge[row][col] = true;
              continue;
            }

            const region: GridPoint[] = [];
            const regionColorCounts = new Map<string, number>();
            const stack: GridPoint[] = [{ row, col }];
            visitedForMerge[row][col] = true;

            while (stack.length > 0) {
              const point = stack.pop()!;
              const currentCell = mergedData[point.row][point.col];
              region.push(point);
              regionColorCounts.set(currentCell.key, (regionColorCounts.get(currentCell.key) || 0) + 1);

              directions.forEach(direction => {
                const nextRow = point.row + direction.row;
                const nextCol = point.col + direction.col;
                if (nextRow < 0 || nextRow >= M || nextCol < 0 || nextCol >= N || visitedForMerge[nextRow][nextCol]) return;
                const nextCell = mergedData[nextRow][nextCol];
                const nextRgb = hexToRgb(nextCell.color);
                if (!nextRgb) return;
                if (colorDistance(seedRgb, nextRgb) <= similarityThresholdValue) {
                  visitedForMerge[nextRow][nextCol] = true;
                  stack.push({ row: nextRow, col: nextCol });
                }
              });
            }

            let dominantKey = seedCell.key;
            let dominantCount = -1;
            regionColorCounts.forEach((count, key) => {
              if (count > dominantCount) {
                dominantKey = key;
                dominantCount = count;
              }
            });

            const dominantColor = keyToColorDataMap.get(dominantKey);
            if (dominantColor) {
              region.forEach(point => {
                mergedData[point.row][point.col] = {
                  key: dominantColor.key,
                  color: dominantColor.hex,
                  isExternal: false,
                };
              });
            }
          }
        }

        setMappedPixelData(mergedData);
        setGridDimensions({ N, M });

        const counts: { [key: string]: { count: number; color: string } } = {};
        let totalCount = 0;
        mergedData.flat().forEach(cell => {
          if (cell && cell.key && !cell.isExternal) {
            // 使用hex值作为统计键值，而不是色号
            const hexKey = cell.color;
            if (!counts[hexKey]) {
              counts[hexKey] = { count: 0, color: cell.color };
            }
            counts[hexKey].count++;
            totalCount++;
          }
        });
        setColorCounts(counts);
        setTotalBeadCount(totalCount);
        setInitialGridColorKeys(new Set(Object.keys(counts)));
        console.log("Color counts updated based on merged data (after merging):", counts);
        console.log("Total bead count (total beads):", totalCount);
        console.log("Stored initial grid color keys:", Object.keys(counts));
        showToast(`导入完成：${N} x ${M}`);
      } catch (error) {
        console.error("Pixelation failed:", error);
        showToast('导入失败：图片处理出错');
        setMappedPixelData(null);
        setGridDimensions(null);
        setColorCounts(null);
        setInitialGridColorKeys(new Set());
      }
    }; // 正确闭合 img.onload 函数
    
    console.log("Setting image source...");
    img.src = imageSrc;
    setIsManualColoringMode(false);
    setSelectedColor(null);
    setWorkspaceMode('preview');
    intendedWorkspaceModeRef.current = 'preview';
    resetPendingEditorGestures();
  }; // 正确闭合 pixelateImage 函数

  // 当 remapTrigger 变化时清空撤回历史（参数调整/颜色排除/新图上传等均会触发 remap）
  useEffect(() => {
    clearEditHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remapTrigger]);

  // 修改useEffect中的pixelateImage调用，加入模式参数
  useEffect(() => {
    if (originalImageSrc && activeBeadPalette.length > 0) {
       const timeoutId = setTimeout(() => {
         if (originalImageSrc && activeBeadPalette.length > 0) {
           console.log("useEffect triggered: Processing image due to src, granularity, threshold, palette selection, mode or remap trigger.");
           pixelateImage(originalImageSrc, granularity, similarityThreshold, activeBeadPalette, pixelationMode);
         } else {
            console.warn("useEffect check failed inside timeout: Refs or active palette not ready/empty.");
         }
       }, 50);
       return () => clearTimeout(timeoutId);
    } else if (originalImageSrc && activeBeadPalette.length === 0) {
        console.warn("Image selected, but the active palette is empty after exclusions. Cannot process. Clearing preview.");
        const pixelatedCanvas = pixelatedCanvasRef.current;
        const pixelatedCtx = pixelatedCanvas?.getContext('2d');
        if (pixelatedCtx && pixelatedCanvas) {
            pixelatedCtx.clearRect(0, 0, pixelatedCanvas.width, pixelatedCanvas.height);
            // Draw a message on the canvas?
            pixelatedCtx.fillStyle = '#6b7280'; // gray-500
            pixelatedCtx.font = '16px sans-serif';
            pixelatedCtx.textAlign = 'center';
            pixelatedCtx.fillText('无可用颜色，请恢复部分排除的颜色', pixelatedCanvas.width / 2, pixelatedCanvas.height / 2);
        }
        setMappedPixelData(null);
        setGridDimensions(null);
        // Keep colorCounts to allow user to un-exclude colors
        // setColorCounts(null);
        // setTotalBeadCount(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalImageSrc, granularity, similarityThreshold, customPaletteSelections, pixelationMode, remapTrigger]);

    // --- Download function (ensure filename includes palette) ---
    const handleDownloadRequest = (options?: GridDownloadOptions) => {
        // 调用移动到utils/imageDownloader.ts中的downloadImage函数
        downloadImage({
          mappedPixelData,
          gridDimensions,
          colorCounts,
          totalBeadCount,
          options: options || downloadOptions,
          activeBeadPalette,
          selectedColorSystem
        });
    };

    // --- Handler to toggle color exclusion ---
    const handleToggleExcludeColor = (hexKey: string) => {
        const currentExcluded = excludedColorKeys;
        const isExcluding = !currentExcluded.has(hexKey);

        if (isExcluding) {
            console.log(`---------\nAttempting to EXCLUDE color: ${hexKey}`);

            // --- 确保初始颜色键已记录 ---
            if (initialGridColorKeys.size === 0) {
                console.error("Cannot exclude color: Initial grid color keys not yet calculated.");
                alert("无法排除颜色，初始颜色数据尚未准备好，请稍候。");
                return;
            }
            console.log("Initial Grid Hex Keys:", Array.from(initialGridColorKeys));
            console.log("Currently Excluded Hex Keys (before this op):", Array.from(currentExcluded));

            const nextExcludedKeys = new Set(currentExcluded);
            nextExcludedKeys.add(hexKey);

            // --- 使用初始颜色键进行重映射目标逻辑 ---
            // 1. 从初始网格颜色集合开始（hex值）
            const potentialRemapHexKeys = new Set(initialGridColorKeys);
            console.log("Step 1: Potential Hex Keys (from initial):", Array.from(potentialRemapHexKeys));

            // 2. 移除当前要排除的hex键
            potentialRemapHexKeys.delete(hexKey);
            console.log(`Step 2: Potential Hex Keys (after removing ${hexKey}):`, Array.from(potentialRemapHexKeys));

            // 3. 移除任何*其他*当前也被排除的hex键
            currentExcluded.forEach(excludedHexKey => {
                potentialRemapHexKeys.delete(excludedHexKey);
            });
            console.log("Step 3: Potential Hex Keys (after removing other current exclusions):", Array.from(potentialRemapHexKeys));

            // 4. 基于剩余的hex值创建重映射调色板
            const remapTargetPalette = fullBeadPalette.filter(color => potentialRemapHexKeys.has(color.hex.toUpperCase()));
            const remapTargetHexKeys = remapTargetPalette.map(p => p.hex.toUpperCase());
            console.log("Step 4: Remap Target Palette Hex Keys:", remapTargetHexKeys);

            // 5. *** 关键检查 ***：如果在考虑所有排除项后，没有*初始*颜色可供映射，则阻止此次排除
            if (remapTargetPalette.length === 0) {
                console.warn(`Cannot exclude color '${hexKey}'. No other valid colors from the initial grid remain after considering all current exclusions.`);
                alert(`无法排除颜色 ${hexKey}，因为图中最初存在的其他可用颜色也已被排除。请先恢复部分其他颜色。`);
                console.log("---------");
                return; // 停止排除过程
            }
            console.log(`Remapping target palette (based on initial grid colors minus all exclusions) contains ${remapTargetPalette.length} colors.`);

            // 查找被排除颜色的RGB值用于重映射
            const excludedColorData = fullBeadPalette.find(p => p.hex.toUpperCase() === hexKey);
            // 检查排除颜色的数据是否存在
             if (!excludedColorData || !mappedPixelData || !gridDimensions) {
                 console.error("Cannot exclude color: Missing data for remapping.");
                 alert("无法排除颜色，缺少必要数据。");
                console.log("---------");
                 return;
             }

            console.log(`Remapping cells currently using excluded color: ${hexKey}`);
            // 仅在需要重映射时创建深拷贝
            const newMappedData = mappedPixelData.map(row => row.map(cell => ({...cell})));
            let remappedCount = 0;
            const { N, M } = gridDimensions;
            let firstReplacementHex: string | null = null;

            for (let j = 0; j < M; j++) {
                for (let i = 0; i < N; i++) {
                const cell = newMappedData[j]?.[i];
                    // 此条件正确地仅针对具有排除hex值的单元格
                    if (cell && !cell.isExternal && cell.color.toUpperCase() === hexKey) {
                        // *** 使用派生的 remapTargetPalette 查找最接近的颜色 ***
                    const replacementColor = findClosestPaletteColor(excludedColorData.rgb, remapTargetPalette);
                        if (!firstReplacementHex) firstReplacementHex = replacementColor.hex;
                        newMappedData[j][i] = { 
                            ...cell, 
                            key: replacementColor.key, 
                            color: replacementColor.hex 
                        };
                    remappedCount++;
                }
                }
            }
            console.log(`Remapped ${remappedCount} cells. First replacement hex found was: ${firstReplacementHex || 'N/A'}`);

            // 同时更新状态
            setExcludedColorKeys(nextExcludedKeys); // 应用此颜色的排除
            setMappedPixelData(newMappedData); // 使用重映射的数据更新

            // 基于*新*映射数据重新计算计数（以hex为键）
            const newCounts: { [hexKey: string]: { count: number; color: string } } = {};
            let newTotalCount = 0;
            newMappedData.flat().forEach(cell => {
                if (cell && cell.color && !cell.isExternal) {
                    const cellHex = cell.color.toUpperCase();
                    if (!newCounts[cellHex]) {
                        newCounts[cellHex] = { count: 0, color: cellHex };
                }
                    newCounts[cellHex].count++;
                    newTotalCount++;
                }
            });
            setColorCounts(newCounts);
            setTotalBeadCount(newTotalCount);
            console.log("State updated after exclusion and local remap based on initial grid colors.");
            console.log("---------");

            // ++ 在更新状态后，重新绘制 Canvas ++
            if (pixelatedCanvasRef.current && gridDimensions) {
              setMappedPixelData(newMappedData);
              // 不要调用 setGridDimensions，因为颜色排除不需要改变网格尺寸
            } else {
               console.error("Canvas ref or grid dimensions missing, skipping draw call in handleToggleExcludeColor.");
            }

        } else {
            // --- Re-including ---
            console.log(`---------\nAttempting to RE-INCLUDE color: ${hexKey}`);
            console.log(`Re-including color: ${hexKey}. Triggering full remap.`);
            const nextExcludedKeys = new Set(currentExcluded);
            nextExcludedKeys.delete(hexKey);
            setExcludedColorKeys(nextExcludedKeys);
            // 此处无需重置 initialGridColorKeys，完全重映射会通过 pixelateImage 重新计算它
            setRemapTrigger(prev => prev + 1); // *** KEPT setRemapTrigger here for re-inclusion ***
            console.log("---------");
        }
        // ++ Exit manual mode if colors are excluded/included ++
        setIsManualColoringMode(false);
        setSelectedColor(null);
        clearEditHistory();
    };

  // 一键去背景：识别边缘主色并洪水填充去除
  const handleAutoRemoveBackground = () => {
    if (!mappedPixelData || !gridDimensions) {
      alert('请先生成图纸后再使用一键去背景。');
      return;
    }

    const snapshot: EditSnapshot = {
      mappedPixelData: mappedPixelData.map(row => row.map(cell => ({ ...cell }))),
      colorCounts: colorCounts ? { ...colorCounts } : {},
      totalBeadCount,
    };

    const { N, M } = gridDimensions;
    const borderCounts = new Map<string, number>();

    const countBorderCell = (row: number, col: number) => {
      const cell = mappedPixelData[row]?.[col];
      if (!cell || cell.isExternal || cell.key === TRANSPARENT_KEY) return;
      borderCounts.set(cell.key, (borderCounts.get(cell.key) || 0) + 1);
    };

    for (let col = 0; col < N; col++) {
      countBorderCell(0, col);
      if (M > 1) countBorderCell(M - 1, col);
    }
    for (let row = 1; row < M - 1; row++) {
      countBorderCell(row, 0);
      if (N > 1) countBorderCell(row, N - 1);
    }

    if (borderCounts.size === 0) {
      alert('边缘没有可识别的背景颜色。');
      return;
    }

    let targetKey = '';
    let maxCount = -1;
    borderCounts.forEach((count, key) => {
      if (count > maxCount) {
        maxCount = count;
        targetKey = key;
      }
    });

    const newPixelData = mappedPixelData.map(row => row.map(cell => ({ ...cell })));
    const visited = Array(M).fill(null).map(() => Array(N).fill(false));
    const stack: { row: number; col: number }[] = [];

    const pushIfTarget = (row: number, col: number) => {
      if (row < 0 || row >= M || col < 0 || col >= N || visited[row][col]) {
        return;
      }
      const cell = newPixelData[row][col];
      if (!cell || cell.isExternal || cell.key !== targetKey) return;
      visited[row][col] = true;
      stack.push({ row, col });
    };

    for (let col = 0; col < N; col++) {
      pushIfTarget(0, col);
      if (M > 1) pushIfTarget(M - 1, col);
    }
    for (let row = 1; row < M - 1; row++) {
      pushIfTarget(row, 0);
      if (N > 1) pushIfTarget(row, N - 1);
    }

    if (stack.length === 0) {
      alert('未找到可去除的背景区域。');
      return;
    }

    setEditHistory(prev => [...prev.slice(-49), snapshot]);
    setRedoHistory([]);

    while (stack.length > 0) {
      const { row, col } = stack.pop()!;
      newPixelData[row][col] = { ...transparentColorData };
      pushIfTarget(row - 1, col);
      pushIfTarget(row + 1, col);
      pushIfTarget(row, col - 1);
      pushIfTarget(row, col + 1);
    }

    setMappedPixelData(newPixelData);

    const newColorCounts: { [hexKey: string]: { count: number; color: string } } = {};
    let newTotalCount = 0;
    newPixelData.flat().forEach(cell => {
      if (cell && !cell.isExternal && cell.key !== TRANSPARENT_KEY) {
        const cellHex = cell.color.toUpperCase();
        if (!newColorCounts[cellHex]) {
          newColorCounts[cellHex] = {
            count: 0,
            color: cellHex
          };
        }
        newColorCounts[cellHex].count++;
        newTotalCount++;
      }
    });

    setColorCounts(newColorCounts);
    setTotalBeadCount(newTotalCount);
    setInitialGridColorKeys(new Set(Object.keys(newColorCounts)));
  };

  // --- Tooltip Logic ---

  // --- Canvas Interaction ---

  // 洪水填充擦除函数
  const floodFillErase = (startRow: number, startCol: number, targetKey: string) => {
    if (!mappedPixelData || !gridDimensions) return;

    const { N, M } = gridDimensions;
    const newPixelData = mappedPixelData.map(row => row.map(cell => ({ ...cell })));
    const visited = Array(M).fill(null).map(() => Array(N).fill(false));
    
    // 使用栈实现非递归洪水填充
    const stack = [{ row: startRow, col: startCol }];
    
    while (stack.length > 0) {
      const { row, col } = stack.pop()!;
      
      // 检查边界
      if (row < 0 || row >= M || col < 0 || col >= N || visited[row][col]) {
        continue;
      }
      
      const currentCell = newPixelData[row][col];
      
      // 检查是否是目标颜色且不是外部区域
      if (!currentCell || currentCell.isExternal || currentCell.key !== targetKey) {
        continue;
      }
      
      // 标记为已访问
      visited[row][col] = true;
      
      // 擦除当前像素（设为透明）
      newPixelData[row][col] = { ...transparentColorData };
      
      // 添加相邻像素到栈中
      stack.push(
        { row: row - 1, col }, // 上
        { row: row + 1, col }, // 下
        { row, col: col - 1 }, // 左
        { row, col: col + 1 }  // 右
      );
    }
    
    // 更新状态
    saveEditSnapshot();
    setMappedPixelData(newPixelData);

    // 重新计算颜色统计
    if (colorCounts) {
      const newColorCounts: { [hexKey: string]: { count: number; color: string } } = {};
      let newTotalCount = 0;
      
      newPixelData.flat().forEach(cell => {
        if (cell && !cell.isExternal && cell.key !== TRANSPARENT_KEY) {
          const cellHex = cell.color.toUpperCase();
          if (!newColorCounts[cellHex]) {
            newColorCounts[cellHex] = {
              count: 0,
              color: cellHex
            };
          }
          newColorCounts[cellHex].count++;
          newTotalCount++;
        }
      });
      
      setColorCounts(newColorCounts);
      setTotalBeadCount(newTotalCount);
    }
  };

  const handleRegionEraseRequest = () => {
    setActiveEditorTool('eraser');
    setIsEraseMode(true);
    setSelectedColor(null);
    setColorReplaceState({ isActive: false, step: 'select-source' });
    showToast('点击要擦除的连通区域');
  };

  const recalculateStatsFromPixelData = (pixelData: MappedPixel[][]) => {
    const newColorCounts: { [hexKey: string]: { count: number; color: string } } = {};
    let newTotalCount = 0;

    pixelData.flat().forEach(cell => {
      if (cell && !cell.isExternal && cell.key !== TRANSPARENT_KEY) {
        const cellHex = cell.color.toUpperCase();
        if (!newColorCounts[cellHex]) {
          newColorCounts[cellHex] = { count: 0, color: cellHex };
        }
        newColorCounts[cellHex].count++;
        newTotalCount++;
      }
    });

    return { newColorCounts, newTotalCount };
  };

  const saveEditSnapshotFromPixelData = (pixelData: MappedPixel[][]) => {
    const { newColorCounts, newTotalCount } = recalculateStatsFromPixelData(pixelData);
    const snapshot: EditSnapshot = {
      mappedPixelData: pixelData.map(row => row.map(cell => ({ ...cell }))),
      colorCounts: newColorCounts,
      totalBeadCount: newTotalCount,
    };
    setEditHistory(prev => [...prev.slice(-49), snapshot]);
    setRedoHistory([]);
  };

  const commitPixelDataChange = (
    newPixelData: MappedPixel[][],
    message?: string,
    options: { saveSnapshot?: boolean; snapshotData?: MappedPixel[][] } = {},
  ) => {
    if (options.saveSnapshot !== false) {
      if (options.snapshotData) {
        saveEditSnapshotFromPixelData(options.snapshotData);
      } else {
        saveEditSnapshot();
      }
    }
    setMappedPixelData(newPixelData);
    const { newColorCounts, newTotalCount } = recalculateStatsFromPixelData(newPixelData);
    setColorCounts(newColorCounts);
    setTotalBeadCount(newTotalCount);
    if (message) showToast(message);
  };

  const buildPaintCell = (colorData: { key: string; color: string }): MappedPixel => {
    if (colorData.key === TRANSPARENT_KEY) {
      return { ...transparentColorData };
    }

    return {
      key: colorData.key,
      color: colorData.color,
      isExternal: false,
    };
  };

  const applyCells = (
    cells: GridPoint[],
    colorData: { key: string; color: string },
    sourceData: MappedPixel[][] = mappedPixelData || [],
    dimensions: { N: number; M: number } | null = gridDimensions,
    options: {
      saveSnapshot?: boolean;
      snapshotData?: MappedPixel[][];
      onApplied?: (pixelData: MappedPixel[][]) => void;
    } = {},
  ) => {
    if (!sourceData.length || !dimensions) return false;

    const { N, M } = dimensions;
    const nextCell = buildPaintCell(colorData);
    const newPixelData = sourceData.map(row => row.map(cell => ({ ...cell })));
    let changed = false;

    cells.forEach(({ row, col }) => {
      if (row < 0 || row >= M || col < 0 || col >= N) return;
      const currentCell = newPixelData[row]?.[col];
      if (!currentCell) return;

      if (
        currentCell.key !== nextCell.key ||
        currentCell.color.toUpperCase() !== nextCell.color.toUpperCase() ||
        Boolean(currentCell.isExternal) !== Boolean(nextCell.isExternal)
      ) {
        newPixelData[row][col] = { ...nextCell };
        changed = true;
      }
    });

    if (changed) {
      commitPixelDataChange(newPixelData, undefined, {
        saveSnapshot: options.saveSnapshot,
        snapshotData: options.snapshotData ?? sourceData,
      });
      options.onApplied?.(newPixelData);
    }

    return changed;
  };

  const getBrushCells = (row: number, col: number, size: number): GridPoint[] => {
    const cells: GridPoint[] = [];
    const startOffset = -Math.floor((size - 1) / 2);
    const endOffset = Math.ceil((size - 1) / 2);

    for (let y = startOffset; y <= endOffset; y++) {
      for (let x = startOffset; x <= endOffset; x++) {
        cells.push({ row: row + y, col: col + x });
      }
    }

    return cells;
  };

  const dedupeCells = (cells: GridPoint[]): GridPoint[] => {
    const seen = new Set<string>();
    return cells.filter(cell => {
      const key = `${cell.row},${cell.col}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const resetPaintStroke = () => {
    paintStrokeRef.current = {
      active: false,
      snapshotSaved: false,
      lastPoint: null,
      touchedCells: new Set<string>(),
      workingData: null,
    };
  };

  const ensurePaintStroke = () => {
    const stroke = paintStrokeRef.current;
    if (stroke.active) return stroke;

    paintStrokeRef.current = {
      active: true,
      snapshotSaved: false,
      lastPoint: null,
      touchedCells: new Set<string>(),
      workingData: mappedPixelData ? mappedPixelData.map(row => row.map(cell => ({ ...cell }))) : null,
    };

    return paintStrokeRef.current;
  };

  const filterStrokeCells = (cells: GridPoint[]) => {
    const stroke = paintStrokeRef.current;
    return dedupeCells(cells).filter(cell => {
      const key = `${cell.row},${cell.col}`;
      if (stroke.touchedCells.has(key)) return false;
      stroke.touchedCells.add(key);
      return true;
    });
  };

  const expandMirroredCells = (cells: GridPoint[], mirrorX: boolean, mirrorY: boolean): GridPoint[] => {
    if (!gridDimensions || (!mirrorX && !mirrorY)) return cells;

    const { N, M } = gridDimensions;
    const mirrored: GridPoint[] = [];
    cells.forEach(cell => {
      mirrored.push(cell);
      if (mirrorX) mirrored.push({ row: cell.row, col: N - 1 - cell.col });
      if (mirrorY) mirrored.push({ row: M - 1 - cell.row, col: cell.col });
      if (mirrorX && mirrorY) mirrored.push({ row: M - 1 - cell.row, col: N - 1 - cell.col });
    });

    return dedupeCells(mirrored);
  };

  const getLineCells = (start: GridPoint, end: GridPoint, size: number): GridPoint[] => {
    const cells: GridPoint[] = [];
    let x0 = start.col;
    let y0 = start.row;
    const x1 = end.col;
    const y1 = end.row;
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;

    while (true) {
      cells.push(...getBrushCells(y0, x0, size));
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }

    return cells;
  };

  const applyPaintStrokeAtPoint = (
    point: GridPoint,
    colorData: { key: string; color: string },
    size: number,
    mirrorX: boolean,
    mirrorY: boolean,
  ) => {
    if (!mappedPixelData || !gridDimensions) return false;

    const stroke = ensurePaintStroke();
    const sourceData = stroke.workingData || mappedPixelData;
    const baseCells = stroke.lastPoint
      ? getLineCells(stroke.lastPoint, point, size)
      : getBrushCells(point.row, point.col, size);
    const cells = filterStrokeCells(expandMirroredCells(baseCells, mirrorX, mirrorY));

    stroke.lastPoint = point;
    if (cells.length === 0) return false;

    const changed = applyCells(cells, colorData, sourceData, gridDimensions, {
      saveSnapshot: !stroke.snapshotSaved,
      snapshotData: mappedPixelData,
      onApplied: pixelData => {
        stroke.workingData = pixelData;
      },
    });

    if (changed) {
      stroke.snapshotSaved = true;
    }

    return changed;
  };

  const getRectangleCells = (start: GridPoint, end: GridPoint, size: number, filled: boolean): GridPoint[] => {
    const cells: GridPoint[] = [];
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const isEdge = row === minRow || row === maxRow || col === minCol || col === maxCol;
        if (filled || isEdge) {
          cells.push(...getBrushCells(row, col, size));
        }
      }
    }

    return cells;
  };

  const floodFillPaint = (startRow: number, startCol: number, targetColor: { key: string; color: string }) => {
    if (!mappedPixelData || !gridDimensions) return;

    const { N, M } = gridDimensions;
    const targetCell = mappedPixelData[startRow]?.[startCol];
    if (!targetCell) return;

    const nextCell = buildPaintCell(targetColor);
    if (
      targetCell.key === nextCell.key &&
      targetCell.color.toUpperCase() === nextCell.color.toUpperCase() &&
      Boolean(targetCell.isExternal) === Boolean(nextCell.isExternal)
    ) {
      return;
    }

    const targetHex = targetCell.color.toUpperCase();
    const targetKey = targetCell.key;
    const targetExternal = Boolean(targetCell.isExternal);
    const newPixelData = mappedPixelData.map(row => row.map(cell => ({ ...cell })));
    const visited = Array(M).fill(null).map(() => Array(N).fill(false));
    const stack: GridPoint[] = [{ row: startRow, col: startCol }];
    let changed = false;

    while (stack.length > 0) {
      const { row, col } = stack.pop()!;
      if (row < 0 || row >= M || col < 0 || col >= N || visited[row][col]) continue;
      const currentCell = newPixelData[row][col];
      if (!currentCell) continue;

      const matchesTarget =
        currentCell.key === targetKey &&
        currentCell.color.toUpperCase() === targetHex &&
        Boolean(currentCell.isExternal) === targetExternal;

      if (!matchesTarget) continue;
      visited[row][col] = true;
      newPixelData[row][col] = { ...nextCell };
      changed = true;

      stack.push(
        { row: row - 1, col },
        { row: row + 1, col },
        { row, col: col - 1 },
        { row, col: col + 1 },
      );
    }

    if (changed) {
      commitPixelDataChange(newPixelData);
    }
  };

  // ++ Re-introduce the combined interaction handler ++
  const handleCanvasInteraction = (
    clientX: number, 
    clientY: number, 
    pageX: number, 
    pageY: number, 
    isClick: boolean = false,
    isTouchEnd: boolean = false,
    phase?: CanvasInteractionPhase
  ) => {
    if (phase === 'end') {
      resetPaintStroke();
      setTooltipData(null);
      return;
    }

    // 如果是触摸结束或鼠标离开事件，隐藏提示
    if (isTouchEnd) {
      setTooltipData(null);
      return;
    }

    const canvas = pixelatedCanvasRef.current;
    if (!canvas || !mappedPixelData || !gridDimensions) {
      setTooltipData(null);
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (clientX - rect.left) * scaleX;
    const canvasY = (clientY - rect.top) * scaleY;

    const { N, M } = gridDimensions;
    const cellWidthOutput = canvas.width / N;
    const cellHeightOutput = canvas.height / M;

    const i = Math.floor(canvasX / cellWidthOutput);
    const j = Math.floor(canvasY / cellHeightOutput);

    if (i >= 0 && i < N && j >= 0 && j < M) {
      const cellData = mappedPixelData[j][i];

      if (isClick && isManualColoringMode) {
        const selectedPaintColor = selectedColor || currentGridColors[0] || fullPaletteColors[0] || null;

        if (activeEditorTool === 'pan') {
          setTooltipData(null);
          return;
        }

        if (activeEditorTool === 'eyedropper') {
          if (cellData && !cellData.isExternal && cellData.key && cellData.key !== TRANSPARENT_KEY) {
            handleColorSelect({ key: getColorKeyByHex(cellData.color, selectedColorSystem), color: cellData.color });
            setActiveEditorTool('brush');
            setTooltipData(null);
            showToast('已取色');
          }
          return;
        }

        if (colorReplaceState.isActive && colorReplaceState.step === 'select-source') {
          if (cellData && !cellData.isExternal && cellData.key && cellData.key !== TRANSPARENT_KEY) {
            handleCanvasColorSelect({
              key: cellData.key,
              color: cellData.color
            });
            setTooltipData(null);
          }
          return;
        }

        if (activeEditorTool === 'eraser') {
          if (isEraseMode && cellData && !cellData.isExternal && cellData.key && cellData.key !== TRANSPARENT_KEY) {
            floodFillErase(j, i, cellData.key);
            setIsEraseMode(false);
          } else {
            if (phase === 'start' || phase === 'move') {
              applyPaintStrokeAtPoint({ row: j, col: i }, transparentColorData, eraserSize, false, false);
            } else {
              applyCells(getBrushCells(j, i, eraserSize), transparentColorData);
            }
          }
          setTooltipData(null);
          return;
        }

        if (activeEditorTool === 'fill') {
          if (selectedPaintColor) {
            floodFillPaint(j, i, selectedPaintColor);
          }
          setTooltipData(null);
          return;
        }

        if (activeEditorTool === 'line') {
          if (!selectedPaintColor) return;
          if (!pendingLineStart) {
            setPendingLineStart({ row: j, col: i });
            showToast('已选择直线起点');
          } else {
            applyCells(
              expandMirroredCells(getLineCells(pendingLineStart, { row: j, col: i }, lineSize), lineMirrorX, lineMirrorY),
              selectedPaintColor,
            );
            setPendingLineStart(null);
          }
          setTooltipData(null);
          return;
        }

        if (activeEditorTool === 'rectangle') {
          if (!selectedPaintColor) return;
          if (!pendingRectangleStart) {
            setPendingRectangleStart({ row: j, col: i });
            showToast('已选择矩形起点');
          } else {
            applyCells(
              expandMirroredCells(
                getRectangleCells(pendingRectangleStart, { row: j, col: i }, rectangleSize, rectangleFilled),
                rectangleMirrorX,
                rectangleMirrorY,
              ),
              selectedPaintColor,
            );
            setPendingRectangleStart(null);
          }
          setTooltipData(null);
          return;
        }

        if (activeEditorTool === 'selection') {
          if (!selectionArea) {
            setSelectionArea({ startRow: j, startCol: i, endRow: j, endCol: i });
            showToast('已选择选区起点');
          } else {
            setSelectionArea(prev => prev ? { ...prev, endRow: j, endCol: i } : prev);
          }
          setTooltipData(null);
          return;
        }

        if ((activeEditorTool === 'brush' || activeEditorTool === 'palette') && selectedPaintColor) {
          if (phase === 'start' || phase === 'move') {
            applyPaintStrokeAtPoint({ row: j, col: i }, selectedPaintColor, brushSize, brushMirrorX, brushMirrorY);
          } else {
            applyCells(
              expandMirroredCells(getBrushCells(j, i, brushSize), brushMirrorX, brushMirrorY),
              selectedPaintColor,
            );
          }
          setTooltipData(null);
          return;
        }

        setTooltipData(null);
        return;
      }

      // 颜色替换模式逻辑 - 选择源颜色
      if (isClick && colorReplaceState.isActive && colorReplaceState.step === 'select-source') {
        if (cellData && !cellData.isExternal && cellData.key && cellData.key !== TRANSPARENT_KEY) {
          // 执行选择源颜色
          handleCanvasColorSelect({
            key: cellData.key,
            color: cellData.color
          });
          setTooltipData(null);
        }
        return;
      }

      // 一键擦除模式逻辑
      if (isClick && isEraseMode) {
        if (cellData && !cellData.isExternal && cellData.key && cellData.key !== TRANSPARENT_KEY) {
          // 执行洪水填充擦除
          floodFillErase(j, i, cellData.key);
          setIsEraseMode(false); // 擦除完成后退出擦除模式
          setTooltipData(null);
        }
        return;
      }

      // Manual Coloring Logic - 保持原有的上色逻辑
      if (isClick && isManualColoringMode && selectedColor) {
        // 手动上色模式逻辑保持不变
        // ...现有代码...
        const newPixelData = mappedPixelData.map(row => row.map(cell => ({ ...cell })));
        const currentCell = newPixelData[j]?.[i];

        if (!currentCell) return;

        const previousKey = currentCell.key;
        const wasExternal = currentCell.isExternal;
        
        let newCellData: MappedPixel;
        
        if (selectedColor.key === TRANSPARENT_KEY) {
          newCellData = { ...transparentColorData };
        } else {
          newCellData = { ...selectedColor, isExternal: false };
        }

        // Only update if state changes
        if (newCellData.key !== previousKey || newCellData.isExternal !== wasExternal) {
          saveEditSnapshot();
          newPixelData[j][i] = newCellData;
          setMappedPixelData(newPixelData);

          // Update color counts
          if (colorCounts) {
            const newColorCounts = { ...colorCounts };
            let newTotalCount = totalBeadCount;

            // 处理之前颜色的减少（使用hex值）
            if (!wasExternal && previousKey !== TRANSPARENT_KEY) {
              const previousCell = mappedPixelData[j][i];
              const previousHex = previousCell?.color?.toUpperCase();
              if (previousHex && newColorCounts[previousHex]) {
                newColorCounts[previousHex].count--;
                if (newColorCounts[previousHex].count <= 0) {
                  delete newColorCounts[previousHex];
              }
              newTotalCount--;
              }
            }

            // 处理新颜色的增加（使用hex值）
            if (!newCellData.isExternal && newCellData.key !== TRANSPARENT_KEY) {
              const newHex = newCellData.color.toUpperCase();
              if (!newColorCounts[newHex]) {
                newColorCounts[newHex] = {
                  count: 0,
                  color: newHex
                };
              }
              newColorCounts[newHex].count++;
              newTotalCount++;
            }

            setColorCounts(newColorCounts);
            setTotalBeadCount(newTotalCount);
          }
        }
        
        // 上色操作后隐藏提示
        setTooltipData(null);
      }
      // Tooltip Logic (非手动上色模式点击或悬停)
      else if (!isManualColoringMode) {
        // 只有单元格实际有内容（非背景/外部区域）才会显示提示
        if (cellData && !cellData.isExternal && cellData.key) {
          // 检查是否已经显示了提示框，并且是否点击的是同一个位置
          // 对于移动设备，位置可能有细微偏差，所以我们检查单元格索引而不是具体坐标
          if (tooltipData) {
            // 如果已经有提示框，计算当前提示框对应的格子的索引
            const tooltipRect = canvas.getBoundingClientRect();
            
            // 还原提示框位置为相对于canvas的坐标
            const prevX = tooltipData.x; // 页面X坐标
            const prevY = tooltipData.y; // 页面Y坐标
            
            // 转换为相对于canvas的坐标
            const prevCanvasX = (prevX - tooltipRect.left) * scaleX;
            const prevCanvasY = (prevY - tooltipRect.top) * scaleY;
            
            // 计算之前显示提示框位置对应的网格索引
            const prevCellI = Math.floor(prevCanvasX / cellWidthOutput);
            const prevCellJ = Math.floor(prevCanvasY / cellHeightOutput);
            
            // 如果点击的是同一个格子，则切换tooltip的显示/隐藏状态
            if (i === prevCellI && j === prevCellJ) {
              setTooltipData(null); // 隐藏提示
              return;
            }
          }
          
          // 计算相对于main元素的位置
          const mainElement = mainRef.current;
          if (mainElement) {
            const mainRect = mainElement.getBoundingClientRect();
            // 计算相对于main元素的坐标
            const relativeX = pageX - mainRect.left - window.scrollX;
            const relativeY = pageY - mainRect.top - window.scrollY;
            
            // 如果是移动/悬停到一个新的有效格子，或者点击了不同的格子，则显示提示
            setTooltipData({
              x: relativeX,
              y: relativeY,
              key: cellData.key,
              color: cellData.color,
            });
          } else {
            // 如果没有找到main元素，使用原始坐标
            setTooltipData({
              x: pageX,
              y: pageY,
              key: cellData.key,
              color: cellData.color,
            });
          }
        } else {
          // 如果点击/悬停在外部区域或背景上，隐藏提示
          setTooltipData(null);
        }
      }
    } else {
      // 如果点击/悬停在画布外部，隐藏提示
      setTooltipData(null);
    }
  };

  // 处理自定义色板中单个颜色的选择变化
  const handleSelectionChange = (hexValue: string, isSelected: boolean) => {
    const normalizedHex = hexValue.toUpperCase();
    setCustomPaletteSelections(prev => ({
      ...prev,
      [normalizedHex]: isSelected
    }));
    setIsCustomPalette(true);
  };

  // 保存自定义色板并应用
  const handleSaveCustomPalette = () => {
    savePaletteSelections(customPaletteSelections);
    setIsCustomPalette(true);
    setIsCustomPaletteEditorOpen(false);
    // 触发图像重新处理
    setRemapTrigger(prev => prev + 1);
    // 退出手动上色模式
    setIsManualColoringMode(false);
    setSelectedColor(null);
    setIsEraseMode(false);
  };

  // ++ 新增：导出自定义色板配置 ++
  const handleExportCustomPalette = () => {
    const selectedHexValues = Object.entries(customPaletteSelections)
      .filter(([, isSelected]) => isSelected)
      .map(([hexValue]) => hexValue);

    if (selectedHexValues.length === 0) {
      alert("当前没有选中的颜色，无法导出。");
      return;
    }

    // 导出格式：仅基于hex值
    const exportData = {
      version: "3.0", // 新版本号
      selectedHexValues: selectedHexValues,
      exportDate: new Date().toISOString(),
      totalColors: selectedHexValues.length
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'custom-perler-palette.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ++ 新增：处理导入的色板文件 ++
  const handleImportPaletteFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        // 检查文件格式
        if (!Array.isArray(data.selectedHexValues)) {
          throw new Error("无效的文件格式：文件必须包含 'selectedHexValues' 数组。");
        }

        console.log("检测到基于hex值的色板文件");

        const importedHexValues = data.selectedHexValues as string[];
        const validHexValues: string[] = [];
        const invalidHexValues: string[] = [];

        // 验证hex值
        importedHexValues.forEach(hex => {
          const normalizedHex = hex.toUpperCase();
          const colorData = fullBeadPalette.find(color => color.hex.toUpperCase() === normalizedHex);
          if (colorData) {
            validHexValues.push(normalizedHex);
          } else {
            invalidHexValues.push(hex);
          }
        });

        if (invalidHexValues.length > 0) {
          console.warn("导入时发现无效的hex值:", invalidHexValues);
          alert(`导入完成，但以下颜色无效已被忽略：\n${invalidHexValues.join(', ')}`);
        }

        if (validHexValues.length === 0) {
          alert("导入的文件中不包含任何有效的颜色。");
          return;
        }

        console.log(`成功验证 ${validHexValues.length} 个有效的hex值`);

        // 基于有效的hex值创建新的selections对象
        const allHexValues = fullBeadPalette.map(color => color.hex.toUpperCase());
        const newSelections = presetToSelections(allHexValues, validHexValues);
        setCustomPaletteSelections(newSelections);
        setIsCustomPalette(true); // 标记为自定义
        alert(`成功导入 ${validHexValues.length} 个颜色！`);

      } catch (error) {
        console.error("导入色板配置失败:", error);
        alert(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`);
      } finally {
        // 重置文件输入，以便可以再次导入相同的文件
        if (event.target) {
          event.target.value = '';
        }
      }
    };
    reader.onerror = () => {
      alert("读取文件失败。");
       // 重置文件输入
      if (event.target) {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  // ++ 新增：触发导入文件选择 ++
  const triggerImportPalette = () => {
    importPaletteInputRef.current?.click();
  };

  // 新增：处理颜色高亮
  const handleHighlightColor = (colorHex: string) => {
    setHighlightColorKey(prev => (
      prev && prev.toUpperCase() === colorHex.toUpperCase() ? null : colorHex
    ));
  };

  // 新增：切换完整色板显示
  const handleToggleFullPalette = () => {
    setShowFullPalette(!showFullPalette);
  };

  // 新增：处理颜色选择，同时管理模式切换
  const handleColorSelect = (colorData: { key: string; color: string; isExternal?: boolean } | null) => {
    if (!colorData) {
      setSelectedColor(null);
      return;
    }

    if (colorReplaceState.isActive && colorReplaceState.step === 'select-target' && colorReplaceState.sourceColor) {
      if (colorData.key !== TRANSPARENT_KEY) {
        handleColorReplace(colorReplaceState.sourceColor, colorData);
      }
      return;
    }

    // 如果选择的是橡皮擦（透明色）且当前在颜色替换模式，退出替换模式
    if (colorData.key === TRANSPARENT_KEY && colorReplaceState.isActive) {
      setColorReplaceState({
        isActive: false,
        step: 'select-source'
      });
      setHighlightColorKey(null);
    }
    
    // 选择任何颜色（包括橡皮擦）时，都应该退出一键擦除模式
    if (isEraseMode) {
      setIsEraseMode(false);
    }
    
    // 设置选中的颜色
    setSelectedColor(colorData);
    if (activeEditorTool === 'palette') {
      setActiveEditorTool('brush');
    }
  };

  // 新增：颜色替换相关处理函数
  const handleColorReplaceToggle = () => {
    setColorReplaceState(prev => {
      if (prev.isActive) {
        // 退出替换模式
        return {
          isActive: false,
          step: 'select-source'
        };
      } else {
        // 进入替换模式
        // 只退出冲突的模式，但保持在手动上色模式下
        setIsEraseMode(false);
        setSelectedColor(null);
        setActiveEditorTool('fill');
        resetPendingEditorGestures();
        return {
          isActive: true,
          step: 'select-source'
        };
      }
    });
  };

  // 新增：处理从画布选择源颜色
  const handleCanvasColorSelect = (colorData: { key: string; color: string }) => {
    if (colorReplaceState.isActive && colorReplaceState.step === 'select-source') {
      // 高亮显示选中的颜色
      setHighlightColorKey(colorData.color);
      // 进入第二步：选择目标颜色
      setColorReplaceState({
        isActive: true,
        step: 'select-target',
        sourceColor: colorData
      });
    }
  };

  // 新增：执行颜色替换
  const handleColorReplace = (sourceColor: { key: string; color: string }, targetColor: { key: string; color: string }) => {
    if (!mappedPixelData || !gridDimensions) return;

    const { N, M } = gridDimensions;
    const newPixelData = mappedPixelData.map(row => row.map(cell => ({ ...cell })));
    let replaceCount = 0;

    // 遍历所有像素，替换匹配的颜色
    for (let j = 0; j < M; j++) {
      for (let i = 0; i < N; i++) {
        const currentCell = newPixelData[j][i];
        if (currentCell && !currentCell.isExternal && 
            currentCell.color.toUpperCase() === sourceColor.color.toUpperCase()) {
          // 替换颜色
          newPixelData[j][i] = {
            key: targetColor.key,
            color: targetColor.color,
            isExternal: false
          };
          replaceCount++;
        }
      }
    }

    if (replaceCount > 0) {
      // 更新像素数据
      saveEditSnapshot();
      setMappedPixelData(newPixelData);

      // 重新计算颜色统计
      if (colorCounts) {
        const newColorCounts: { [hexKey: string]: { count: number; color: string } } = {};
        let newTotalCount = 0;

        newPixelData.flat().forEach(cell => {
          if (cell && !cell.isExternal && cell.key !== TRANSPARENT_KEY) {
            const cellHex = cell.color.toUpperCase();
            if (!newColorCounts[cellHex]) {
              newColorCounts[cellHex] = {
                count: 0,
                color: cellHex
              };
            }
            newColorCounts[cellHex].count++;
            newTotalCount++;
          }
        });

        setColorCounts(newColorCounts);
        setTotalBeadCount(newTotalCount);
      }

      console.log(`颜色替换完成：将 ${replaceCount} 个 ${sourceColor.key} 替换为 ${targetColor.key}`);
    }

    // 退出替换模式
    setColorReplaceState({
      isActive: false,
      step: 'select-source'
    });
    
    // 清除高亮
    setHighlightColorKey(null);
  };

  // 生成完整色板数据（用户自定义色板中选中的所有颜色）
  const fullPaletteColors = useMemo(() => {
    const selectedColors: { key: string; color: string }[] = [];
    
    Object.entries(customPaletteSelections).forEach(([hexValue, isSelected]) => {
      if (isSelected) {
        // 根据选择的色号系统获取显示的色号
        const displayKey = getColorKeyByHex(hexValue, selectedColorSystem);
        selectedColors.push({
          key: displayKey,
          color: hexValue
        });
      }
    });
    
    // 使用色相排序而不是色号排序
    return sortColorsByHue(selectedColors);
  }, [customPaletteSelections, selectedColorSystem]);

  const selectedColorCount = Object.values(customPaletteSelections).filter(Boolean).length || fullBeadPalette.length;
  const colorCountEntries = colorCounts
    ? Object.keys(colorCounts)
        .sort(sortColorKeys)
        .map(hexKey => ({
          hexKey,
          displayKey: getColorKeyByHex(hexKey, selectedColorSystem),
          count: colorCounts[hexKey].count,
          color: colorCounts[hexKey].color,
          isExcluded: excludedColorKeys.has(hexKey),
        }))
    : [];

  const availableFocusColors = useMemo<FocusColorInfo[]>(() => {
    if (!colorCounts) return [];

    return Object.keys(colorCounts)
      .sort(sortColorKeys)
      .map(hexKey => {
        const progress = focusState.colorProgress[hexKey] || { completed: 0, total: colorCounts[hexKey].count };
        return {
          color: hexKey,
          name: getColorKeyByHex(hexKey, selectedColorSystem),
          total: colorCounts[hexKey].count,
          completed: Math.min(progress.completed, colorCounts[hexKey].count),
        };
      });
  }, [colorCounts, focusState.colorProgress, selectedColorSystem]);

  const currentFocusColorInfo = availableFocusColors.find(color => color.color === focusState.currentColor);
  const focusProgressPercentage = currentFocusColorInfo && currentFocusColorInfo.total > 0
    ? Math.round((currentFocusColorInfo.completed / currentFocusColorInfo.total) * 100)
    : 0;

  useEffect(() => {
    if (!colorCounts || workspaceMode !== 'focus') return;

    setFocusState(prev => {
      const nextProgress = Object.entries(colorCounts).reduce<Record<string, { completed: number; total: number }>>((acc, [hex, data]) => {
        acc[hex] = prev.colorProgress[hex] || { completed: 0, total: data.count };
        acc[hex].total = data.count;
        acc[hex].completed = Math.min(acc[hex].completed, data.count);
        return acc;
      }, {});
      const nextColor = prev.currentColor && nextProgress[prev.currentColor] ? prev.currentColor : Object.keys(nextProgress)[0] || '';

      return {
        ...prev,
        currentColor: nextColor,
        colorProgress: nextProgress,
      };
    });
  }, [colorCounts, workspaceMode]);

  useEffect(() => {
    if (workspaceMode !== 'focus' || focusState.isPaused) return;

    const interval = window.setInterval(() => {
      setFocusState(prev => {
        if (prev.isPaused) return prev;
        const now = Date.now();
        const elapsed = Math.floor((now - prev.lastResumeTime) / 1000);
        if (elapsed <= 0) return prev;
        return {
          ...prev,
          totalElapsedTime: prev.totalElapsedTime + elapsed,
          lastResumeTime: now,
        };
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [workspaceMode, focusState.isPaused]);

  const calculateFocusRecommendation = useCallback(() => {
    if (!mappedPixelData || !focusState.currentColor) return { region: null, cell: null };

    const allRegions = getAllConnectedRegions(mappedPixelData, focusState.currentColor);
    const incompleteRegions = allRegions.filter(region => !isRegionCompleted(region, focusState.completedCells));
    if (incompleteRegions.length === 0) return { region: null, cell: null };

    let selectedRegion: GridPoint[];
    if (focusState.guidanceMode === 'largest') {
      selectedRegion = sortRegionsBySize([...incompleteRegions])[0] as GridPoint[];
    } else if (focusState.guidanceMode === 'edge-first') {
      const M = mappedPixelData.length;
      const N = mappedPixelData[0]?.length || 0;
      selectedRegion = (incompleteRegions.find(region =>
        region.some(cell => cell.row === 0 || cell.row === M - 1 || cell.col === 0 || cell.col === N - 1)
      ) || incompleteRegions[0]) as GridPoint[];
    } else {
      const referencePoint = focusState.selectedCell ?? {
        row: Math.floor(mappedPixelData.length / 2),
        col: Math.floor((mappedPixelData[0]?.length || 1) / 2),
      };
      selectedRegion = sortRegionsByDistance([...incompleteRegions], referencePoint)[0] as GridPoint[];
    }

    return {
      region: selectedRegion,
      cell: getRegionCenter(selectedRegion),
    };
  }, [mappedPixelData, focusState.currentColor, focusState.completedCells, focusState.guidanceMode, focusState.selectedCell]);

  useEffect(() => {
    if (workspaceMode !== 'focus') return;
    const { region, cell } = calculateFocusRecommendation();
    setFocusState(prev => ({
      ...prev,
      recommendedRegion: region,
      recommendedCell: cell,
    }));
  }, [workspaceMode, calculateFocusRecommendation]);

  const formatFocusTime = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return hours > 0
      ? `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      : `${minutes}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const handleFocusCellClick = useCallback((row: number, col: number) => {
    if (!mappedPixelData || !focusState.currentColor) return;
    const cell = mappedPixelData[row]?.[col];
    if (!cell || cell.isExternal || cell.color !== focusState.currentColor) return;

    const region = getConnectedRegion(mappedPixelData, row, col, focusState.currentColor);
    if (region.length === 0) return;

    const newCompletedCells = new Set(focusState.completedCells);
    const alreadyCompleted = isRegionCompleted(region, focusState.completedCells);
    region.forEach(point => {
      const key = `${point.row},${point.col}`;
      if (alreadyCompleted) {
        newCompletedCells.delete(key);
      } else {
        newCompletedCells.add(key);
      }
    });

    const newColorProgress = { ...focusState.colorProgress };
    const currentProgress = newColorProgress[focusState.currentColor] || {
      completed: 0,
      total: colorCounts?.[focusState.currentColor]?.count || region.length,
    };
    const oldCompleted = currentProgress.completed;
    const newCompleted = Array.from(newCompletedCells).filter(key => {
      const [r, c] = key.split(',').map(Number);
      return mappedPixelData[r]?.[c]?.color === focusState.currentColor;
    }).length;
    newColorProgress[focusState.currentColor] = {
      ...currentProgress,
      completed: newCompleted,
    };

    const colorJustCompleted = oldCompleted < currentProgress.total && newCompleted >= currentProgress.total;
    const allCompleted = Object.values(newColorProgress).every(progress => progress.completed >= progress.total);

    setFocusState(prev => {
      const now = Date.now();
      const elapsed = prev.isPaused ? 0 : Math.floor((now - prev.lastResumeTime) / 1000);
      return {
        ...prev,
        completedCells: newCompletedCells,
        selectedCell: { row, col },
        colorProgress: newColorProgress,
        showCelebration: colorJustCompleted && prev.enableCelebration,
        showCompletionCard: allCompleted,
        isPaused: allCompleted ? true : prev.isPaused,
        totalElapsedTime: prev.totalElapsedTime + elapsed,
        lastResumeTime: now,
      };
    });
  }, [mappedPixelData, focusState.currentColor, focusState.completedCells, focusState.colorProgress, colorCounts]);

  const handleFocusColorChange = useCallback((color: string) => {
    setFocusState(prev => ({ ...prev, currentColor: color, showColorPanel: false }));
  }, []);

  const handleFocusLocateRecommended = useCallback(() => {
    if (!focusState.recommendedCell || !gridDimensions) return;
    const cellSize = Math.max(15, Math.min(40, 300 / Math.max(gridDimensions.N, gridDimensions.M)));
    const targetX = (focusState.recommendedCell.col + 0.5) * cellSize;
    const targetY = (focusState.recommendedCell.row + 0.5) * cellSize;
    const canvasWidth = gridDimensions.N * cellSize;
    const canvasHeight = gridDimensions.M * cellSize;

    setFocusState(prev => ({
      ...prev,
      canvasOffset: {
        x: canvasWidth / 2 - targetX,
        y: canvasHeight / 2 - targetY,
      },
    }));
  }, [focusState.recommendedCell, gridDimensions]);

  const handleFocusPauseToggle = useCallback(() => {
    setFocusState(prev => {
      const now = Date.now();
      if (prev.isPaused) {
        return { ...prev, isPaused: false, lastResumeTime: now };
      }

      return {
        ...prev,
        isPaused: true,
        totalElapsedTime: prev.totalElapsedTime + Math.floor((now - prev.lastResumeTime) / 1000),
      };
    });
  }, []);

  const handleFocusCelebrationComplete = useCallback(() => {
    setFocusState(prev => {
      const allCompleted = Object.values(prev.colorProgress).every(progress => progress.completed >= progress.total);
      if (allCompleted) {
        return { ...prev, showCelebration: false, showCompletionCard: true };
      }

      const nextColor = availableFocusColors.find(color => color.completed < color.total && color.color !== prev.currentColor);
      return {
        ...prev,
        showCelebration: false,
        currentColor: nextColor?.color || prev.currentColor,
      };
    });
  }, [availableFocusColors]);

  const handleFocusExportProgress = useCallback(() => {
    if (!mappedPixelData || !gridDimensions) return;

    const payload = {
      app: APP_NAME,
      exportedAt: new Date().toISOString(),
      gridDimensions,
      completedCells: Array.from(focusState.completedCells),
      colorProgress: focusState.colorProgress,
      totalElapsedTime: focusState.totalElapsedTime,
      guidanceMode: focusState.guidanceMode,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `beadforge-focus-progress-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [focusState.completedCells, focusState.colorProgress, focusState.guidanceMode, focusState.totalElapsedTime, gridDimensions, mappedPixelData]);

  const handleFocusResetProgress = useCallback(() => {
    const resetProgress = availableFocusColors.reduce<Record<string, { completed: number; total: number }>>((acc, color) => {
      acc[color.color] = { completed: 0, total: color.total };
      return acc;
    }, {});
    setFocusState(prev => ({
      ...prev,
      completedCells: new Set<string>(),
      colorProgress: resetProgress,
      selectedCell: null,
      showCelebration: false,
      showCompletionCard: false,
      totalElapsedTime: 0,
      lastResumeTime: Date.now(),
      isPaused: false,
    }));
  }, [availableFocusColors]);

  const previewBackground = (() => {
    switch (previewSettings.background) {
      case 'white':
        return 'oklch(0.99 0.004 105)';
      case 'cream':
        return 'oklch(0.96 0.022 88)';
      case 'beige':
        return 'oklch(0.9 0.034 74)';
      case 'dark':
        return 'oklch(0.24 0.012 110)';
      case 'black':
        return 'oklch(0.14 0.006 110)';
      case 'wood':
        return 'linear-gradient(135deg, oklch(0.76 0.06 68), oklch(0.58 0.075 54))';
      case 'custom':
        return previewSettings.customBackground;
      default:
        return 'oklch(0.96 0.022 88)';
    }
  })();
  const shadowRadians = (previewSettings.shadowAngle * Math.PI) / 180;
  const previewShadowX = Math.round(Math.cos(shadowRadians) * previewSettings.shadowDistance);
  const previewShadowY = Math.round(Math.sin(shadowRadians) * previewSettings.shadowDistance);
  const previewBoardStyle: React.CSSProperties = {
    background: previewBackground,
    boxShadow: previewSettings.shadowEnabled
      ? `${previewShadowX}px ${previewShadowY}px ${Math.max(18, previewSettings.shadowDistance * 3)}px rgba(0,0,0,0.22)`
      : undefined,
  };
  const previewPaperStyle: React.CSSProperties = {
    boxShadow: previewSettings.shadowEnabled
      ? `${Math.round(previewShadowX * 0.45)}px ${Math.round(previewShadowY * 0.45)}px ${Math.max(12, previewSettings.shadowDistance * 1.7)}px rgba(0,0,0,0.18)`
      : undefined,
    borderRadius: previewSettings.edgeEnabled
      ? `${Math.round(8 + previewSettings.edgeIntensity / 10)}px`
      : '8px',
  };
  const previewCanvasWrapStyle: React.CSSProperties = {
    filter: previewSettings.edgeEnabled
      ? `contrast(${1 + previewSettings.edgeIntensity / 260}) saturate(${1 + previewSettings.edgeIntensity / 420})`
      : undefined,
  };


  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: floatAnimation }} />
      <style dangerouslySetInnerHTML={{ __html: '@keyframes toastFadeInOut{0%{opacity:0;transform:translate(-50%,10px)}15%{opacity:1;transform:translate(-50%,0)}85%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,-10px)}}' }} />

      <div
        className={`workspace-app theme-${appearanceSettings.theme} h-[100dvh] flex flex-col overflow-hidden tech-grid-bg`}
        style={appearanceStyle}
      >
        <InstallPWA />
        <header className="sticky top-0 z-40 w-full border-b border-[rgba(var(--line-rgb),0.22)] bg-[rgba(var(--panel-rgb),0.74)]/90 backdrop-blur-xl">
          <div className="mx-auto flex h-14 w-full max-w-screen-2xl items-center gap-2 px-2 sm:gap-3 sm:px-4">
            <button
              type="button"
              onClick={() => handleWorkspaceModeChange('optimize')}
              className="workspace-brand-button glass-action flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center gap-2 rounded-xl px-2 text-left"
              title="回到优化模式"
            >
              <BeadLogo compact />
              <span className="hidden leading-none md:inline">
                <span className="block text-sm font-semibold text-[var(--text)]">{APP_NAME}</span>
                <span className="block text-[10px] text-[var(--muted)]">{APP_TAGLINE}</span>
              </span>
            </button>

            <div className="flex min-w-0 flex-1 justify-center">
              <div className="mode-switch relative inline-flex items-center gap-0.5 rounded-xl border border-[rgba(var(--line-rgb),0.24)] bg-white/42 p-0.5 shadow-inner backdrop-blur-xl">
                {[
                  { label: '优化', mode: 'optimize' as WorkspaceMode, enabled: Boolean(originalImageSrc) || !mappedPixelData },
                  { label: '编辑', mode: 'edit' as WorkspaceMode, enabled: Boolean(mappedPixelData) },
                  { label: '预览', mode: 'preview' as WorkspaceMode, enabled: Boolean(mappedPixelData) },
                  { label: '拼豆', mode: 'focus' as WorkspaceMode, enabled: Boolean(mappedPixelData) },
                ].map((item, index) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleWorkspaceModeChange(item.mode)}
                    disabled={!item.enabled}
                    className={`mode-tab relative z-10 min-w-[44px] rounded-lg px-2.5 py-2 text-[11px] font-medium transition sm:px-3 ${
                      workspaceMode === item.mode
                        ? 'glass-action-active text-[var(--text)]'
                        : 'text-[var(--muted)] hover:bg-white/55 hover:text-[var(--text)] disabled:opacity-35'
                    }`}
                    style={{ animationDelay: `${index * 32}ms` }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-shrink-0 items-center gap-1 sm:gap-1.5">
              <button
                type="button"
                onClick={handleUndoEdit}
                disabled={editHistory.length === 0}
                className="glass-action hidden min-h-[44px] min-w-[44px] place-items-center disabled:cursor-not-allowed disabled:opacity-35 md:grid"
                title="撤销上一步"
                aria-label="撤销上一步"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M9 15l-6-6 6-6" />
                  <path d="M3 9h11a6 6 0 016 6v3" />
                </svg>
              </button>

              <button
                type="button"
                onClick={handleRedoEdit}
                disabled={redoHistory.length === 0}
                className="glass-action hidden min-h-[44px] min-w-[44px] place-items-center disabled:cursor-not-allowed disabled:opacity-35 md:grid"
                title="恢复上一步"
                aria-label="恢复上一步"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M15 14l5-5-5-5" />
                  <path d="M20 9H9a6 6 0 00-6 6v3" />
                </svg>
              </button>

              <button
                type="button"
                onClick={openCustomPaletteEditor}
                className="glass-action palette-status-button hidden min-h-[44px] flex-col items-center justify-center px-3 text-center leading-tight md:flex"
                title={`色板设置 · ${selectedColorSystem} · ${selectedColorCount} 色`}
              >
                <span className="block w-full text-center text-[10px] text-[var(--muted)]">{selectedColorSystem}</span>
                <span className="block w-full text-center text-[12px] font-semibold text-[var(--text)]">{selectedColorCount}</span>
              </button>

              <div className="hidden items-center gap-1.5 md:flex">
                <button
                  type="button"
                  onClick={triggerMainImport}
                  className="glass-action min-h-[44px] px-3 text-xs font-medium"
                >
                  导入
                </button>
                <button
                  type="button"
                  onClick={openDownloadSettings}
                  disabled={!mappedPixelData || !gridDimensions || activeBeadPalette.length === 0}
                  className="glass-action min-h-[44px] px-3 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-45"
                >
                  下载
                </button>
                <button type="button" onClick={handleSaveDraft} className="glass-action min-h-[44px] px-3 text-xs font-medium">保存</button>
                <button
                  type="button"
                  onClick={toggleAppearancePanel}
                  className="glass-action grid min-h-[44px] min-w-[44px] place-items-center"
                  title="设置"
                  aria-label="打开设置"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 005 15.08a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.49A1.65 1.65 0 005 8.57a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009.32 5a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.49a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019 9.32a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.49A1.65 1.65 0 0019.4 15z" />
                  </svg>
                </button>
              </div>

              <button
                type="button"
                onClick={toggleAppearancePanel}
                className="glass-action grid min-h-[44px] min-w-[44px] place-items-center md:hidden"
                aria-label="打开设置"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 005 15.08a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.49A1.65 1.65 0 005 8.57a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009.32 5a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.49a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019 9.32a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.49A1.65 1.65 0 0019.4 15z" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        <div className="mobile-workspace-shell relative flex min-h-0 flex-1 lg:overflow-hidden">
          <div className={`mx-auto flex min-h-0 w-full max-w-screen-2xl flex-1 flex-col gap-3 px-2 py-2 sm:px-4 lg:flex-row lg:py-3 lg:pb-3 ${workspaceMode === 'focus' ? 'pb-2' : 'pb-20'}`}>
            <div className="mobile-canvas-column flex min-h-0 min-w-0 flex-1">
              <main ref={mainRef} className="relative flex min-h-0 min-w-0 flex-1 flex-col">
                <input
                  type="file"
                  accept=".json"
                  ref={importPaletteInputRef}
                  onChange={handleImportPaletteFile}
                  className="hidden"
                />
                <input
                  type="file"
                  accept={IMPORT_FILE_ACCEPT}
                  ref={mainImportInputRef}
                  onChange={handleFileChange}
                  className="fixed -left-[9999px] top-0 h-px w-px opacity-0"
                  tabIndex={-1}
                  aria-hidden="true"
                />
                <canvas ref={originalCanvasRef} className="hidden" />

                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragOver}
                  className="workspace-enter glass-panel relative flex min-h-0 flex-1 overflow-hidden rounded-2xl"
                >
                  {mappedPixelData && gridDimensions ? (
                    <div className="relative z-10 flex h-full w-full flex-col">
                      <div className="mobile-stage-topbar flex items-center justify-between gap-3 border-b border-[rgba(var(--line-rgb),0.16)] bg-white/32 px-3 py-2 text-xs text-[var(--muted)] backdrop-blur sm:px-4">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-[rgba(var(--accent-rgb),0.78)] shadow-[0_0_18px_rgba(var(--accent-rgb),0.42)]" />
                          <span className="truncate">{
                            workspaceMode === 'optimize'
                              ? '优化模式'
                              : workspaceMode === 'edit'
                                ? '编辑模式'
                                : workspaceMode === 'focus'
                                  ? '拼豆模式'
                                  : '预览模式'
                          } · {gridDimensions.N} x {gridDimensions.M}</span>
                        </div>
                        <div className="hidden items-center gap-3 sm:flex">
                          <span>{colorCountEntries.length} 色</span>
                          <span>{totalBeadCount} 颗</span>
                          <span>{selectedColorSystem}</span>
                        </div>
                      </div>

                      {workspaceMode === 'focus' ? (
                        <div className="focus-stage flex min-h-0 flex-1 flex-col">
                          <ColorStatusBar
                            currentColor={focusState.currentColor}
                            colorInfo={currentFocusColorInfo}
                            progressPercentage={focusProgressPercentage}
                            elapsedTime={formatFocusTime(focusState.totalElapsedTime)}
                            isPaused={focusState.isPaused}
                            onPauseToggle={handleFocusPauseToggle}
                          />
                          <div className="focus-canvas-pad min-h-0 flex-1 p-3">
                            <FocusCanvas
                              mappedPixelData={mappedPixelData}
                              gridDimensions={gridDimensions}
                              currentColor={focusState.currentColor}
                              completedCells={focusState.completedCells}
                              recommendedCell={focusState.recommendedCell}
                              recommendedRegion={focusState.recommendedRegion}
                              canvasScale={focusState.canvasScale}
                              canvasOffset={focusState.canvasOffset}
                              gridSectionInterval={focusState.gridSectionInterval}
                              showSectionLines={focusState.showSectionLines}
                              sectionLineColor={focusState.sectionLineColor}
                              onCellClick={handleFocusCellClick}
                              onScaleChange={scale => setFocusState(prev => ({ ...prev, canvasScale: scale }))}
                              onOffsetChange={offset => setFocusState(prev => ({ ...prev, canvasOffset: offset }))}
                            />
                          </div>
                          <ProgressBar
                            progressPercentage={focusProgressPercentage}
                            recommendedCell={focusState.recommendedCell}
                            colorInfo={currentFocusColorInfo}
                          />
                          <div className="focus-bottom-palette border-t border-[rgba(var(--line-rgb),0.14)] bg-[rgba(var(--panel-rgb),0.68)] px-3 py-2 backdrop-blur-xl">
                            <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                              {availableFocusColors.map((color, index) => {
                                const pct = color.total > 0 ? Math.round((color.completed / color.total) * 100) : 0;
                                const isActive = color.color === focusState.currentColor;
                                const isDone = pct >= 100;
                                return (
                                  <button
                                    key={color.color}
                                    type="button"
                                    onClick={() => handleFocusColorChange(color.color)}
                                    className={`focus-color-chip min-w-[78px] rounded-xl border px-2 py-2 text-left transition ${isActive ? 'focus-color-chip-active border-[rgba(var(--accent-rgb),0.58)] bg-[rgba(var(--accent-rgb),0.14)]' : 'border-[rgba(var(--line-rgb),0.14)] bg-white/50 hover:bg-white/72'} ${isDone ? 'opacity-70' : ''}`}
                                    style={{ animationDelay: `${Math.min(index * 14, 240)}ms` }}
                                    title={`${color.name} ${color.completed}/${color.total}`}
                                  >
                                    <span className="mx-auto mb-1 block h-7 w-7 rounded-full border border-black/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]" style={{ backgroundColor: color.color }} />
                                    <span className="block truncate text-center text-[11px] font-bold text-[var(--text)]">{color.name}</span>
                                    <span className="block text-center text-[10px] tabular-nums text-[var(--muted)]">{pct}%</span>
                                  </button>
                                );
                              })}
                            </div>
                            <ToolBar
                              onColorSelect={openFocusColorPanel}
                              onLocate={handleFocusLocateRecommended}
                              onPause={handleFocusPauseToggle}
                              isPaused={focusState.isPaused}
                              elapsedTime={formatFocusTime(focusState.totalElapsedTime)}
                            />
                            <button
                              type="button"
                              onClick={() => setIsMobilePanelOpen(prev => !prev)}
                              className={`glass-action mt-2 min-h-[42px] w-full px-3 text-xs font-medium md:hidden ${isMobilePanelOpen ? 'glass-action-active' : ''}`}
                              aria-expanded={isMobilePanelOpen}
                            >
                              {isMobilePanelOpen ? '收起拼豆设置' : '拼豆设置'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="relative flex min-h-0 flex-1 flex-col">
                          <div className={`mobile-stage-scroll relative flex min-h-0 flex-1 items-start justify-start overflow-auto p-3 sm:p-5 ${workspaceMode === 'preview' ? 'preview-stage' : 'editor-stage'} ${workspaceMode === 'edit' && isMobileEditorRailOpen ? 'mobile-stage-scroll-with-editor-rail' : ''}`}>
                            <div
                              className={`preview-board relative m-auto overflow-hidden border border-[rgba(var(--line-rgb),0.2)] shadow-[0_20px_60px_rgba(var(--shadow-rgb),0.12)] ${
                                workspaceMode === 'preview'
                                  ? `preview-board-pretty preview-material-${previewSettings.material} rounded-[22px] px-5 pb-4 pt-5 sm:px-7 sm:pb-5 sm:pt-7`
                                  : 'rounded-xl p-2'
                              }`}
                              style={workspaceMode === 'preview' ? previewBoardStyle : { background: 'rgba(255,255,255,0.7)' }}
                            >
                              <div className="relative z-10 flex flex-col items-center">
                                <div
                                  className={`preview-art-surface relative z-10 overflow-hidden border border-[rgba(var(--line-rgb),0.22)] bg-white ${
                                    workspaceMode === 'preview' ? 'p-0' : ''
                                  }`}
                                  style={workspaceMode === 'preview' ? { ...previewCanvasWrapStyle, ...previewPaperStyle } : undefined}
                                >
                                  <PixelatedPreviewCanvas
                                    canvasRef={pixelatedCanvasRef}
                                    mappedPixelData={mappedPixelData}
                                    gridDimensions={gridDimensions}
                                    isManualColoringMode={isManualColoringMode}
                                    onInteraction={handleCanvasInteraction}
                                    highlightColorKey={highlightColorKey}
                                    panMode={isManualColoringMode && activeEditorTool === 'pan'}
                                    dragPaintMode={isManualColoringMode && (activeEditorTool === 'brush' || activeEditorTool === 'eraser')}
                                    displayScale={workspaceMode === 'preview' || workspaceMode === 'optimize' ? workspaceCanvasScale : 1}
                                  />
                                  {stickers.map(sticker => {
                                    const layer = editorLayers.find(item => item.id === sticker.layerId);
                                    if (!layer?.visible) return null;
                                    return (
                                      <button
                                        key={sticker.id}
                                        type="button"
                                        onPointerDown={event => handleStickerPointerDown(event, sticker.id)}
                                        onPointerMove={event => handleStickerPointerMove(event, sticker.id)}
                                        onPointerUp={handleStickerPointerEnd}
                                        onPointerCancel={handleStickerPointerEnd}
                                        className={`absolute z-20 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl border border-transparent p-1 transition ${
                                          layer.id === activeLayerId
                                            ? 'border-[rgba(var(--accent-rgb),0.5)] bg-white/28 shadow-[0_10px_24px_rgba(var(--shadow-rgb),0.14)]'
                                            : 'hover:border-[rgba(var(--line-rgb),0.22)] hover:bg-white/22'
                                        } ${layer.locked ? 'cursor-not-allowed opacity-80' : 'cursor-move'}`}
                                        style={{ left: `${sticker.x}%`, top: `${sticker.y}%`, touchAction: 'none' }}
                                        title={layer.locked ? '图层已锁定' : '拖动贴纸'}
                                      >
                                        <StickerMark sticker={sticker} viewScale={workspaceMode === 'preview' || workspaceMode === 'optimize' ? workspaceCanvasScale : 1} />
                                      </button>
                                    );
                                  })}
                                </div>
                                {workspaceMode === 'preview' && (
                                  <div className={`preview-signature-zone pointer-events-none relative z-10 mt-3 flex min-h-[28px] w-full items-center justify-center rounded-b-[16px] px-4 text-center text-[12px] font-semibold text-[var(--text)] ${previewSettings.brandText.trim() ? 'opacity-100' : 'opacity-0'}`}>
                                    <span className="preview-brand-strip max-w-full truncate">
                                      {previewSettings.brandText.trim() || ' '}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            {workspaceMode === 'edit' && showEditorMinimap && (
                              <EditorMinimap
                                mappedPixelData={mappedPixelData}
                                gridDimensions={gridDimensions}
                                targetCanvasRef={pixelatedCanvasRef}
                                onClose={() => setShowEditorMinimap(false)}
                              />
                            )}
                          </div>
                          {(workspaceMode === 'preview' || workspaceMode === 'optimize') && (
                            <CanvasScaleControl
                              scale={workspaceCanvasScale}
                              onChange={handleWorkspaceCanvasScaleChange}
                              variant={isPhoneViewport ? 'viewport' : 'stage'}
                            />
                          )}
                          {workspaceMode === 'edit' && isMobileEditorRailOpen && (
                            <div className="mobile-editor-popover absolute md:hidden">
                              <EditorToolRail
                                activeTool={activeEditorTool}
                                selectedColor={selectedColor}
                                fallbackColor={currentGridColors[0] || fullPaletteColors[0] || null}
                                selectedColorSystem={selectedColorSystem}
                                showMinimap={showEditorMinimap}
                                onToolChange={handleEditorToolChange}
                                onToggleMinimap={() => setShowEditorMinimap(prev => !prev)}
                                variant="drawer"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={triggerMainImport}
                      className="mobile-upload-card relative z-10 m-auto flex max-w-sm cursor-pointer flex-col items-center gap-4 overflow-hidden rounded-2xl border border-dashed border-[rgba(var(--line-rgb),0.32)] bg-white/52 px-8 py-10 text-center transition hover:border-[rgba(var(--accent-rgb),0.45)] hover:bg-white/70"
                    >
                      <BeadLogo />
                      <span className="text-lg font-semibold text-[var(--text)]">导入图片或 CSV</span>
                      <span className="mobile-upload-helper text-sm leading-6 text-[var(--muted)]">拖到这里也可以。生成后可编辑、去背景、保存草稿和导出采购清单。</span>
                      <span className="glass-action glass-action-primary px-5 py-2 text-sm font-medium">选择文件</span>
                    </button>
                  )}

                  {tooltipData && <GridTooltip tooltipData={tooltipData} selectedColorSystem={selectedColorSystem} />}

                  {isManualColoringMode && mappedPixelData && gridDimensions && (
                    <>
                      <EditorToolRail
                        activeTool={activeEditorTool}
                        selectedColor={selectedColor}
                        fallbackColor={currentGridColors[0] || fullPaletteColors[0] || null}
                        selectedColorSystem={selectedColorSystem}
                        showMinimap={showEditorMinimap}
                        onToolChange={handleEditorToolChange}
                        onToggleMinimap={() => setShowEditorMinimap(prev => !prev)}
                        className="hidden md:flex"
                      />
                    </>
                  )}
                </div>
              </main>
            </div>

            {mappedPixelData && gridDimensions && (
              <div
                className={`workspace-side-panel-shell flex min-h-0 w-full flex-shrink-0 flex-col lg:w-[320px] ${isMobilePanelOpen ? 'mobile-panel-open' : ''}`}
                data-mode={workspaceMode}
              >
                <button
                  type="button"
                  className="mobile-panel-handle"
                  onClick={() => setIsMobilePanelOpen(false)}
                  aria-label="收起面板"
                />
                {workspaceMode === 'edit' ? (
                  <EditorSidePanel
                    activeTool={activeEditorTool}
                    selectedColor={selectedColor}
                    selectedColorSystem={selectedColorSystem}
                    currentColors={currentGridColors}
                    fullPaletteColors={fullPaletteColors}
                    showFullPalette={showFullPalette}
                    onToggleFullPalette={handleToggleFullPalette}
                    onColorSelect={handleColorSelect}
                    onHighlightColor={handleHighlightColor}
                    brushSize={brushSize}
                    onBrushSizeChange={setBrushSize}
                    brushMirrorX={brushMirrorX}
                    onBrushMirrorXChange={setBrushMirrorX}
                    brushMirrorY={brushMirrorY}
                    onBrushMirrorYChange={setBrushMirrorY}
                    eraserSize={eraserSize}
                    onEraserSizeChange={setEraserSize}
                    lineSize={lineSize}
                    onLineSizeChange={setLineSize}
                    lineMirrorX={lineMirrorX}
                    onLineMirrorXChange={setLineMirrorX}
                    lineMirrorY={lineMirrorY}
                    onLineMirrorYChange={setLineMirrorY}
                    rectangleSize={rectangleSize}
                    onRectangleSizeChange={setRectangleSize}
                    rectangleFilled={rectangleFilled}
                    onRectangleFilledChange={setRectangleFilled}
                    rectangleMirrorX={rectangleMirrorX}
                    onRectangleMirrorXChange={setRectangleMirrorX}
                    rectangleMirrorY={rectangleMirrorY}
                    onRectangleMirrorYChange={setRectangleMirrorY}
                    colorReplaceState={colorReplaceState}
                    onColorReplaceToggle={handleColorReplaceToggle}
                    onRegionErase={handleRegionEraseRequest}
                    selectionArea={selectionArea}
                    pendingLineStart={pendingLineStart}
                    pendingRectangleStart={pendingRectangleStart}
                    onCancelPendingShape={resetPendingEditorGestures}
                    layers={editorLayers}
                    activeLayerId={activeLayerId}
                    onAddSticker={handleAddStickerRequest}
                    onAddLayer={handleAddEditorLayer}
                    onLayerSelect={handleLayerSelect}
                    onToggleLayerVisible={handleToggleLayerVisible}
                    onToggleLayerLock={handleToggleLayerLock}
                    onDuplicateLayer={handleDuplicateLayer}
                    onMoveLayer={handleMoveLayer}
                    onDeleteLayer={handleDeleteLayer}
                  />
                ) : workspaceMode === 'preview' ? (
                  <PreviewSidePanel
                    settings={previewSettings}
                    onSettingsChange={setPreviewSettings}
                    onDownload={openDownloadSettings}
                  />
                ) : workspaceMode === 'focus' ? (
                  <FocusSidePanel
                    focusState={focusState}
                    onFocusStateChange={setFocusState}
                    onExportProgress={handleFocusExportProgress}
                    onResetProgress={handleFocusResetProgress}
                  />
                ) : (
                  <aside className="editor-side-panel flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[rgba(var(--line-rgb),0.18)] bg-[rgba(var(--panel-rgb),0.84)] p-3 text-[var(--text)] shadow-[-18px_0_48px_rgba(var(--shadow-rgb),0.12)] backdrop-blur-2xl">
                    <section className="settings-panel-card">
                      <div className="mb-3 text-sm font-bold">优化</div>
                      <div className="space-y-3 text-xs text-[var(--muted)]">
                        <label className="grid gap-1">
                          横轴格数
                          <input id="granularityInput" type="number" value={granularityInput} onChange={handleGranularityInputChange} min="10" max="300" className="rounded-lg border border-[rgba(var(--line-rgb),0.22)] bg-white/68 px-2 py-2 text-xs text-[var(--text)] outline-none focus:border-[rgba(var(--accent-rgb),0.55)]" />
                        </label>
                        <label className="grid gap-1">
                          颜色合并阈值
                          <input id="similarityThresholdInput" type="number" value={similarityThresholdInput} onChange={handleSimilarityThresholdInputChange} min="0" max="100" className="rounded-lg border border-[rgba(var(--line-rgb),0.22)] bg-white/68 px-2 py-2 text-xs text-[var(--text)] outline-none focus:border-[rgba(var(--accent-rgb),0.55)]" />
                          <span className="text-[11px] leading-5 text-[var(--muted)]">{MERGE_THRESHOLD_HELP}</span>
                        </label>
                        <button type="button" onClick={handleConfirmParameters} className="glass-action glass-action-primary min-h-[40px] w-full px-3 font-medium">应用参数</button>
                        <button type="button" onClick={handleAutoRemoveBackground} className="glass-action min-h-[40px] w-full px-3 font-medium">一键去背景</button>
                      </div>
                    </section>
                  </aside>
                )}
              </div>
            )}

          </div>
        </div>

        <footer className="hidden w-full border-t border-[rgba(var(--line-rgb),0.18)] bg-[rgba(var(--panel-rgb),0.62)] backdrop-blur-xl md:block">
          <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between px-4 py-2.5 text-xs text-[var(--muted)]">
            <span>{APP_NAME} · {APP_TAGLINE} · 2026</span>
            <span className="hidden sm:inline">{gridDimensions ? `网格 ${gridDimensions.N} x ${gridDimensions.M}` : `${selectedColorSystem} ${selectedColorCount}`}</span>
          </div>
        </footer>

        <nav className={`mobile-command-bar fixed bottom-2 left-2 right-2 rounded-2xl border border-[rgba(var(--line-rgb),0.18)] bg-[rgba(var(--panel-rgb),0.82)] shadow-[0_18px_48px_rgba(var(--shadow-rgb),0.18)] backdrop-blur-2xl md:hidden ${workspaceMode === 'focus' ? 'hidden' : ''} ${isMobilePanelOpen || isMobileEditorRailOpen ? 'z-[80]' : 'z-50'}`} aria-label="手机快捷操作">
          <div className="mobile-command-bar-inner flex items-center">
            <div className="mobile-command-fixed flex items-center">
              {mappedPixelData && gridDimensions && (
                <button
                  type="button"
                  onClick={handleToggleMobilePanel}
                  className={`glass-action min-h-[42px] flex-[0_0_auto] px-4 text-xs font-medium ${isMobilePanelOpen ? 'glass-action-active' : ''}`}
                  aria-expanded={isMobilePanelOpen}
                >
                  {isMobilePanelOpen ? '收起' : '面板'}
                </button>
              )}
              {workspaceMode === 'edit' && mappedPixelData && gridDimensions && (
                <button
                  type="button"
                  onClick={handleToggleMobileEditorRail}
                  className={`glass-action min-h-[42px] flex-[0_0_auto] px-4 text-xs font-medium ${isMobileEditorRailOpen ? 'glass-action-active' : ''}`}
                  aria-expanded={isMobileEditorRailOpen}
                >
                  工具
                </button>
              )}
            </div>
            <div className="mobile-command-scroll overflow-x-auto">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={triggerMainImport}
                  className="glass-action min-h-[42px] flex-[0_0_auto] px-4 text-xs font-medium"
                >
                  导入
                </button>
                <button
                  type="button"
                  onClick={openCustomPaletteEditor}
                  className="glass-action min-h-[42px] flex-[0_0_auto] px-4 text-xs font-medium"
                >
                  色板
                </button>
                {mappedPixelData && gridDimensions && (
                  <button
                    type="button"
                    onClick={openDownloadSettings}
                    disabled={activeBeadPalette.length === 0}
                    className="glass-action min-h-[42px] flex-[0_0_auto] px-4 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    下载
                  </button>
                )}
                {workspaceMode === 'edit' && (
                  <>
                    <button
                      type="button"
                      onClick={handleUndoEdit}
                      disabled={editHistory.length === 0}
                      className="glass-action min-h-[42px] flex-[0_0_auto] px-4 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      撤销
                    </button>
                    <button
                      type="button"
                      onClick={handleRedoEdit}
                      disabled={redoHistory.length === 0}
                      className="glass-action min-h-[42px] flex-[0_0_auto] px-4 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      恢复
                    </button>
                  </>
                )}
                {mappedPixelData && gridDimensions && (
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    className="glass-action min-h-[42px] flex-[0_0_auto] px-4 text-xs font-medium"
                  >
                    保存
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleRestoreDraft}
                  className="glass-action min-h-[42px] flex-[0_0_auto] px-4 text-xs font-medium"
                >
                  草稿
                </button>
              </div>
            </div>
          </div>
        </nav>

        {isMobilePanelOpen && mappedPixelData && gridDimensions && (
          <button
            type="button"
            className="mobile-panel-scrim fixed inset-0 z-[60] bg-black/18 md:hidden"
            onClick={() => setIsMobilePanelOpen(false)}
            aria-label="关闭面板"
          />
        )}
      </div>

      {isAppearancePanelOpen && (
        <div
          className={`workspace-app theme-${appearanceSettings.theme} palette-backdrop fixed inset-0 z-[120] flex items-center justify-center bg-black/42 p-3 backdrop-blur-md sm:p-5`}
          style={appearanceStyle}
        >
          <div className="palette-modal w-full max-w-5xl">
            <div className="settings-shell flex max-h-[88vh] flex-col overflow-hidden rounded-[22px]">
              <div className="settings-head flex items-start justify-between gap-4 border-b border-[rgba(var(--line-rgb),0.18)] px-5 py-4 sm:px-6">
                <div>
                  <div className="text-base font-semibold text-[var(--text)]">设置</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{selectedTheme.name} · {selectedFont.name} · {appearanceSettings.scale}%</div>
                </div>
                <button type="button" onClick={() => setIsAppearancePanelOpen(false)} className="glass-action grid min-h-[40px] min-w-[40px] place-items-center" aria-label="关闭设置">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
                  <section className="settings-panel-card" style={{ animationDelay: '0ms' }}>
                    <div className="mb-3 flex w-full items-center justify-between text-left">
                      <span className="text-xs font-semibold uppercase text-[var(--muted)]">外观</span>
                      <span className="text-[11px] text-[var(--muted)]">默认黑白</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {appearanceThemes.map((theme, index) => (
                        <button
                          key={theme.key}
                          type="button"
                          onClick={() => handleAppearanceChange('theme', theme.key as AppearanceTheme)}
                          className={`rounded-xl border p-2 text-left transition ${appearanceSettings.theme === theme.key ? 'theme-swatch-active border-[rgba(var(--accent-rgb),0.52)] bg-white/72' : 'border-[rgba(var(--line-rgb),0.18)] bg-white/34 hover:bg-white/58'}`}
                          style={{ animationDelay: `${index * 24}ms` }}
                        >
                          <div className="mb-2 flex gap-1">
                            {theme.colors.map(color => <span key={color} className="h-4 flex-1 rounded-full border border-black/10" style={{ backgroundColor: color }} />)}
                          </div>
                          <div className="text-[11px] font-semibold text-[var(--text)]">{theme.name}</div>
                          <div className="mt-0.5 text-[10px] text-[var(--muted)]">{theme.note}</div>
                        </button>
                      ))}
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="space-y-1 text-[11px] text-[var(--muted)]">
                        字体
                        <select
                          value={appearanceSettings.font}
                          onChange={event => handleAppearanceChange('font', event.target.value as AppearanceFont)}
                          className="w-full rounded-lg border border-[rgba(var(--line-rgb),0.22)] bg-white/68 px-2 py-2 text-xs text-[var(--text)] outline-none focus:border-[rgba(var(--accent-rgb),0.55)]"
                        >
                          {appearanceFonts.map(font => <option key={font.key} value={font.key}>{font.name}</option>)}
                        </select>
                      </label>
                      <label className="space-y-1 text-[11px] text-[var(--muted)]">
                        缩放 {appearanceSettings.scale}%
                        <input
                          type="range"
                          min="85"
                          max="125"
                          value={appearanceSettings.scale}
                          onChange={event => handleAppearanceChange('scale', Number(event.target.value))}
                          className="control-range w-full"
                          style={{ '--range-progress': `${((appearanceSettings.scale - 85) / 40) * 100}%` } as React.CSSProperties}
                        />
                      </label>
                    </div>
                    <button type="button" onClick={handleResetAppearance} className="glass-action mt-4 min-h-[40px] w-full px-3 text-xs font-medium">恢复默认外观</button>
                  </section>

                  <section className="settings-panel-card" style={{ animationDelay: '40ms' }}>
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase text-[var(--muted)]">图纸</span>
                      <span className="text-[11px] text-[var(--muted)]">{hasWorkInProgress ? '已生成' : '空'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="settings-metric rounded-lg p-2"><div className="text-[10px] text-[var(--muted)]">尺寸</div><div className="mt-1 text-xs font-semibold text-[var(--text)]">{gridDimensions ? `${gridDimensions.N}x${gridDimensions.M}` : '-'}</div></div>
                      <div className="settings-metric rounded-lg p-2"><div className="text-[10px] text-[var(--muted)]">颜色</div><div className="mt-1 text-xs font-semibold text-[var(--text)]">{colorCountEntries.length || '-'}</div></div>
                      <div className="settings-metric rounded-lg p-2"><div className="text-[10px] text-[var(--muted)]">颗数</div><div className="mt-1 text-xs font-semibold text-[var(--text)]">{totalBeadCount || '-'}</div></div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button type="button" onClick={triggerMainImport} className="glass-action min-h-[40px] px-3 text-xs font-medium">导入图片</button>
                      <button type="button" onClick={handleSaveDraft} className="glass-action min-h-[40px] px-3 text-xs font-medium">保存草稿</button>
                      <button type="button" onClick={handleRestoreDraft} className="glass-action min-h-[40px] px-3 text-xs font-medium">恢复草稿</button>
                      <button type="button" onClick={handleCopyShoppingList} disabled={!colorCounts} className="glass-action min-h-[40px] px-3 text-xs font-medium disabled:opacity-40">复制清单</button>
                      <button type="button" onClick={openDownloadSettings} disabled={!mappedPixelData} className="glass-action col-span-2 min-h-[40px] px-3 text-xs font-medium disabled:opacity-40">导出图纸</button>
                    </div>
                  </section>

                  <section className="settings-panel-card" style={{ animationDelay: '80ms' }}>
                    <div className="mb-3 text-xs font-semibold uppercase text-[var(--muted)]">处理参数</div>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="grid gap-1 text-[11px] text-[var(--muted)]">
                          横轴格数
                          <input id="granularityInput" type="number" value={granularityInput} onChange={handleGranularityInputChange} min="10" max="300" className="rounded-lg border border-[rgba(var(--line-rgb),0.22)] bg-white/68 px-2 py-2 text-xs text-[var(--text)] outline-none focus:border-[rgba(var(--accent-rgb),0.55)]" />
                        </label>
                        <label className="grid gap-1 text-[11px] text-[var(--muted)]">
                          颜色合并阈值
                          <input id="similarityThresholdInput" type="number" value={similarityThresholdInput} onChange={handleSimilarityThresholdInputChange} min="0" max="100" className="rounded-lg border border-[rgba(var(--line-rgb),0.22)] bg-white/68 px-2 py-2 text-xs text-[var(--text)] outline-none focus:border-[rgba(var(--accent-rgb),0.55)]" />
                          <span className="leading-5">{MERGE_THRESHOLD_HELP}</span>
                        </label>
                      </div>
                      <button type="button" onClick={handleConfirmParameters} className="glass-action glass-action-primary min-h-[40px] w-full px-3 text-xs font-medium">应用参数</button>
                      <label className="grid gap-1 text-[11px] text-[var(--muted)]">
                        解析风格
                        <select value={pixelationMode} onChange={handlePixelationModeChange} className="rounded-lg border border-[rgba(var(--line-rgb),0.22)] bg-white/68 px-2 py-2 text-xs text-[var(--text)] outline-none focus:border-[rgba(var(--accent-rgb),0.55)]">
                          <option value={PixelationMode.Dominant}>卡通 (主色)</option>
                          <option value={PixelationMode.Average}>真实 (平均)</option>
                        </select>
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {colorSystemOptions.map(option => (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => setSelectedColorSystem(option.key as ColorSystem)}
                            className={`rounded-lg border px-2 py-1.5 text-[11px] transition ${selectedColorSystem === option.key ? 'border-[rgba(var(--accent-rgb),0.55)] bg-[rgba(var(--accent-rgb),0.14)] text-[var(--text)]' : 'border-[rgba(var(--line-rgb),0.2)] bg-white/38 text-[var(--muted)] hover:bg-white/62'}`}
                          >
                            {option.name}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={openCustomPaletteEditor} className="glass-action min-h-[40px] px-3 text-xs font-medium">管理色板</button>
                        <button type="button" onClick={handleAutoRemoveBackground} disabled={!mappedPixelData} className="glass-action min-h-[40px] px-3 text-xs font-medium disabled:opacity-40">一键去背景</button>
                      </div>
                    </div>
                  </section>

                  <section className="settings-panel-card" style={{ animationDelay: '120ms' }}>
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase text-[var(--muted)]">颜色统计</span>
                      <button type="button" onClick={() => setShowExcludedColors(prev => !prev)} className="text-[11px] text-[var(--muted)] hover:text-[var(--text)]">排除 {excludedColorKeys.size}</button>
                    </div>
                    {colorCountEntries.length > 0 ? (
                      <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                        {colorCountEntries
                          .filter(item => showExcludedColors || !item.isExcluded)
                          .map((item, index) => (
                            <button
                              key={item.hexKey}
                              type="button"
                              onClick={() => handleToggleExcludeColor(item.hexKey)}
                              className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${item.isExcluded ? 'bg-red-50/80 text-red-700 line-through opacity-70' : 'bg-white/38 text-[var(--text)] hover:bg-white/68'}`}
                              style={{ animationDelay: `${Math.min(index * 10, 240)}ms` }}
                              title={item.isExcluded ? `恢复 ${item.displayKey}` : `排除 ${item.displayKey}`}
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="h-4 w-4 flex-shrink-0 rounded border border-black/10" style={{ backgroundColor: item.isExcluded ? '#999999' : item.color }} />
                                <span className="truncate font-mono font-semibold">{item.displayKey}</span>
                              </span>
                              <span className="tabular-nums text-[var(--muted)]">{item.count}</span>
                            </button>
                          ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-[rgba(var(--line-rgb),0.2)] px-3 py-6 text-center text-xs text-[var(--muted)]">导入图片后显示色号用量</div>
                    )}
                  </section>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isCustomPaletteEditorOpen && (
        <div
          className={`workspace-app theme-${appearanceSettings.theme} palette-backdrop fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4 backdrop-blur-md`}
          style={appearanceStyle}
        >
          <div className="palette-modal w-full max-w-5xl">
              <CustomPaletteEditor
                allColors={fullBeadPalette}
                currentSelections={customPaletteSelections}
                onSelectionChange={handleSelectionChange}
                onSaveCustomPalette={handleSaveCustomPalette}
                onClose={() => setIsCustomPaletteEditorOpen(false)}
                onExportCustomPalette={handleExportCustomPalette}
                onImportCustomPalette={triggerImportPalette}
                selectedColorSystem={selectedColorSystem}
                onColorSystemChange={setSelectedColorSystem}
              />
          </div>
        </div>
      )}

      {isStickerPanelOpen && (
        <div
          className={`workspace-app theme-${appearanceSettings.theme} palette-backdrop fixed inset-0 z-[130] flex items-center justify-center bg-black/42 p-4 backdrop-blur-md`}
          style={appearanceStyle}
        >
          <div className="palette-modal w-full max-w-[390px]">
            <div className="settings-shell flex max-h-[88vh] flex-col overflow-hidden rounded-[22px]">
              <div className="settings-head flex items-start justify-between gap-4 border-b border-[rgba(var(--line-rgb),0.18)] px-5 py-4">
                <div>
                  <div className="text-base font-semibold text-[var(--text)]">添加贴纸</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">选择形状、风格和大小后放到图纸上</div>
                </div>
                <button type="button" onClick={() => setIsStickerPanelOpen(false)} className="palette-icon-button" aria-label="关闭添加贴纸">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                    <path d="M18 6L6 18" />
                    <path d="M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-5 overflow-y-auto px-5 py-5">
                <div className="grid h-44 place-items-center rounded-xl border border-[rgba(var(--line-rgb),0.18)] bg-white/34">
                  <StickerMark sticker={{ ...stickerDraft, id: 'preview', layerId: 'preview', x: 50, y: 50 }} />
                </div>

                <section>
                  <div className="mb-2 text-sm font-semibold">形状</div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      ['heart', '爱心'],
                      ['star', '星星'],
                      ['circle', '圆形'],
                      ['diamond', '菱形'],
                    ].map(([shape, label]) => (
                      <button
                        key={shape}
                        type="button"
                        onClick={() => setStickerDraft(prev => ({ ...prev, shape: shape as StickerShape }))}
                        className={`rounded-xl border px-2 py-3 text-xs transition ${stickerDraft.shape === shape ? 'border-[rgba(var(--accent-rgb),0.58)] bg-[rgba(var(--accent-rgb),0.14)] text-[var(--text)]' : 'border-[rgba(var(--line-rgb),0.16)] bg-white/42 text-[var(--muted)] hover:bg-white/66'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <div className="mb-2 text-sm font-semibold">风格</div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      ['solid', '纯色'],
                      ['hollow', '镂空'],
                      ['striped', '条纹'],
                    ].map(([style, label]) => (
                      <button
                        key={style}
                        type="button"
                        onClick={() => setStickerDraft(prev => ({ ...prev, style: style as StickerStyle }))}
                        className={`rounded-xl border px-2 py-3 text-xs transition ${stickerDraft.style === style ? 'border-[rgba(var(--accent-rgb),0.58)] bg-[rgba(var(--accent-rgb),0.14)] text-[var(--text)]' : 'border-[rgba(var(--line-rgb),0.16)] bg-white/42 text-[var(--muted)] hover:bg-white/66'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <div className="mb-2 text-sm font-semibold">颜色</div>
                  <div className="flex flex-wrap gap-2">
                    {['#E67F5F', '#F0A58D', '#F7C9B8', '#F5A7B8', '#F45DA9', '#9370DB', '#6495ED', '#51C5C2', '#49B7D0', '#2ECC71', '#F39C12', '#E74C3C', '#202020', '#777777', '#D8D8D8'].map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setStickerDraft(prev => ({ ...prev, color }))}
                        className={`h-8 w-8 rounded-full border transition ${stickerDraft.color === color ? 'border-white ring-2 ring-[rgba(var(--accent-rgb),0.62)]' : 'border-black/10 hover:scale-105'}`}
                        style={{ backgroundColor: color }}
                        aria-label={`选择贴纸颜色 ${color}`}
                      />
                    ))}
                  </div>
                </section>

                <label className="grid gap-2 text-sm font-semibold">
                  <span className="flex items-center justify-between">
                    大小
                    <span className="tabular-nums text-[var(--text)]">{stickerDraft.size}</span>
                  </span>
                  <input
                    type="range"
                    min="2"
                    max="12"
                    value={stickerDraft.size}
                    onChange={event => setStickerDraft(prev => ({ ...prev, size: Number(event.target.value) }))}
                    className="control-range"
                    style={{ '--range-progress': `${((stickerDraft.size - 2) / 10) * 100}%` } as React.CSSProperties}
                  />
                </label>
              </div>
              <div className="flex gap-2 border-t border-[rgba(var(--line-rgb),0.16)] px-5 py-4">
                <button type="button" onClick={() => setIsStickerPanelOpen(false)} className="palette-footer-button flex-1">取消</button>
                <button type="button" onClick={handleCreateStickerLayer} className="palette-save-button flex-1">添加贴纸</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {workspaceMode === 'focus' && focusState.showColorPanel && (
        <ColorPanel
          colors={availableFocusColors}
          currentColor={focusState.currentColor}
          onColorSelect={handleFocusColorChange}
          onClose={() => setFocusState(prev => ({ ...prev, showColorPanel: false }))}
        />
      )}

      {isManualColoringMode && activeEditorTool === 'selection' && (
        <>
          <MagnifierTool
            isActive={isMagnifierActive}
            onToggle={handleToggleMagnifier}
            mappedPixelData={mappedPixelData}
            gridDimensions={gridDimensions}
            selectedColor={selectedColor}
            selectedColorSystem={selectedColorSystem}
            onPixelEdit={handleMagnifierPixelEdit}
            cellSize={gridDimensions ? Math.min(6, Math.max(4, 500 / Math.max(gridDimensions.N, gridDimensions.M))) : 6}
            selectionArea={magnifierSelectionArea}
            onClearSelection={() => setMagnifierSelectionArea(null)}
            isFloatingActive={true}
            onActivateFloating={() => setActiveEditorTool('selection')}
            highlightColorKey={highlightColorKey}
          />
          <MagnifierSelectionOverlay
            isActive={isMagnifierActive && !magnifierSelectionArea}
            canvasRef={pixelatedCanvasRef}
            gridDimensions={gridDimensions}
            cellSize={gridDimensions ? Math.min(6, Math.max(4, 500 / Math.max(gridDimensions.N, gridDimensions.M))) : 6}
            onSelectionComplete={setMagnifierSelectionArea}
          />
        </>
      )}
      <DownloadSettingsModal
        isOpen={isDownloadSettingsOpen}
        onClose={() => setIsDownloadSettingsOpen(false)}
        options={downloadOptions}
        onOptionsChange={setDownloadOptions}
        onDownload={handleDownloadRequest}
        themeClassName={`workspace-app theme-${appearanceSettings.theme}`}
        themeStyle={appearanceStyle}
      />

      {workspaceMode === 'focus' && mappedPixelData && gridDimensions && (
        <>
          <CelebrationAnimation
            isVisible={focusState.showCelebration}
            onComplete={handleFocusCelebrationComplete}
          />
          <CompletionCard
            isVisible={focusState.showCompletionCard}
            mappedPixelData={mappedPixelData}
            gridDimensions={gridDimensions}
            totalElapsedTime={focusState.totalElapsedTime}
            onClose={() => setFocusState(prev => ({ ...prev, showCompletionCard: false }))}
          />
        </>
      )}

      {toastMessage && (
        <div
          className="settings-shell fixed bottom-20 left-1/2 z-[200] -translate-x-1/2 whitespace-nowrap rounded-xl px-4 py-2 text-sm"
          style={{ animation: 'toastFadeInOut 2s ease-in-out' }}
        >
          {toastMessage}
        </div>
      )}
    </>
  );
}
