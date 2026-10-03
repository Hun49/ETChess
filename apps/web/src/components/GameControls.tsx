import { AlertTriangle, Check, Flag, Handshake, Plus, RotateCcw, Sparkles, X } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useGameStore } from "../store/gameStore";

export const GameControls: React.FC = () => {
  const {
    status,
    mode,
    playerColor,
    drawOfferedBy,
    rematchOfferedBy,
    disconnectGraceMs,
    whiteConnected,
    blackConnected,
    resign,
    offerDraw,
    respondDraw,
    requestRematch,
    respondRematch,
    flipBoard,
    openModal,
  } = useGameStore();

  const [confirmResign, setConfirmResign] = useState(false);

  const opponentColor = playerColor === "white" ? "black" : "white";
  const opponentConnected = opponentColor === "white" ? whiteConnected : blackConnected;
  const isIncomingDraw = drawOfferedBy !== null && drawOfferedBy !== playerColor;
  const isIncomingRematch = rematchOfferedBy !== null && rematchOfferedBy !== playerColor;

  return (
    <div className="space-y-3">
      {/* Disconnect Alert Banner (60s forfeit timer) */}
      {!opponentConnected && status === "active" && mode === "online" && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 animate-pulse">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <span className="font-bold">Opponent Disconnected.</span>
            <p className="text-[11px] text-amber-300/80">
              They have 60 seconds to reconnect before forfeiting.
            </p>
          </div>
        </div>
      )}

      {/* Incoming Draw Offer Banner */}
      {isIncomingDraw && status === "active" && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3">
          <div className="flex items-center gap-2">
            <Handshake className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-semibold text-white">Draw Offered by Opponent</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => respondDraw(true)}
              className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
            >
              <Check className="h-3.5 w-3.5" />
              Accept
            </button>
            <button
              type="button"
              onClick={() => respondDraw(false)}
              className="flex items-center gap-1 rounded-lg bg-neutral-800 px-2.5 py-1 text-xs font-semibold text-neutral-300 hover:bg-neutral-700 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Decline
            </button>
          </div>
        </div>
      )}

      {/* Incoming Rematch Banner */}
      {isIncomingRematch && status === "ended" && (
        <div className="flex items-center justify-between rounded-xl border border-teal-500/30 bg-teal-950/40 p-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-teal-400" />
            <span className="text-xs font-semibold text-white">Opponent offered a Rematch!</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => respondRematch(true)}
              className="flex items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-teal-500 transition-colors"
            >
              <Check className="h-3.5 w-3.5" />
              Accept
            </button>
            <button
              type="button"
              onClick={() => respondRematch(false)}
              className="flex items-center gap-1 rounded-lg bg-neutral-800 px-2.5 py-1 text-xs font-semibold text-neutral-300 hover:bg-neutral-700 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Decline
            </button>
          </div>
        </div>
      )}

      {/* Main Buttons Grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {status === "active" ? (
          <>
            {/* Draw Offer Button */}
            <button
              type="button"
              onClick={offerDraw}
              disabled={drawOfferedBy === playerColor}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 py-2.5 text-xs font-semibold text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors disabled:opacity-50"
            >
              <Handshake className="h-3.5 w-3.5" />
              <span>{drawOfferedBy === playerColor ? "Draw Offered" : "Offer Draw"}</span>
            </button>

            {/* Resign Button */}
            {confirmResign ? (
              <div className="col-span-1 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    resign();
                    setConfirmResign(false);
                  }}
                  className="flex-1 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white hover:bg-red-500 transition-colors"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResign(false)}
                  className="rounded-xl bg-neutral-800 px-2.5 py-2.5 text-xs text-neutral-400 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmResign(true)}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Flag className="h-3.5 w-3.5" />
                <span>Resign</span>
              </button>
            )}
          </>
        ) : (
          <>
            {/* Rematch Button */}
            <button
              type="button"
              onClick={requestRematch}
              disabled={rematchOfferedBy === playerColor}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{rematchOfferedBy === playerColor ? "Rematch Sent" : "Rematch"}</span>
            </button>

            {/* New Game Button */}
            <button
              type="button"
              onClick={() => openModal("play")}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-700 bg-neutral-800 py-2.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-700 hover:text-white transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Game</span>
            </button>
          </>
        )}

        {/* Flip Board Button */}
        <button
          type="button"
          onClick={flipBoard}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 py-2.5 text-xs font-semibold text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Flip</span>
        </button>
      </div>
    </div>
  );
};
