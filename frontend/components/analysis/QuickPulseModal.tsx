
import React, { useState, useRef } from 'react';
import { X, Upload, Activity, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { useBackend } from '../../lib/backend';

interface QuickPulseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAnalysisComplete: (result: any) => void;
}

export default function QuickPulseModal({ isOpen, onClose, onAnalysisComplete }: QuickPulseModalProps) {
    const [image, setImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const backend = useBackend();

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                setError("File size too large. Max 5MB.");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setImage(reader.result as string);
                setError(null);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAnalyze = async () => {
        if (!image) return;

        setLoading(true);
        setError(null);

        try {
            // Mock algo state - in a real scenario, this would come from a context or prop
            const algoState = {
                trend: "Bullish",
                rsi: 65,
                macd: "Positive Crossover",
                timeframe: "1H"
            };

            const result = await backend.ai.quickPulse(image, algoState);
            onAnalysisComplete(result);
            onClose();
        } catch (err: any) {
            console.error("Quick Vision failed:", err);
            setError("Failed to analyze chart. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/20 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="p-4 border-b border-[var(--fintheon-accent)]/10 flex items-center justify-between bg-[var(--fintheon-accent)]/5">
                    <div className="flex items-center gap-2 text-[var(--fintheon-accent)]">
                        <Activity className="w-5 h-5" />
                        <h3 className="font-semibold text-lg tracking-wide">Quick Vision</h3>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="p-1 hover:bg-white/5 rounded-full text-zinc-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {!image ? (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-zinc-700 hover:border-[var(--fintheon-accent)]/50 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all hover:bg-[var(--fintheon-accent)]/5 group"
                        >
                            <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Upload className="w-6 h-6 text-zinc-400 group-hover:text-[var(--fintheon-accent)]" />
                            </div>
                            <p className="text-sm text-zinc-300 font-medium">Upload Chart Screenshot</p>
                            <p className="text-xs text-zinc-500">Supports JPG, PNG (Max 5MB)</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="relative rounded-lg overflow-hidden border border-zinc-800">
                                <img src={image} alt="Chart Preview" className="w-full h-auto max-h-[300px] object-cover" />
                                <button
                                    onClick={() => setImage(null)}
                                    disabled={loading}
                                    className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-black/80 rounded-full text-white backdrop-blur-md transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 p-2 rounded border border-red-400/20">
                                    <AlertTriangle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}

                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={onClose}
                                    disabled={loading}
                                    className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAnalyze}
                                    disabled={loading}
                                    className="px-6 py-2 bg-[var(--fintheon-accent)] hover:bg-[#FFD060] text-black font-semibold rounded-lg text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_15px_rgba(255,192,56,0.3)] hover:shadow-[0_0_20px_rgba(255,192,56,0.5)]"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Analyzing...
                                        </>
                                    ) : (
                                        <>
                                            <Activity className="w-4 h-4" />
                                            Run Analysis
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        className="hidden"
                    />
                </div>
            </div>
        </div>
    );
}
