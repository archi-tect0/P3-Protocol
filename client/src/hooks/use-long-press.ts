import { useCallback, useRef, useState } from 'react';

const LONG_PRESS_THRESHOLD = 420;

interface UseLongPressOptions {
  onLongPress: () => void;
  onClick?: () => void;
  threshold?: number;
  disabled?: boolean;
}

interface UseLongPressHandlers {
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTouchMove: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
}

interface UseLongPressResult {
  handlers: UseLongPressHandlers;
  isLongPressing: boolean;
}

export function useLongPress({
  onLongPress,
  onClick,
  threshold = LONG_PRESS_THRESHOLD,
  disabled = false,
}: UseLongPressOptions): UseLongPressResult {
  const [isLongPressing, setIsLongPressing] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggered = useRef(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setIsLongPressing(false);
  }, []);

  const triggerLongPress = useCallback(() => {
    isLongPressTriggered.current = true;
    setIsLongPressing(false);
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    onLongPress();
    clearLongPressTimer();
  }, [onLongPress, clearLongPressTimer]);

  const startLongPress = useCallback(() => {
    if (disabled) return;
    isLongPressTriggered.current = false;
    setIsLongPressing(true);
    longPressTimer.current = setTimeout(() => {
      triggerLongPress();
    }, threshold);
  }, [disabled, threshold, triggerLongPress]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      startLongPress();
    }
  }, [startLongPress]);

  const handleMouseUp = useCallback(() => {
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  const handleMouseLeave = useCallback(() => {
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    }
    startLongPress();
  }, [startLongPress]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (isLongPressTriggered.current) {
      e.preventDefault();
    }
    clearLongPressTimer();
    touchStartPos.current = null;
  }, [clearLongPressTimer]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartPos.current && e.touches[0]) {
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - touchStartPos.current.x);
      const dy = Math.abs(touch.clientY - touchStartPos.current.y);
      if (dx > 10 || dy > 10) {
        clearLongPressTimer();
      }
    }
  }, [clearLongPressTimer]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isLongPressTriggered.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPressTriggered.current = false;
      return;
    }
    onClick?.();
  }, [onClick]);

  return {
    handlers: {
      onMouseDown: handleMouseDown,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseLeave,
      onTouchStart: handleTouchStart,
      onTouchEnd: handleTouchEnd,
      onTouchMove: handleTouchMove as any,
      onContextMenu: handleContextMenu,
      onClick: handleClick,
    },
    isLongPressing,
  };
}

export default useLongPress;
