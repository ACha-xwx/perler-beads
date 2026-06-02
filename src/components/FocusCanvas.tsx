import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MappedPixel } from '../utils/pixelation';

interface FocusCanvasProps {
  mappedPixelData: MappedPixel[][];
  gridDimensions: { N: number; M: number };
  currentColor: string;
  completedCells: Set<string>;
  recommendedCell: { row: number; col: number } | null;
  recommendedRegion: { row: number; col: number }[] | null;
  canvasScale: number;
  canvasOffset: { x: number; y: number };
  gridSectionInterval: number;
  showSectionLines: boolean;
  sectionLineColor: string;
  onCellClick: (row: number, col: number) => void;
  onScaleChange: (scale: number) => void;
  onOffsetChange: (offset: { x: number; y: number }) => void;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const FocusCanvas: React.FC<FocusCanvasProps> = ({
  mappedPixelData,
  gridDimensions,
  currentColor,
  completedCells,
  recommendedCell,
  recommendedRegion,
  canvasScale,
  canvasOffset,
  gridSectionInterval,
  showSectionLines,
  sectionLineColor,
  onCellClick,
  onScaleChange,
  onOffsetChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    offsetX: number;
    offsetY: number;
    moved: boolean;
  } | null>(null);
  const pinchRef = useRef<{ distance: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const cellSize = Math.max(15, Math.min(40, 300 / Math.max(gridDimensions.N, gridDimensions.M)));
  const recommendedSet = useMemo(
    () => new Set((recommendedRegion || []).map(cell => `${cell.row},${cell.col}`)),
    [recommendedRegion]
  );

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasWidth = gridDimensions.N * cellSize;
    const canvasHeight = gridDimensions.M * cellSize;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.imageSmoothingEnabled = false;

    for (let row = 0; row < gridDimensions.M; row++) {
      for (let col = 0; col < gridDimensions.N; col++) {
        const pixel = mappedPixelData[row]?.[col];
        if (!pixel) continue;

        const x = col * cellSize;
        const y = row * cellSize;
        const cellKey = `${row},${col}`;
        const isCurrent = pixel.color === currentColor;
        const isCompleted = completedCells.has(cellKey);
        const isRecommended = recommendedSet.has(cellKey);

        if (pixel.isExternal) {
          ctx.fillStyle = '#f4f4ef';
        } else if (isCurrent) {
          ctx.fillStyle = pixel.color;
        } else {
          ctx.fillStyle = '#e2e2dc';
        }

        ctx.fillRect(x, y, cellSize, cellSize);

        if (!pixel.isExternal && !isCurrent) {
          ctx.fillStyle = 'rgba(255,255,255,0.34)';
          ctx.fillRect(x, y, cellSize, cellSize);
        }

        ctx.strokeStyle = isCurrent ? 'rgba(20,20,18,0.34)' : 'rgba(20,20,18,0.08)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);

        if (isRecommended) {
          ctx.strokeStyle = 'rgba(17,17,15,0.9)';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([cellSize * 0.28, cellSize * 0.18]);
          ctx.strokeRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
          ctx.setLineDash([]);
        }

        if (isCompleted && isCurrent) {
          ctx.fillStyle = 'rgba(255,255,255,0.68)';
          ctx.fillRect(x, y, cellSize, cellSize);
          ctx.strokeStyle = '#11110f';
          ctx.lineWidth = Math.max(2, cellSize * 0.09);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(x + cellSize * 0.22, y + cellSize * 0.52);
          ctx.lineTo(x + cellSize * 0.42, y + cellSize * 0.7);
          ctx.lineTo(x + cellSize * 0.78, y + cellSize * 0.3);
          ctx.stroke();
        }
      }
    }

    if (recommendedCell) {
      const x = recommendedCell.col * cellSize;
      const y = recommendedCell.row * cellSize;
      ctx.fillStyle = '#11110f';
      ctx.beginPath();
      ctx.arc(x + cellSize / 2, y + cellSize / 2, Math.max(3, cellSize * 0.14), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.82)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (showSectionLines) {
      ctx.strokeStyle = sectionLineColor;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.88;

      for (let col = gridSectionInterval; col < gridDimensions.N; col += gridSectionInterval) {
        const x = col * cellSize;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
      }

      for (let row = gridSectionInterval; row < gridDimensions.M; row += gridSectionInterval) {
        const y = row * cellSize;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
    }
  }, [
    mappedPixelData,
    gridDimensions,
    cellSize,
    currentColor,
    completedCells,
    recommendedSet,
    recommendedCell,
    gridSectionInterval,
    showSectionLines,
    sectionLineColor,
  ]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  const getCanvasPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / canvasScale,
      y: (clientY - rect.top) / canvasScale,
    };
  };

  const getGridPosition = (clientX: number, clientY: number) => {
    const point = getCanvasPoint(clientX, clientY);
    if (!point) return null;

    const col = Math.floor(point.x / cellSize);
    const row = Math.floor(point.y / cellSize);

    if (row >= 0 && row < gridDimensions.M && col >= 0 && col < gridDimensions.N) {
      return { row, col };
    }
    return null;
  };

  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      offsetX: canvasOffset.x,
      offsetY: canvasOffset.y,
      moved: false,
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;

    const deltaX = event.clientX - drag.lastX;
    const deltaY = event.clientY - drag.lastY;
    const totalDistance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (totalDistance > 4) drag.moved = true;

    drag.offsetX += deltaX;
    drag.offsetY += deltaY;
    onOffsetChange({ x: drag.offsetX, y: drag.offsetY });

    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setIsDragging(false);

    if (!drag || drag.moved) return;

    const gridPos = getGridPosition(event.clientX, event.clientY);
    if (gridPos) {
      onCellClick(gridPos.row, gridPos.col);
    }
  };

  const handleWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    onScaleChange(clamp(canvasScale * delta, 0.3, 3));
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    if (event.touches.length === 2) {
      pinchRef.current = { distance: getTouchDistance(event.touches) };
      dragRef.current = null;
      setIsDragging(false);
    }
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    if (event.touches.length !== 2 || !pinchRef.current) return;
    event.preventDefault();
    const distance = getTouchDistance(event.touches);
    if (pinchRef.current.distance <= 0) return;
    const ratio = distance / pinchRef.current.distance;
    onScaleChange(clamp(canvasScale * ratio, 0.3, 3));
    pinchRef.current.distance = distance;
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (event.touches.length < 2) {
      pinchRef.current = null;
    }
  };

  return (
    <div
      className="focus-canvas-shell h-full w-full overflow-hidden rounded-[22px]"
      style={{ touchAction: 'none' }}
    >
      <div className="flex h-full w-full items-center justify-center">
        <div
          className="focus-canvas-transform"
          style={{
            transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasScale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 240ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <canvas
            ref={canvasRef}
            className="cursor-grab rounded-lg border border-[rgba(var(--line-rgb),0.24)] shadow-[0_18px_44px_rgba(var(--shadow-rgb),0.16)] active:cursor-grabbing"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />
        </div>
      </div>
    </div>
  );
};

export default FocusCanvas;
