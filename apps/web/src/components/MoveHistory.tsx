import { Check, Copy, Download } from "lucide-react";
import React, { useEffect, useRef } from "react";
import { useGameStore } from "../store/gameStore";

export const MoveHistory: React.FC = () => {
  const { moves, gameId } = useGameStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);

  // Auto-scroll to bottom on new moves
  useEffect(() => {
    if (scrollRef.current && moves) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [moves]);

  // Group moves into pairs (White, Black)
  const movePairs: { num: number; white: string; black?: string }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({
      num: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
    });
  }

  const handleCopyPgn = () => {
    let pgn = "";
    for (const pair of movePairs) {
      pgn += `${pair.num}. ${pair.white} ${pair.black || ""} `;
    }
    navigator.clipboard.writeText(pgn.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex h-full flex-col rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Move Notation
          </span>
          <span className="rounded-md bg-neutral-800 px-1.5 py-0.5 text-[10px] font-mono font-medium text-neutral-300">
            {moves.length} moves
          </span>
        </div>

        <button
          type="button"
          onClick={handleCopyPgn}
          title="Copy PGN moves"
          className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1 text-[11px] text-neutral-400 hover:text-white transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>PGN</span>
            </>
          )}
        </button>
      </div>

      {/* Move List */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto py-2 pr-1 font-mono text-xs select-none"
      >
        {movePairs.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-xs text-neutral-500 italic">
            Moves will appear here
          </div>
        ) : (
          <div className="space-y-1">
            {movePairs.map((pair) => (
              <div
                key={pair.num}
                className="grid grid-cols-12 rounded px-2 py-1 hover:bg-neutral-800/50 transition-colors"
              >
                <span className="col-span-2 text-neutral-500 font-semibold">{pair.num}.</span>
                <span className="col-span-5 font-medium text-neutral-200">{pair.white}</span>
                <span className="col-span-5 font-medium text-neutral-400">{pair.black || ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
