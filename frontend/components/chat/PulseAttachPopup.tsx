// [claude-code 2026-03-09] Redesigned: slide-up panel anchored to composer, drag-drop, image compression
import { useState, useRef, useCallback, type DragEvent } from 'react';
import { X, FileText, Image, Activity } from 'lucide-react';

type AttachTab = 'docs' | 'media' | 'riskflow';

interface PulseAttachPopupProps {
  open: boolean;
  onClose: () => void;
  onAttachImage?: (dataUrl: string) => void;
  onAttachRiskFlow?: (itemId: string) => void;
}

function compressImage(file: File, maxDim = 1200, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function PulseAttachPopup({ open, onClose, onAttachImage, onAttachRiskFlow }: PulseAttachPopupProps) {
  const [tab, setTab] = useState<AttachTab>('media');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Only image files are supported.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be under 10 MB.');
      return;
    }
    setError(null);
    try {
      const dataUrl = await compressImage(file);
      onAttachImage?.(dataUrl);
      onClose();
    } catch {
      setError('Failed to process image.');
    }
  }, [onAttachImage, onClose]);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const tabs: { id: AttachTab; label: string; icon: typeof FileText }[] = [
    { id: 'docs', label: 'Docs', icon: FileText },
    { id: 'media', label: 'Media', icon: Image },
    { id: 'riskflow', label: 'RiskFlow', icon: Activity },
  ];

  return (
    <div
      className="w-full overflow-hidden rounded-xl border border-[var(--fintheon-accent)]/20 transition-all duration-200"
      style={{
        maxHeight: open ? '220px' : '0px',
        opacity: open ? 1 : 0,
        marginBottom: open ? '8px' : '0px',
        backgroundColor: 'var(--fintheon-surface)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--fintheon-accent)]/10">
        <span className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider">Attach</span>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
          <X size={13} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--fintheon-accent)]/10">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setTab(id); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium transition-colors ${
              tab === id ? 'text-[var(--fintheon-accent)] border-b-2 border-[var(--fintheon-accent)]' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '12px 16px', minHeight: '80px' }}>
        {tab === 'docs' && (
          <div className="text-center text-[12px] text-gray-500">
            <FileText size={24} className="mx-auto mb-2 text-gray-600" />
            <p>Document attachment coming soon.</p>
          </div>
        )}
        {tab === 'media' && (
          <div className="text-center">
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer flex flex-col items-center gap-2 border-2 border-dashed rounded-lg p-4 w-full transition-colors ${
                isDragging
                  ? 'border-[var(--fintheon-accent)]/60 bg-[var(--fintheon-accent)]/5'
                  : 'border-[var(--fintheon-accent)]/20 hover:border-[var(--fintheon-accent)]/40'
              }`}
            >
              <Image size={24} className="text-gray-600" />
              <span className="text-[12px] text-gray-400">
                {isDragging ? 'Drop image here' : 'Drop or click to upload'}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = '';
                }}
              />
            </div>
            {error && (
              <p className="mt-2 text-[11px] text-red-400">{error}</p>
            )}
          </div>
        )}
        {tab === 'riskflow' && (
          <div className="text-center text-[12px] text-gray-500">
            <Activity size={24} className="mx-auto mb-2 text-gray-600" />
            <p>Attach a RiskFlow item to your message.</p>
            <p className="text-[10px] text-gray-600 mt-1">Coming soon.</p>
          </div>
        )}
      </div>
    </div>
  );
}
