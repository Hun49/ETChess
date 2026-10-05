import { AlertTriangle, Check, Copy, X } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Chessboard } from "react-chessboard";
import type { LiveGameItem, RecentGameItem } from "../types.js";

interface ChessBoardModalProps {
  game: LiveGameItem | RecentGameItem | null;
  onClose: () => void;
  onTerminateLiveGame?: (gameId: string, reason: string) => Promise<void>;
}

export const ChessBoardModal: React.FC<ChessBoardModalProps> = ({
  game,
  onClose,
  onTerminateLiveGame,
}) => {
  const [copied, setCopied] = useState(false);
  const [isTerminating, setIsTerminating] = useState(false);
  const [terminateReason, setTerminateReason] = useState("");
  const [terminateLoading, setTerminateLoading] = useState(false);

  if (!game) return null;

  const isLive = "plyCount" in game;
  const fen = game.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  const handleCopyFen = () => {
    navigator.clipboard.writeText(fen);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTerminateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminateReason.trim() || !onTerminateLiveGame) return;
    setTerminateLoading(true);
    try {
      await onTerminateLiveGame(game.id, terminateReason);
      onClose();
    } finally {
      setTerminateLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#121c26] border border-[#233549] rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: Board view */}
        <div className="p-6 bg-[#0d1520] flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-[#1e2d3d] shrink-0">
          <div className="w-[320px] aspect-square rounded-xl overflow-hidden shadow-2xl border border-[#233549]">
            <Chessboard
              options={{
                position: fen,
                allowDragging: false,
                boardOrientation: "white",
                darkSquareStyle: { backgroundColor: "#2b3b4c" },
                lightSquareStyle: { backgroundColor: "#8fa3b7" },
              }}
            />
          </div>
        </div>

        {/* Right: Game Info & Admin Actions */}
        <div className="p-6 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  {isLive ? "Live Match" : "Archived Game"}
                </span>
                <h3 className="text-base font-bold text-white mt-1.5">{game.id}</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#1e2d3d] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Players card */}
            <div className="mt-4 p-3 rounded-xl bg-[#0d1520] border border-[#1e2d3d] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-white border border-slate-400" />
                  <span className="font-semibold text-slate-200">{game.whiteName}</span>
                </div>
                <span className="font-mono text-slate-400">
                  {"whiteRating" in game ? `${game.whiteRating}` : "White"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-600" />
                  <span className="font-semibold text-slate-200">{game.blackName}</span>
                </div>
                <span className="font-mono text-slate-400">
                  {"blackRating" in game ? `${game.blackRating}` : "Black"}
                </span>
              </div>
            </div>

            {/* Metadata */}
            <div className="mt-4 space-y-2 text-xs text-slate-300">
              <div className="flex justify-between py-1 border-b border-[#1a2634]">
                <span className="text-slate-500">Time Control</span>
                <span className="font-medium text-slate-200">{game.timeControl}</span>
              </div>
              {isLive && "plyCount" in game && (
                <div className="flex justify-between py-1 border-b border-[#1a2634]">
                  <span className="text-slate-500">Current Ply</span>
                  <span className="font-medium text-slate-200">{game.plyCount}</span>
                </div>
              )}
              {!isLive && "result" in game && (
                <div className="flex justify-between py-1 border-b border-[#1a2634]">
                  <span className="text-slate-500">Result</span>
                  <span className="font-medium text-emerald-400">
                    {game.result} ({game.termination})
                  </span>
                </div>
              )}
            </div>

            {/* FEN display */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span>FEN</span>
                <button
                  type="button"
                  onClick={handleCopyFen}
                  className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Copied" : "Copy FEN"}</span>
                </button>
              </div>
              <p className="font-mono text-[10px] bg-[#0d1520] p-2 rounded-lg border border-[#1e2d3d] text-slate-300 break-all select-all">
                {fen}
              </p>
            </div>
          </div>

          {/* Admin Emergency Actions (For live games) */}
          {isLive && onTerminateLiveGame && (
            <div className="mt-6 pt-4 border-t border-[#1e2d3d]">
              {!isTerminating ? (
                <button
                  type="button"
                  onClick={() => setIsTerminating(true)}
                  className="w-full py-2 px-3 rounded-xl bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Emergency Terminate Game</span>
                </button>
              ) : (
                <form onSubmit={handleTerminateSubmit} className="space-y-2">
                  <p className="text-[11px] text-rose-400 font-semibold">
                    Are you sure? This immediately aborts the game without rating penalties and
                    writes an audit log.
                  </p>
                  <input
                    type="text"
                    required
                    placeholder="Reason for termination (required)..."
                    value={terminateReason}
                    onChange={(e) => setTerminateReason(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#0d1520] border border-[#233549] rounded-lg text-xs text-white placeholder-slate-500 outline-none focus:border-rose-500"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={terminateLoading || !terminateReason.trim()}
                      className="flex-1 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors"
                    >
                      {terminateLoading ? "Terminating..." : "Confirm Abort"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsTerminating(false)}
                      className="px-3 py-1.5 rounded-lg bg-[#1a2634] text-slate-300 text-xs hover:bg-[#233549] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
