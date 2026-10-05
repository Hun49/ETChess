import type React from "react";

interface PlatformUsageProps {
  modes?: {
    online: number;
    friend: number;
    computer: number;
    local: number;
  };
}

export const PlatformUsageDonut: React.FC<PlatformUsageProps> = ({
  modes = {
    online: 20772,
    friend: 13852,
    computer: 8148,
    local: 5960,
  },
}) => {
  const total = modes.online + modes.friend + modes.computer + modes.local;

  const data = [
    { label: "Online", count: modes.online, pct: 42.6, color: "#10b981" },
    { label: "Friend", count: modes.friend, pct: 28.4, color: "#f59e0b" },
    { label: "Computer", count: modes.computer, pct: 16.7, color: "#3b82f6" },
    { label: "Local", count: modes.local, pct: 12.3, color: "#ef4444" },
  ];

  // SVG Donut calculation with strokeDasharray & strokeDashoffset
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  let accumulatedAngle = 0;

  return (
    <div className="bg-[#121c26] border border-[#1e2d3d] rounded-2xl p-5 flex flex-col justify-between shadow-sm">
      <div>
        <h3 className="text-sm font-bold text-white tracking-tight">Platform Usage</h3>
        <p className="text-xs text-slate-400 mt-0.5">Game mode distribution (last 7 days)</p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 my-auto pt-4">
        {/* SVG Donut */}
        <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
          <svg
            className="w-full h-full -rotate-90"
            viewBox="0 0 160 160"
            role="img"
            aria-label="Game mode distribution donut chart"
          >
            <title>Game mode distribution</title>
            {data.map((item) => {
              const strokeLength = (item.count / total) * circumference;
              const offset = circumference - accumulatedAngle;
              accumulatedAngle += strokeLength;

              return (
                <circle
                  key={item.label}
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="transparent"
                  stroke={item.color}
                  strokeWidth="20"
                  strokeDasharray={`${strokeLength} ${circumference - strokeLength}`}
                  strokeDashoffset={-accumulatedAngle + strokeLength}
                  className="transition-all duration-500 ease-out hover:opacity-85"
                />
              );
            })}
          </svg>

          {/* Donut Center */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-xl font-bold text-white tracking-tight">
              {total.toLocaleString()}
            </span>
            <span className="text-[11px] font-medium text-slate-400">Total Games</span>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-3.5 w-full max-w-[210px]">
          {data.map((item) => (
            <div key={item.label} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="font-medium text-slate-200">{item.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-slate-400 font-medium">{item.pct}%</span>
                <span className="text-slate-200 font-semibold">{item.count.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
