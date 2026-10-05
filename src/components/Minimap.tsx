import React, { useMemo } from 'react';
import { ROAD_WAYPOINTS } from '../game/world/MapData';

interface MinimapProps {
  playerX: number;
  playerZ: number;
  playerHeading: number;
  targetX?: number;
  targetZ?: number;
  hasTarget: boolean;
}

export const Minimap: React.FC<MinimapProps> = ({
  playerX,
  playerZ,
  playerHeading,
  targetX,
  targetZ,
  hasTarget,
}) => {
  const mapSize = 130;
  const zoom = 0.08; // scale factor (pixels per meter)

  // Transform coordinates to radar view centered on player
  const transform = (wx: number, wz: number) => {
    const dx = wx - playerX;
    const dz = wz - playerZ;
    // Map coords: center at mapSize/2
    const cx = mapSize / 2 + dx * zoom;
    const cy = mapSize / 2 + dz * zoom;
    return { x: cx, y: cy };
  };

  const waypointDots = useMemo(() => {
    return ROAD_WAYPOINTS.map((wp, i) => {
      return { id: i, wx: wp.x, wz: wp.z };
    });
  }, []);

  const targetScreenPos = hasTarget && targetX !== undefined && targetZ !== undefined
    ? transform(targetX, targetZ)
    : null;

  return (
    <div className="relative w-[130px] h-[130px] rounded-2xl overflow-hidden hud-glass shadow-2xl border border-amber-500/30">
      {/* Background compass rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
        <div className="w-[100px] h-[100px] rounded-full border border-teal-400" />
        <div className="absolute w-[60px] h-[60px] rounded-full border border-teal-400" />
        <div className="absolute w-full h-[1px] bg-teal-400" />
        <div className="absolute h-full w-[1px] bg-teal-400" />
      </div>

      {/* SVG Road points */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {/* Road nodes */}
        {waypointDots.map((pt) => {
          const sp = transform(pt.wx, pt.wz);
          if (sp.x < -10 || sp.x > mapSize + 10 || sp.y < -10 || sp.y > mapSize + 10) return null;
          return (
            <circle
              key={pt.id}
              cx={sp.x}
              cy={sp.y}
              r={2.2}
              fill="#94a3b8"
              opacity={0.7}
            />
          );
        })}

        {/* Destination target marker */}
        {targetScreenPos && (
          <g transform={`translate(${Math.max(8, Math.min(mapSize - 8, targetScreenPos.x))}, ${Math.max(8, Math.min(mapSize - 8, targetScreenPos.y))})`}>
            <circle r={6} fill="#f59e0b" className="animate-ping" opacity={0.6} />
            <circle r={4.5} fill="#f59e0b" />
            <path d="M-3 -3 L3 -3 L0 4 Z" fill="#090a0f" />
          </g>
        )}
      </svg>

      {/* Center player indicator arrow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none z-10"
        style={{
          transform: `translate(-50%, -50%) rotate(${playerHeading}rad)`,
        }}
      >
        <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[14px] border-b-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
      </div>

      {/* Zone label watermark */}
      <div className="absolute bottom-1 right-2 text-[9px] font-display font-semibold tracking-wider text-amber-400/80 uppercase">
        NCR GPS
      </div>
    </div>
  );
};
