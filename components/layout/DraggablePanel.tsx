import { useState, useRef, useEffect, ReactNode } from 'react';
import { GripVertical, X } from 'lucide-react';

export type PanelPosition = 'left' | 'right' | 'floating';

interface DraggablePanelProps {
  children: ReactNode;
  title: string;
  defaultPosition?: PanelPosition;
  onPositionChange?: (position: PanelPosition) => void;
  onClose?: () => void;
  className?: string;
}

export function DraggablePanel({
  children,
  title,
  defaultPosition = 'right',
  onPositionChange,
  onClose,
  className = '',
}: DraggablePanelProps) {
  const [position, setPosition] = useState<PanelPosition>(defaultPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (position !== 'floating') return;
    setIsDragging(true);
    const rect = panelRef.current?.getBoundingClientRect();
    if (rect) {
      setDragStart({ x: e.clientX, y: e.clientY });
      setOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || position !== 'floating') return;
    const newX = e.clientX - offset.x;
    const newY = e.clientY - offset.y;
    
    if (panelRef.current) {
      panelRef.current.style.left = `${newX}px`;
      panelRef.current.style.top = `${newY}px`;
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Attach global mouse events for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  const handlePositionChange = (newPosition: PanelPosition) => {
    setPosition(newPosition);
    onPositionChange?.(newPosition);
  };

  const baseClasses = 'bg-[#0a0a00] border border-[#D4AF37]/20 flex flex-col';
  
  if (position === 'floating') {
    return (
      <div
        ref={panelRef}
        className={`${baseClasses} fixed z-50 rounded-lg shadow-2xl ${className}`}
        style={{ width: '320px', height: '400px' }}
        onMouseDown={handleMouseDown}
      >
        <div className="h-10 flex items-center justify-between px-3 border-b border-[#D4AF37]/20 cursor-move">
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-[#D4AF37]/60" />
            <h3 className="text-sm font-semibold text-[#D4AF37]">{title}</h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePositionChange('right')}
              className="p-1 hover:bg-[#D4AF37]/10 rounded text-[#D4AF37]/60 hover:text-[#D4AF37] text-xs"
              title="Dock Right"
            >
              →
            </button>
            <button
              onClick={() => handlePositionChange('left')}
              className="p-1 hover:bg-[#D4AF37]/10 rounded text-[#D4AF37]/60 hover:text-[#D4AF37] text-xs"
              title="Dock Left"
            >
              ←
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 hover:bg-[#D4AF37]/10 rounded text-[#D4AF37]/60 hover:text-[#D4AF37]"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    );
  }

  return (
    <div className={`${baseClasses} ${className}`}>
      <div className="h-10 flex items-center justify-between px-3 border-b border-[#D4AF37]/20">
        <h3 className="text-sm font-semibold text-[#D4AF37]">{title}</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handlePositionChange(position === 'left' ? 'right' : 'left')}
            className="p-1 hover:bg-[#D4AF37]/10 rounded text-[#D4AF37]/60 hover:text-[#D4AF37] text-xs"
            title={position === 'left' ? 'Move Right' : 'Move Left'}
          >
            {position === 'left' ? '→' : '←'}
          </button>
          <button
            onClick={() => handlePositionChange('floating')}
            className="p-1 hover:bg-[#D4AF37]/10 rounded text-[#D4AF37]/60 hover:text-[#D4AF37]"
            title="Float"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-[#D4AF37]/10 rounded text-[#D4AF37]/60 hover:text-[#D4AF37]"
              title="Hide"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
