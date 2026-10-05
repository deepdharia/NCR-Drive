import React from 'react';
import { IndianRupee, Star, CheckCircle, XCircle, RotateCcw, ArrowRight } from 'lucide-react';

interface MissionResultModalProps {
  success: boolean;
  title: string;
  cashEarned: number;
  message: string;
  stars?: number;
  showNextFare?: boolean;
  onNextFare?: () => void;
  onContinue: () => void;
  onRetry: () => void;
}

export const MissionResultModal: React.FC<MissionResultModalProps> = ({
  success,
  title,
  cashEarned,
  message,
  stars,
  showNextFare,
  onNextFare,
  onContinue,
  onRetry,
}) => {
  return (
    <div className="absolute inset-0 bg-neutral-950/85 backdrop-blur-xl z-50 flex items-center justify-center p-6 select-none font-display text-neutral-100">
      <div className="w-full max-w-md hud-glass p-6 rounded-3xl border border-neutral-700 shadow-2xl flex flex-col items-center text-center">
        {/* Result Icon */}
        <div className="mb-3">
          {success ? (
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 animate-bounce">
              <CheckCircle className="w-9 h-9" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full bg-rose-500/20 border-2 border-rose-400 flex items-center justify-center text-rose-400 animate-pulse">
              <XCircle className="w-9 h-9" />
            </div>
          )}
        </div>

        <h2 className="text-2xl font-extrabold tracking-wide mb-1 text-neutral-100">
          {title}
        </h2>
        <p className="text-xs text-neutral-300 mb-5 leading-relaxed max-w-xs">{message}</p>

        {/* Star rating */}
        {success && typeof stars === 'number' && (
          <div className="flex items-center justify-center gap-1.5 mb-5" aria-label={`${stars} out of 5 stars`}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className={`w-7 h-7 ${i <= Math.round(stars) ? 'text-amber-400 fill-amber-400' : 'text-neutral-600'}`}
              />
            ))}
          </div>
        )}

        {/* Cash Reward card */}
        {success && cashEarned > 0 && (
          <div className="w-full hud-glass-saffron p-3.5 rounded-2xl border border-amber-500/40 mb-6 flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-300 uppercase">Payout Earned:</span>
            <div className="flex items-center text-amber-300 font-gauge font-bold text-2xl">
              <IndianRupee className="w-5 h-5 text-amber-400 mr-1" />
              <span>+{cashEarned.toLocaleString('en-IN')}</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="w-full flex gap-3">
          <button
            onClick={onRetry}
            className="flex-1 py-3 rounded-2xl hud-glass border border-neutral-700 hover:border-neutral-500 text-neutral-200 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            TRY AGAIN
          </button>

          {showNextFare && onNextFare && (
            <button
              onClick={onNextFare}
              className="flex-1 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-xl active:scale-95 transition-all"
            >
              NEXT FARE
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onContinue}
            className={`flex-1 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all ${
              showNextFare
                ? 'hud-glass border border-neutral-700 hover:border-neutral-500 text-neutral-200'
                : 'bg-amber-500 hover:bg-amber-400 text-neutral-950 font-extrabold shadow-xl'
            }`}
          >
            CONTINUE
            {!showNextFare && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
