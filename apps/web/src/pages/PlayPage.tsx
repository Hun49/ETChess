import { TIME_CONTROLS } from "@etchess/types";
import { Bot, ChevronLeft, MessageSquare, Send, Shield, Users, Zap } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { ChessBoardView } from "../components/ChessBoardView";
import { GameControls } from "../components/GameControls";
import { MoveHistory } from "../components/MoveHistory";
import { useGameStore } from "../store/gameStore";

export const PlayPage: React.FC = () => {
  const {
    mode,
    timeControl,
    rated,
    botTier,
    chatMessages,
    sendChatMessage,
    resetToIdle,
    openModal,
  } = useGameStore();

  const [chatInput, setChatInput] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (chatBottomRef.current && chatMessages) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChatMessage(chatInput);
    setChatInput("");
  };

  const tc = TIME_CONTROLS[timeControl];

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3 mb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={resetToIdle}
            className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Lobby</span>
          </button>

          <div className="flex items-center gap-2">
            {mode === "online" && (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                <Zap className="h-3.5 w-3.5" />
                <span>
                  {tc.displayName} ({tc.category})
                </span>
                {rated && <Shield className="h-3 w-3 ml-0.5" />}
              </span>
            )}

            {mode === "bot" && (
              <span className="flex items-center gap-1.5 rounded-full bg-teal-500/10 px-2.5 py-0.5 text-xs font-semibold text-teal-400 border border-teal-500/20">
                <Bot className="h-3.5 w-3.5" />
                <span>vs Bot ({botTier})</span>
              </span>
            )}

            {mode === "pass_and_play" && (
              <span className="flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-400 border border-cyan-500/20">
                <Users className="h-3.5 w-3.5" />
                <span>Pass & Play</span>
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => openModal("play")}
          className="text-xs font-medium text-neutral-400 hover:text-white transition-colors"
        >
          New Game
        </button>
      </div>

      {/* Main Board & Sidebar Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: The Chessboard and Players */}
        <div className="lg:col-span-8 flex justify-center">
          <ChessBoardView />
        </div>

        {/* Right: Sidebar with Moves, Controls, and Chat */}
        <div className="lg:col-span-4 flex flex-col gap-4 h-[640px]">
          {/* Action Controls */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-3">
            <GameControls />
          </div>

          {/* Move History */}
          <div className="flex-1 min-h-0">
            <MoveHistory />
          </div>

          {/* Real-time In-Game Chat (for Online Mode) */}
          {mode === "online" && (
            <div className="flex h-52 flex-col rounded-2xl border border-neutral-800 bg-neutral-900/70 p-3">
              <div className="flex items-center gap-1.5 border-b border-neutral-800 pb-2 text-xs font-bold text-neutral-400 uppercase tracking-wider">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Room Chat</span>
              </div>

              {/* Chat Message List */}
              <div className="flex-1 overflow-y-auto py-2 space-y-1.5 text-xs">
                {chatMessages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-[11px] text-neutral-500 italic">
                    Say hello to your opponent!
                  </div>
                ) : (
                  chatMessages.map((msg) => (
                    <div key={msg.id} className="rounded bg-neutral-950/60 p-1.5">
                      <span className="font-bold text-emerald-400 mr-1.5">{msg.sender}:</span>
                      <span className="text-neutral-200">{msg.text}</span>
                    </div>
                  ))
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendChat} className="mt-1 flex items-center gap-1.5">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type a message..."
                  maxLength={300}
                  className="flex-1 rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="submit"
                  aria-label="Send message"
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition-colors cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
