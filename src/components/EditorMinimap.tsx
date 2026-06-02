import React, { useEffect, useRef, useState } from 'react';
import { MappedPixel } from '../utils/pixelation';

interface EditorMinimapProps {
  mappedPixelData: MappedPixel[][];
  gridDimensions: { N: number; M: number };
  targetCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  onClose: () => void;
}

const MIN_SIZE = 96;
const MAX_SIZE = 220;

export default function EditorMinimap({
  mappedPixelData,
  gridDimensions,
  targetCanvasRef,
  onClose,
}: EditorMinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; left: number; top: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; size: number } | null>(null);
  const [position, setPosition] = useState({ left: 14, top: 14 });
  const [size, setSize] = useState(132);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { N, M } = gridDimensions;
    const pixelRatio = window.devicePixelRatio || 1;
    const width = size;
    const height = Math.max(M / N * width, MIN_SIZE * 0.6);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;

    const cellWidth = width / N;
    const cellHeight = height / M;

    mappedPixelData.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        ctx.fillStyle = cell?.isExternal ? '#f1f1ed' : cell?.color || '#ffffff';
        ctx.fillRect(colIndex * cellWidth, rowIndex * cellHeight, Math.ceil(cellWidth), Math.ceil(cellHeight));
      });
    });
  }, [mappedPixelData, gridDimensions, size]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (dragRef.current) {
        const nextLeft = dragRef.current.left + event.clientX - dragRef.current.startX;
        const nextTop = dragRef.current.top + event.clientY - dragRef.current.startY;
        setPosition({
          left: Math.max(8, Math.min(nextLeft, window.innerWidth - size - 32)),
          top: Math.max(8, Math.min(nextTop, window.innerHeight - size - 32)),
        });
      }

      if (resizeRef.current) {
        const delta = Math.max(event.clientX - resizeRef.current.startX, event.clientY - resizeRef.current.startY);
        setSize(Math.max(MIN_SIZE, Math.min(MAX_SIZE, resizeRef.current.size + delta)));
      }
    };

    const handlePointerUp = () => {
      dragRef.current = null;
      resizeRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [size]);

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('[data-minimap-control]')) return;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      left: position.left,
      top: position.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const startResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    resizeRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      size,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const targetCanvas = targetCanvasRef.current;
    const scrollParent = targetCanvas?.parentElement;
    if (!targetCanvas || !scrollParent) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const xRatio = (event.clientX - rect.left) / rect.width;
    const yRatio = (event.clientY - rect.top) / rect.height;
    const targetRect = targetCanvas.getBoundingClientRect();

    scrollParent.scrollLeft = Math.max(0, xRatio * targetRect.width - scrollParent.clientWidth / 2);
    scrollParent.scrollTop = Math.max(0, yRatio * targetRect.height - scrollParent.clientHeight / 2);
  };

  return (
    <div
      className="floating-minimap absolute z-20 overflow-hidden rounded-xl border border-[rgba(var(--line-rgb),0.22)] bg-[rgba(var(--panel-rgb),0.82)] shadow-[0_18px_44px_rgba(var(--shadow-rgb),0.16)] backdrop-blur-xl"
      style={{ left: position.left, top: position.top }}
      onPointerDown={startDrag}
    >
      <div className="flex cursor-grab items-center justify-between gap-2 border-b border-[rgba(var(--line-rgb),0.14)] bg-white/38 px-2 py-1.5 text-[10px] font-semibold text-[var(--muted)] active:cursor-grabbing">
        <span>小地图</span>
        <button
          type="button"
          data-minimap-control
          onClick={onClose}
          className="grid h-6 w-6 place-items-center rounded-md text-[var(--muted)] hover:bg-[rgba(var(--accent-rgb),0.1)] hover:text-[var(--text)]"
          aria-label="隐藏小地图"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-3.5 w-3.5">
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
      </div>
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="block cursor-crosshair"
        style={{ imageRendering: 'pixelated' }}
      />
      <button
        type="button"
        data-minimap-control
        onPointerDown={startResize}
        className="absolute bottom-0 right-0 grid h-5 w-5 cursor-se-resize place-items-center text-[var(--muted)]"
        aria-label="调整小地图大小"
      >
        <svg className="h-3 w-3" viewBox="0 0 6 6" fill="currentColor">
          <circle cx="5" cy="5" r="1" />
          <circle cx="2" cy="5" r="1" />
          <circle cx="5" cy="2" r="1" />
        </svg>
      </button>
    </div>
  );
}
