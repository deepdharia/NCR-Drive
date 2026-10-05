import React from 'react';
import { IndianRupee, Timer, CheckCircle, Award, ArrowRight, X, Star, Lock } from 'lucide-react';
import {
  allMissions,
  isUnlocked,
  isCompleted,
  bestStars,
  TIER_NAMES,
  TIER_HINTS,
  MissionTier,
} from '../game/missions/MissionProgression';

interface MissionSelectModalProps {
  onSelectMission: (missionId: string) => void;
  onClose: () => void;
  hindiLabels?: boolean;
  /** missionId -> best cash; >0 means completed. Wired by the lead from save data. */
  highScores?: Record<string, number>;
}

const TIERS: MissionTier[] = [1, 2, 3];

export const MissionSelectModal: React.FC<MissionSelectModalProps> = ({
  onSelectMission,
  onClose,
  hindiLabels = false,
  highScores = {},
}) => {
  const missions = allMissions();

  return (
    <div className="absolute inset-0 bg-neutral-950/85 backdrop-blur-xl z-40 flex items-center justify-center p-6 select-none font-display">
      <div className="w-full max-w-3xl hud-glass p-6 rounded-3xl border border-teal-500/40 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div>
            <h2 className="text-2xl font-extrabold text-neutral-100 tracking-wide flex items-center gap-2">
              <Award className="w-6 h-6 text-amber-400" />
              {hindiLabels ? 'डीआर ड्राइविंग मिशन' : 'DR. DRIVING CHALLENGES'}
            </h2>
            <p className="text-xs text-teal-400 font-semibold uppercase mt-0.5">
              Precision Driving & Highway Tests in Delhi-NCR
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-neutral-900 border border-neutral-700 hover:border-neutral-500 text-neutral-300 active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mission Cards grouped by tier */}
        <div className="flex-1 overflow-y-auto py-4 space-y-5 pr-1">
          {TIERS.map((tier) => {
            const tierMissions = missions.filter((m) => m.tier === tier);
            if (tierMissions.length === 0) return null;
            const tierOpen = tier === 1 || tierMissions.some((m) => isUnlocked(m.id, highScores));

            return (
              <div key={tier}>
                {/* Tier header */}
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="text-xs font-extrabold uppercase tracking-widest text-teal-300">
                    {TIER_NAMES[tier]}
                  </span>
                  <div className="flex-1 h-px bg-neutral-800" />
                  <span className="text-[10px] text-neutral-500 font-semibold">
                    {tier === 1
                      ? TIER_HINTS[1]
                      : tierOpen
                        ? `${tierMissions.filter((m) => isCompleted(m.id, highScores)).length}/${tierMissions.length} done`
                        : TIER_HINTS[tier]}
                  </span>
                </div>

                <div className="space-y-3">
                  {tierMissions.map((m) => {
                    const locked = !isUnlocked(m.id, highScores);
                    const done = isCompleted(m.id, highScores);
                    const stars = bestStars(m.id, highScores);

                    return (
                      <div
                        key={m.id}
                        className={`hud-glass p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                          locked
                            ? 'border-neutral-800 opacity-60'
                            : 'border-neutral-800 hover:border-amber-500/50'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {locked && <Lock className="w-3.5 h-3.5 text-neutral-500" />}
                            <span className="text-sm font-extrabold text-neutral-100">
                              {hindiLabels ? m.hindiTitle : m.title}
                            </span>
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              {m.type.replace('_', ' ')}
                            </span>
                            {done && !locked && (
                              <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-400">
                                <CheckCircle className="w-3.5 h-3.5" />
                                Done
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-neutral-400 leading-relaxed">
                            {locked ? TIER_HINTS[tier] : m.description}
                          </p>
                          {stars !== null && !locked && (
                            <div className="flex items-center gap-0.5 mt-1.5" aria-label={`${stars} out of 5 stars`}>
                              {[1, 2, 3, 4, 5].map((i) => (
                                <Star
                                  key={i}
                                  className={`w-3.5 h-3.5 ${i <= stars ? 'text-amber-400 fill-amber-400' : 'text-neutral-700'}`}
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Time & Reward */}
                        <div className="flex items-center gap-5 shrink-0">
                          <div className="flex items-center gap-1.5 text-xs text-neutral-300 font-bold">
                            <Timer className="w-4 h-4 text-teal-400" />
                            <span>{m.timeLimitSec}s</span>
                          </div>

                          <div className="hud-glass-saffron px-3 py-1.5 rounded-xl border border-amber-500/40 flex items-center gap-1.5 text-amber-300 font-gauge font-bold text-lg">
                            <IndianRupee className="w-4 h-4 text-amber-400" />
                            <span>{m.rewardCash.toLocaleString('en-IN')}</span>
                          </div>

                          {!locked ? (
                            <button
                              onClick={() => onSelectMission(m.id)}
                              className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-neutral-950 font-extrabold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-all"
                            >
                              START
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          ) : (
                            <div className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-500 font-extrabold text-xs flex items-center gap-1.5 cursor-not-allowed">
                              <Lock className="w-4 h-4" />
                              LOCKED
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
