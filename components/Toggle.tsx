interface ToggleProps {
  label?: string;
  checked?: boolean;
  enabled?: boolean;
  onChange: (value: boolean) => void;
  className?: string;
}

export default function Toggle({ label, checked, enabled, onChange, className = '' }: ToggleProps) {
  const isOn = checked ?? enabled ?? false;
  
  return (
    <div className={`flex items-center justify-between ${className}`}>
      {label && <span className="text-sm text-gray-300">{label}</span>}
      <button
        onClick={() => onChange(!isOn)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          isOn ? 'bg-[#D4AF37]' : 'bg-gray-700'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-black transition-transform ${
            isOn ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
