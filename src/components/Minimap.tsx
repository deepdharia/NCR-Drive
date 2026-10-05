import React, { useMemo } from 'react';
import { ROAD_WAYPOINTS, ROAD_SEGMENTS, POINTS_OF_INTEREST } from '../game/world/MapData';

interface MinimapProps {
  playerX: number;
  playerZ: number;
  playerHeading: number;
  targetX?: number;
  targetZ?: number;
  hasTarget: boolean;
}

// Short labels for the landmarks worth showing on a 130px radar.
const POI_SHORT_LABELS: Record<string, string> = {
  india_gate: 'India Gate',
  connaught_place: 'CP',
  igi_airport: 'Airport',
  toll_plaza: 'Toll',
  cyber_hub: 'Cyber Hub',
  murthal_dhaba: 'Dhaba',
};

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

  // Transform coordinates to radar view centered on player.
  // +X world -> screen right, +Z world -> screen down (north-up: Delhi at top).
  const transform = (wx: number, wz: number) => {
    const dx = wx - playerX;
    const dz = wz - playerZ;
    const cx = mapSize / 2 + dx * zoom;
    const cy = mapSize / 2 + dz * zoom;
    return { x: cx, y: cy };
  };

  const inBounds = (x: number, y: number, margin = 10) =>
    x > -margin && x < mapSize + margin && y > -margin && y < mapSize + margin;

  const waypointDots = useMemo(() => {
    return ROAD_WAYPOINTS.map((wp, i) => {
      return { id: i, wx: wp.x, wz: wp.z };
    });
  }, []);

  const segmentLines = useMemo(() => {
    return ROAD_SEGMENTS.map((seg, i) => ({
      id: i,
      x1: seg.start.x,
      z1: seg.start.z,
      x2: seg.end.x,
      z2: seg.end.z,
    }));
  }, []);

  const poiMarkers = useMemo(() => {
    return POINTS_OF_INTEREST.filter((poi) => POI_SHORT_LABELS[poi.id]).map((poi) => ({
      id: poi.id,
      label: POI_SHORT_LABELS[poi.id],
      wx: poi.position[0],
      wz: poi.position[2],
    }));
  }, []);

  const targetScreenPos = hasTarget && targetX !== undefined && targetZ !== undefined
    ? transform(targetX, targetZ)
    : null;

  // Player heading is physics yaw in radians (0 = facing +Z = screen down).
  // CSS rotate() turns clockwise; the arrow glyph points up at rest, so the
  // correct screen rotation is (PI - heading).
  const arrowRotationRad = Math.PI - playerHeading;

  return (
    <div className="relative w-[130px] h-[130px] rounded-2xl overflow-hidden hud-glass shadow-2xl border border-amber-500/30">
      {/* Background compass rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
        <div className="w-[100px] h-[100px] rounded-full border border-teal-400" />
        <div className="absolute w-[60px] h-[60px] rounded-full border border-teal-400" />
        <div className="absolute w-full h-[1px] bg-teal-400" />
        <div className="absolute h-full w-[1px] bg-teal-400" />
      </div>

      {/* SVG roads, POIs, target */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {/* Road network polylines */}
        {segmentLines.map((seg) => {
          const a = transform(seg.x1, seg.z1);
          const b = transform(seg.x2, seg.z2);
          if (!inBounds(a.x, a.y) && !inBounds(b.x, b.y)) return null;
          return (
            <line
              key={seg.id}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#64748b"
              strokeWidth={3}
              strokeLinecap="round"
              opacity={0.85}
            />
          );
        })}

        {/* Road nodes */}
        {waypointDots.map((pt) => {
          const sp = transform(pt.wx, pt.wz);
          if (!inBounds(sp.x, sp.y)) return null;
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

        {/* POI markers with tiny labels */}
        {poiMarkers.map((poi) => {
          const sp = transform(poi.wx, poi.wz);
          if (!inBounds(sp.x, sp.y, 20)) return null;
          return (
            <g key={poi.id}>
              <circle cx={sp.x} cy={sp.y} r={3} fill="#f59e0b" opacity={0.9} />
              <text
                x={sp.x}
                y={sp.y - 6}
                textAnchor="middle"
                fontSize={7}
                fontWeight={700}
                fill="#fcd34d"
                opacity={0.95}
              >
                {poi.label}
              </text>
            </g>
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
          transform: `translate(-50%, -50%) rotate(${arrowRotationRad}rad)`,
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
