import type React from "react";
import { useState } from "react";

interface GrowthPoint {
  date: string;
  users: number;
}

interface PlayerGrowthChartProps {
  growth?: GrowthPoint[];
}

export const PlayerGrowthChart: React.FC<PlayerGrowthChartProps> = ({
  growth = [
    { date: "Sep 19", users: 520 },
    { date: "Sep 20", users: 440 },
    { date: "Sep 21", users: 610 },
    { date: "Sep 22", users: 580 },
    { date: "Sep 23", users: 750 },
    { date: "Sep 24", users: 1100 },
    { date: "Sep 25", users: 1540 },
  ],
}) => {
  const [range, setRange] = useState<"7D" | "30D" | "90D">("7D");

  // Chart coordinates
  const width = 500;
  const height = 180;
  const maxVal = 2000;

  const points = growth.map((pt, idx) => {
    const x = (idx / (growth.length - 1)) * (width - 40) + 20;
    const y = height - (pt.users / maxVal) * (height - 30) - 15;
    return { x, y, pt };
  });

  // Construct smooth cubic bezier path
  let pathD = `M ${points[0]?.x ?? 20} ${points[0]?.y ?? 150}`;
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    if (!current || !next) continue;
    const midX = (current.x + next.x) / 2;
    pathD += ` C ${midX} ${current.y}, ${midX} ${next.y}, ${next.x} ${next.y}`;
  }

  const fillD = `${pathD} L ${points[points.length - 1]?.x ?? width - 20} ${height} L ${points[0]?.x ?? 20} ${height} Z`;

  return (
    <div className="bg-[#121c26] border border-[#1e2d3d] rounded-2xl p-5 flex flex-col justify-between shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight">Player Growth</h3>
          <p className="text-xs text-slate-400 mt-0.5">New registered users</p>
        </div>

        {/* Range Selector */}
        <div className="flex items-center bg-[#0d1520] border border-[#1e2d3d] rounded-lg p-0.5">
          {(["7D", "30D", "90D"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                range === r
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-4 flex">
        {/* Y Axis scale */}
        <div className="flex flex-col justify-between text-[10px] text-slate-500 pr-2 h-[180px] select-none text-right w-8 shrink-0">
          <span>2K</span>
          <span>1.5K</span>
          <span>1K</span>
          <span>500</span>
          <span>0</span>
        </div>

        {/* SVG Curve Chart */}
        <div className="flex-1 relative">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-[180px] overflow-visible"
            role="img"
            aria-label="Player growth chart"
          >
            <title>Player Growth</title>
            <defs>
              <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Subtle horizontal grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
              <line
                key={ratio}
                x1="0"
                y1={height - ratio * (height - 30) - 15}
                x2={width}
                y2={height - ratio * (height - 30) - 15}
                stroke="#1a2634"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
            ))}

            {/* Area Fill */}
            <path d={fillD} fill="url(#growthGradient)" />

            {/* Line Path */}
            <path d={pathD} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />

            {/* Data Dots */}
            {points.map((pt) => (
              <g key={pt.pt.date} className="group cursor-pointer">
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="4"
                  fill="#0b1118"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  className="transition-transform group-hover:scale-125"
                />
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="7"
                  fill="#10b981"
                  className="opacity-0 group-hover:opacity-20 transition-opacity"
                />
              </g>
            ))}
          </svg>

          {/* X Axis Dates */}
          <div className="flex justify-between text-[10px] text-slate-400 mt-2 px-2 select-none">
            {growth.map((g) => (
              <span key={g.date}>{g.date}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
