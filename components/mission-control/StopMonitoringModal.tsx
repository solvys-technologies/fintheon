import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/Button';

interface StopMonitoringModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function StopMonitoringModal({ onConfirm, onCancel }: StopMonitoringModalProps) {
  const [isClosing, setIsClosing] = useState(false);

  const handleConfirm = () => {
    setIsClosing(true);
    setTimeout(() => onConfirm(), 1300);
  };

  const handleCancel = () => {
    setIsClosing(true);
    setTimeout(() => onCancel(), 1300);
  };

  return (
    <div className={`fixed inset-0 bg-black/80 flex items-center justify-center z-50 ${isClosing ? 'animate-fade-out-backdrop' : 'animate-fade-in-backdrop'}`}>
      <div className={`bg-[#0a0a00] border border-[#D4AF37]/30 rounded-lg p-6 max-w-md mx-4 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}>
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-[#D4AF37]" />
          <h3 className="text-lg font-semibold text-[#D4AF37]">Stop Monitoring?</h3>
        </div>
        
        <p className="text-sm text-gray-300 mb-6">
          Stopping your PsychAssist session early may result in incomplete emotional analysis. 
          Are you sure you want to end monitoring?
        </p>

        <div className="flex gap-3">
          <Button variant="ghost" onClick={handleCancel} className="flex-1">
            Continue Session
          </Button>
          <Button variant="danger" onClick={handleConfirm} className="flex-1">
            Stop Anyway
          </Button>
        </div>
      </div>
    </div>
  );
}
