import { useRef, useCallback } from 'react';

interface IUseSwipeOptions {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  edgeZone?: number;
  threshold?: number;
}

export const useSwipe = ({
  isOpen,
  onOpen,
  onClose,
  edgeZone = 40,
  threshold = 50,
}: IUseSwipeOptions) => {
  const startX = useRef(0);
  const startY = useRef(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - startX.current;
    const deltaY = e.changedTouches[0].clientY - startY.current;

    if (Math.abs(deltaX) < threshold || Math.abs(deltaX) <= Math.abs(deltaY)) return;

    if (deltaX > 0 && startX.current < edgeZone && !isOpen) {
      onOpen();
    } else if (deltaX < 0 && isOpen) {
      onClose();
    }
  }, [isOpen, onOpen, onClose, edgeZone, threshold]);

  return { onTouchStart, onTouchEnd };
};
