import React from 'react';
import { IndianRupee, MapPin, Navigation, Timer, X, Check, Zap } from 'lucide-react';
import { TaxiOffer } from '../game/missions/MissionManager';

interface TaxiOfferModalProps {
  offer: TaxiOffer;
  onAccept: () => void;
  onDecline: () => void;
  hindiLabels: boolean;
}

const ARCHETYPE_STYLES: Record<string, string> = {
  vip: 'bg-violet-500/20 border-violet-400/50 text-violet-300',
  impatient: 'bg-rose-500/20 border-rose-400/50 text-rose-300',
  hopper: 'bg-sky-500/20 border-sky-400/50 text-sky-300',
  standard: 'bg-neutral-500/20 border-neutral-400/40 text-neutral-300',
};

export const TaxiOfferModal: React.FC<TaxiOfferModalProps> = ({
  offer,
  onAccept,
  onDecline,
  hindiLabels,
}) => {
  const tagStyle = ARCHETYPE_STYLES[offer.archetype] ?? ARCHETYPE_STYLES.standard;

  return (
    <div className="absolute inset-0 bg-neutral-950/85 backdrop-blur-xl z-50 flex items-center justify-center p-6 select-none font-display text-neutral-100">
      <div className="w-full max-w-md hud-glass p-6 rounded-3xl border border-neutral-700 shadow-2xl flex flex-col text-neutral-100">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-extrabold uppercase tracking-widest text-amber-400">
            {hindiLabels ? 'नई सवारी' : 'New Fare Offer'}
          </span>
          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${tagStyle}`}>
            {offer.archetypeLabel}
          </span>
        </div>

        <h2 className="text-xl font-extrabold tracking-wide mb-1">{offer.passengerName}</h2>
        <p className="text-xs italic text-amber-200/90 mb-4">{offer.quote}</p>

        {/* Route */}
        <div className="hud-glass-saffron rounded-2xl border border-amber-500/30 p-3.5 mb-4">
          <div className="flex items-start gap-2 mb-2">
            <MapPin className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-[10px] uppercase font-bold text-neutral-400">
                {hindiLabels ? 'पिकअप' : 'Pickup'}
              </div>
              <div className="text-xs font-semibold">{offer.pickupName}</div>
            </div>
          </div>
          <div className="ml-2 pl-4 border-l-2 border-dashed border-amber-500/30 my-1 h-3" />
          <div className="flex items-start gap-2">
            <Navigation className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-[10px] uppercase font-bold text-neutral-400">
                {hindiLabels ? 'ड्रॉप' : 'Drop-off'}
              </div>
              <div className="text-xs font-semibold">{offer.dropName}</div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="hud-glass rounded-xl p-2.5 text-center border border-neutral-700">
            <div className="text-[10px] uppercase font-bold text-neutral-400 mb-0.5">
              {hindiLabels ? 'दूरी' : 'Distance'}
            </div>
            <div className="text-sm font-extrabold text-neutral-100">{offer.estimatedKm} km</div>
          </div>
          <div className="hud-glass rounded-xl p-2.5 text-center border border-neutral-700">
            <div className="text-[10px] uppercase font-bold text-neutral-400 mb-0.5 flex items-center justify-center gap-1">
              <Timer className="w-3 h-3" />
              {hindiLabels ? 'समय' : 'Time'}
            </div>
            <div className="text-sm font-extrabold text-neutral-100">
              {Math.floor(offer.timeLimitSec / 60)}:{String(offer.timeLimitSec % 60).padStart(2, '0')}
            </div>
          </div>
          <div className="hud-glass-saffron rounded-xl p-2.5 text-center border border-amber-500/40">
            <div className="text-[10px] uppercase font-bold text-neutral-400 mb-0.5">
              {hindiLabels ? 'किराया' : 'Est. Fare'}
            </div>
            <div className="text-sm font-extrabold text-amber-300 flex items-center justify-center">
              <IndianRupee className="w-3.5 h-3.5" />
              {offer.estimatedFare.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {offer.tipHint && (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-300 mb-4">
            <Zap className="w-3.5 h-3.5" />
            <span className="font-semibold">{offer.tipHint}</span>
          </div>
        )}

        {/* Actions */}
        <div className="w-full flex gap-3">
          <button
            onClick={onDecline}
            className="flex-1 py-3 rounded-2xl hud-glass border border-neutral-700 hover:border-neutral-500 text-neutral-300 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            <X className="w-4 h-4" />
            {hindiLabels ? 'छोड़ो' : 'DECLINE'}
          </button>
          <button
            onClick={onAccept}
            className="flex-1 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-xl active:scale-95 transition-all"
          >
            <Check className="w-4 h-4" />
            {hindiLabels ? 'स्वीकार करो' : 'ACCEPT FARE'}
          </button>
        </div>
        <p className="text-[10px] text-neutral-500 text-center mt-3">
          {hindiLabels
            ? 'मना करने पर कोई जुर्माना नहीं — नई सवारी मिलेगी।'
            : 'No penalty for declining — a fresh offer appears.'}
        </p>
      </div>
    </div>
  );
};
