import React from 'react';
import { IndianRupee, Timer, CheckCircle, Award, ArrowRight, X } from 'lucide-react';
import { MISSION_LIST } from '../game/missions/MissionManager';

interface MissionSelectModalProps {
  onSelectMission: (missionId: string) => void;
  onClose: () => void;
  hindiLabels?: boolean;
}

export const MissionSelectModal: React.FC<MissionSelectModalProps> = ({
  onSelectMission,
  onClose,
  hindiLabels = false,
}) => {
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

        {/* Mission Cards Grid */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
          {MISSION_LIST.map((m) => (
            <div
              key={m.id}
              className="hud-glass p-4 rounded-2xl border border-neutral-800 hover:border-amber-500/50 transition-all flex items-center justify-between gap-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-extrabold text-neutral-100">
                    {hindiLabels ? m.hindiTitle : m.title}
                  </span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {m.type.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">{m.description}</p>
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

                <button
                  onClick={() => onSelectMission(m.id)}
                  className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-neutral-950 font-extrabold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-all"
                >
                  START
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
