'use client';

import React, { useRef, useEffect, TouchEvent, MouseEvent, useState } from 'react';
import { MappedPixel } from '../utils/pixelation';

export type CanvasInteractionPhase = 'start' | 'move' | 'end';

const getCanvasSizeForGrid = (dims: { N: number; M: number }) => {
  const { N, M } = dims;
  const baseWidth = 500;
  const minCellSize = 4;
  const recommendedCellSize = 6;
  let outputWidth = baseWidth;

  if (N > 100) {
    const requiredWidthForMinSize = N * minCellSize;
    const requiredWidthForRecommendedSize = N * recommendedCellSize;
    const viewportLimit = typeof window === 'undefined' ? 1200 : window.innerWidth * 0.9;
    const maxWidth = Math.min(1200, viewportLimit);
    outputWidth = Math.min(maxWidth, Math.max(baseWidth, requiredWidthForRecommendedSize));
    outputWidth = Math.max(outputWidth, requiredWidthForMinSize);
  }

  return {
    width: Math.round(outputWidth),
    height: Math.max(1, Math.round(outputWidth * (M / N))),
  };
};

interface PixelatedPreviewCanvasProps {
  mappedPixelData: MappedPixel[][] | null;
  gridDimensions: { N: number; M: number } | null;
  isManualColoringMode: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onInteraction: (
    clientX: number,
    clientY: number,
    pageX: number,
    pageY: number,
    isClick: boolean,
    isTouchEnd?: boolean,
    phase?: CanvasInteractionPhase
  ) => void;
  highlightColorKey?: string | null;
  panMode?: boolean;
  dragPaintMode?: boolean;
}

// 绘制像素化画布的函数
const drawPixelatedCanvas = (
  dataToDraw: MappedPixel[][],
  canvas: HTMLCanvasElement | null,
  dims: { N: number; M: number } | null,
  highlightColorKey?: string | null,
  isHighlighting?: boolean
) => {
  if (!canvas || !dims || !dataToDraw) {
    console.warn("drawPixelatedCanvas: Missing required parameters");
    return;
  }
  
  const pixelatedCtx = canvas.getContext('2d');
  if (!pixelatedCtx) {
    console.error("Failed to get 2D context for pixelated canvas");
    return;
  }

  // Respect current dark mode preference
  const isDarkMode = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');

  // Define colors based on mode
  const externalBackgroundColor = isDarkMode ? '#374151' : '#F3F4F6'; // gray-700 : gray-100
  const gridLineColor = isDarkMode ? '#4B5563' : '#DDDDDD'; // gray-600 : lighter gray

  const { N, M } = dims;
  const canvasSize = getCanvasSizeForGrid(dims);
  if (canvas.width !== canvasSize.width || canvas.height !== canvasSize.height) {
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
  }

  const outputWidth = canvas.width;
  const outputHeight = canvas.height;
  const cellWidthOutput = outputWidth / N;
  const cellHeightOutput = outputHeight / M;

  pixelatedCtx.clearRect(0, 0, outputWidth, outputHeight);
  pixelatedCtx.lineWidth = 0.5; // Keep line width thin

  for (let j = 0; j < M; j++) {
    for (let i = 0; i < N; i++) {
      const cellData = dataToDraw[j]?.[i];
      if (!cellData) continue;

      const drawX = i * cellWidthOutput;
      const drawY = j * cellHeightOutput;

      // Fill cell color using mode-specific background for external cells
      if (cellData.isExternal) {
        pixelatedCtx.fillStyle = externalBackgroundColor;
      } else {
        pixelatedCtx.fillStyle = cellData.color;
      }
      pixelatedCtx.fillRect(drawX, drawY, cellWidthOutput, cellHeightOutput);

      // 如果正在高亮且当前单元格不是目标颜色，添加半透明黑色蒙版
      if (isHighlighting && highlightColorKey) {
        let shouldDim = false;
        
        if (cellData.isExternal) {
          // 外部单元格总是变深色（因为它们不是要高亮的颜色）
          shouldDim = true;
        } else {
          // 内部单元格：如果颜色不匹配则变深色
          shouldDim = cellData.color.toUpperCase() !== highlightColorKey.toUpperCase();
        }
        
        if (shouldDim) {
          pixelatedCtx.fillStyle = 'rgba(0, 0, 0, 0.6)'; // 60% 透明度的黑色蒙版
          pixelatedCtx.fillRect(drawX, drawY, cellWidthOutput, cellHeightOutput);
        }
      }

      // Draw grid lines using mode-specific color
      pixelatedCtx.strokeStyle = gridLineColor;
      pixelatedCtx.strokeRect(drawX + 0.5, drawY + 0.5, cellWidthOutput, cellHeightOutput);
    }
  }
};

const PixelatedPreviewCanvas: React.FC<PixelatedPreviewCanvasProps> = ({
  mappedPixelData,
  gridDimensions,
  isManualColoringMode,
  canvasRef,
  onInteraction,
  highlightColorKey,
  panMode = false,
  dragPaintMode = false,
}) => {
  const [darkModeState, setDarkModeState] = useState<boolean | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number; pageX: number; pageY: number } | null>(null);
  const touchMovedRef = useRef<boolean>(false);
  const mousePanRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);
  const mousePaintRef = useRef<boolean>(false);
  const touchPaintRef = useRef<boolean>(false);
  const [isHighlighting, setIsHighlighting] = useState(false);

  // Effect to detect dark mode changes and update state
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkDarkMode = () => {
        const isDark = document.documentElement.classList.contains('dark');
        // Only update state if it actually changes
        if (isDark !== darkModeState) {
            setDarkModeState(isDark);
        }
    };

    // Initial check
    checkDarkMode();

    // Use MutationObserver to watch for class changes on <html>
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    // Cleanup observer on component unmount
    return () => observer.disconnect();

  }, [darkModeState]); // Depend on darkModeState to re-run if needed externally

  // Update useEffect for drawing to depend on darkModeState as well
  useEffect(() => {
    // Ensure darkModeState is not null before drawing
    if (mappedPixelData && gridDimensions && canvasRef.current && darkModeState !== null) {
      console.log(`Redrawing canvas, dark mode: ${darkModeState}`); // Log redraw trigger
      drawPixelatedCanvas(mappedPixelData, canvasRef.current, gridDimensions, highlightColorKey, isHighlighting);
    }
  }, [mappedPixelData, gridDimensions, canvasRef, darkModeState, highlightColorKey, isHighlighting]); // Add darkModeState dependency

  // 处理高亮效果
  useEffect(() => {
    if (highlightColorKey && mappedPixelData && gridDimensions) {
      setIsHighlighting(true);
    } else {
      setIsHighlighting(false);
    }
  }, [highlightColorKey, mappedPixelData, gridDimensions]);

  // --- 鼠标事件处理 ---
  
  // 鼠标移动时显示提示
  const handleMouseMove = (event: MouseEvent<HTMLCanvasElement>) => {
    if (isManualColoringMode && dragPaintMode && mousePaintRef.current) {
      event.preventDefault();
      onInteraction(event.clientX, event.clientY, event.pageX, event.pageY, true, false, 'move');
      return;
    }

    if (panMode && mousePanRef.current) {
      const scrollParent = canvasRef.current?.parentElement;
      if (scrollParent) {
        scrollParent.scrollLeft = mousePanRef.current.scrollLeft - (event.clientX - mousePanRef.current.x);
        scrollParent.scrollTop = mousePanRef.current.scrollTop - (event.clientY - mousePanRef.current.y);
      }
      return;
    }

    // 只有在非手动模式下才通过mousemove显示tooltip，避免干扰手动上色
    if (!isManualColoringMode) {
        onInteraction(event.clientX, event.clientY, event.pageX, event.pageY, false);
    }
  };

  // 鼠标离开时隐藏提示
  const handleMouseLeave = () => {
    mousePanRef.current = null;
    const wasPainting = mousePaintRef.current;
    mousePaintRef.current = false;
    // 鼠标离开时总是隐藏tooltip
    onInteraction(0, 0, 0, 0, false, true, wasPainting ? 'end' : undefined);
  };

  const handleMouseDown = (event: MouseEvent<HTMLCanvasElement>) => {
    if (isManualColoringMode && dragPaintMode && !panMode) {
      event.preventDefault();
      mousePaintRef.current = true;
      onInteraction(event.clientX, event.clientY, event.pageX, event.pageY, true, false, 'start');
      return;
    }

    if (!panMode) return;
    const scrollParent = canvasRef.current?.parentElement;
    if (!scrollParent) return;
    mousePanRef.current = {
      x: event.clientX,
      y: event.clientY,
      scrollLeft: scrollParent.scrollLeft,
      scrollTop: scrollParent.scrollTop,
    };
  };

  const handleMouseUp = () => {
    mousePanRef.current = null;
    if (mousePaintRef.current) {
      onInteraction(0, 0, 0, 0, false, true, 'end');
    }
    mousePaintRef.current = false;
  };

  // 鼠标点击处理（用于手动上色模式）
  const handleClick = (event: MouseEvent<HTMLCanvasElement>) => {
    if (panMode) return;
    if (isManualColoringMode && dragPaintMode) return;
    // 鼠标点击行为保持不变：
    // 手动模式下：上色
    // 非手动模式下：切换tooltip
    onInteraction(event.clientX, event.clientY, event.pageX, event.pageY, isManualColoringMode);
  };

  // --- 触摸事件处理 ---
  // 用于检测触摸移动的参考
  const handleTouchStart = (event: TouchEvent<HTMLCanvasElement>) => {
    const touch = event.touches[0];
    if (!touch) return;

    // 记录起始位置并重置移动标志
    touchStartPosRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      pageX: touch.pageX,
      pageY: touch.pageY
    };
    touchMovedRef.current = false;

    if (isManualColoringMode && dragPaintMode && !panMode) {
      event.preventDefault();
      touchPaintRef.current = true;
      onInteraction(touch.clientX, touch.clientY, touch.pageX, touch.pageY, true, false, 'start');
      return;
    }

    // 在非手动模式下，触摸开始时仍然可以立即显示/切换tooltip，提供即时反馈
    if (!isManualColoringMode) {
        onInteraction(touch.clientX, touch.clientY, touch.pageX, touch.pageY, false);
    }
    // 注意：此处不再触发手动上色 (isClick: true)
  };
  
  // 触摸移动时检测是否需要隐藏提示
  const handleTouchMove = (event: TouchEvent<HTMLCanvasElement>) => {
    const touch = event.touches[0];
    if (!touch || !touchStartPosRef.current) return;

    if (isManualColoringMode && dragPaintMode && touchPaintRef.current && !panMode) {
      event.preventDefault();
      touchMovedRef.current = true;
      onInteraction(touch.clientX, touch.clientY, touch.pageX, touch.pageY, true, false, 'move');
      return;
    }
    
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
    
    // 如果移动超过阈值，则标记为已移动，并隐藏tooltip
    // 增加一个稍大的阈值，以更好地区分点击和微小的手指抖动/滑动意图
    if (!touchMovedRef.current && (dx > 10 || dy > 10)) {
      touchMovedRef.current = true;
      // 一旦确定是移动，就隐藏tooltip
      onInteraction(0, 0, 0, 0, false, true);
    }

    if (panMode && touchMovedRef.current) {
      const scrollParent = canvasRef.current?.parentElement;
      if (scrollParent) {
        scrollParent.scrollLeft -= touch.clientX - touchStartPosRef.current.x;
        scrollParent.scrollTop -= touch.clientY - touchStartPosRef.current.y;
        touchStartPosRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          pageX: touch.pageX,
          pageY: touch.pageY,
        };
      }
    }
  };
  
  // 触摸结束时不再自动隐藏提示框
  const handleTouchEnd = () => {
    const wasDragPainting = isManualColoringMode && dragPaintMode && touchPaintRef.current;
    if (wasDragPainting) {
      onInteraction(0, 0, 0, 0, false, true, 'end');
    }
    // 检查是否是手动模式，并且触摸没有移动（判定为点击）
    if (!wasDragPainting && isManualColoringMode && !panMode && !touchMovedRef.current && touchStartPosRef.current) {
      // 使用触摸开始时的坐标来执行上色操作
      const { x, y, pageX, pageY } = touchStartPosRef.current;
      onInteraction(x, y, pageX, pageY, true); // isClick: true 表示执行上色
    }
    // 如果是非手动模式下的点击 (isManualColoringMode=false, touchMovedRef=false)
    // Tooltip 的显示/隐藏切换已在 touchstart 处理，touchend 时无需额外操作

    // 重置触摸状态
    touchStartPosRef.current = null;
    touchMovedRef.current = false;
    touchPaintRef.current = false;
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd} // 添加 onTouchCancel 以处理触摸中断的情况
      className={`border border-gray-300 dark:border-gray-600 max-w-full h-auto rounded block ${
        panMode ? 'cursor-grab active:cursor-grabbing' : (isManualColoringMode ? 'cursor-pointer' : 'cursor-grab')
      }`}
      style={{
        imageRendering: 'pixelated',
        touchAction: panMode || dragPaintMode ? 'none' : 'auto',
      }}
    />
  );
};

export default PixelatedPreviewCanvas;
