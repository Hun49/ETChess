import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Flame,
  Search,
  Sparkles,
  Swords,
  Trophy,
  User,
  XCircle,
  Zap,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { api, useSession } from "../lib/api";
import { useGameStore } from "../store/gameStore";

interface HistoricalGame {
  id: string;
  type: "blitz" | "rapid" | "bullet";
  timeControl: string;
  opponent: {
    name: string;
    rating: number;
    avatar?: string;
  };
  playerColor: "white" | "black";
  result: "win" | "loss" | "draw";
  ratingDelta: number;
  termination: string;
  opening: string;
  movesCount: number;
  duration: string;
  date: string;
  category: "online" | "friend" | "computer";
}

interface ApiGameItem {
  id: string;
  whitePlayerId: string | null;
  blackPlayerId: string | null;
  whitePlayer?: { name: string } | null;
  blackPlayer?: { name: string } | null;
  result: string | null;
  category?: string | null;
  timeControl: string;
  terminationReason?: string | null;
  moves?: unknown;
  startedAt?: string | null;
}

export const GameHistoryView: React.FC = () => {
  const { setActiveView, isGuest } = useGameStore();
  const { data: session } = useSession();
  const [filter, setFilter] = useState<"all" | "online" | "friend" | "computer">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [games, setGames] = useState<HistoricalGame[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) {
      setGames([]);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const loadGames = async () => {
      try {
        const res = await api.api.games.$get({
          query: { userId: session.user.id, limit: "50" },
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data?.games) {
            const mapped: HistoricalGame[] = (data.games as unknown as ApiGameItem[]).map((g) => {
              const isWhite = g.whitePlayerId === session.user.id;
              const oppName = isWhite
                ? g.blackPlayer?.name || "Opponent"
                : g.whitePlayer?.name || "Opponent";
              const isWin = (g.result === "1-0" && isWhite) || (g.result === "0-1" && !isWhite);
              const isDraw = g.result === "1/2-1/2";
              const result = isWin ? "win" : isDraw ? "draw" : "loss";
              const gameType: HistoricalGame["type"] =
                g.category === "bullet" || g.category === "rapid" ? g.category : "blitz";

              return {
                id: g.id,
                type: gameType,
                timeControl: g.timeControl || "3+2",
                opponent: { name: oppName, rating: 1000 },
                playerColor: isWhite ? "white" : "black",
                result,
                ratingDelta: 0,
                termination: g.terminationReason ? `by ${g.terminationReason}` : "Completed",
                opening: "Standard Chess",
                movesCount: Array.isArray(g.moves) ? g.moves.length : 0,
                duration: "Active",
                date: g.startedAt ? new Date(g.startedAt).toLocaleDateString() : "Recent",
                category: "online",
              };
            });
            setGames(mapped);
          }
        }
      } catch (err) {
        console.error("Failed to load match history:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadGames();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.id]);

  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      if (filter !== "all" && game.category !== filter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          game.opponent.name.toLowerCase().includes(query) ||
          game.opening.toLowerCase().includes(query) ||
          game.timeControl.includes(query)
        );
      }
      return true;
    });
  }, [games, filter, searchQuery]);

  const winCount = games.filter((g) => g.result === "win").length;
  const lossCount = games.filter((g) => g.result === "loss").length;
  const drawCount = games.filter((g) => g.result === "draw").length;

  const handleCopyPgn = (gameId: string) => {
    navigator.clipboard.writeText(
      `[Event "ET Chess Match"]\n[Site "ET Chess"]\n[Result "*"]\n1. e4 e5 2. Nf3 Nc6`,
    );
    setCopiedId(gameId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-[#081214] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#14282c] pb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveView("home")}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#14282c] bg-[#0b171a] text-neutral-300 hover:border-[#00e699] hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">Match History</h1>
              <p className="text-xs text-[#8ba3a8]">
                Review and analyze your past matches and performance trends
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-xl border border-[#14282c] bg-[#0b171a] px-3 py-1.5 text-xs text-[#8ba3a8]">
              <Trophy className="h-3.5 w-3.5 text-[#00e699]" />
              <span className="font-bold text-white">{winCount} Wins</span>
              <span className="text-[#5d7378]">•</span>
              <span className="text-red-400 font-bold">{lossCount} Losses</span>
              <span className="text-[#5d7378]">•</span>
              <span className="text-neutral-400 font-bold">{drawCount} Draws</span>
            </div>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex w-full sm:w-auto rounded-xl border border-[#14282c] bg-[#0b171a] p-1 gap-1">
            {(
              [
                { id: "all", label: "All Matches" },
                { id: "online", label: "Online" },
                { id: "friend", label: "vs Friend" },
                { id: "computer", label: "vs Computer" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`flex-1 sm:flex-none rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  filter === tab.id
                    ? "bg-[#0e1e22] text-[#00e699] border border-[#162e33]"
                    : "text-[#8ba3a8] hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#5d7378]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search opponent or opening..."
              className="w-full rounded-xl border border-[#14282c] bg-[#0b171a] pl-9 pr-3 py-1.5 text-xs text-white placeholder-[#5d7378] focus:border-[#00e699] focus:outline-none"
            />
          </div>
        </div>

        {/* Game List */}
        <div className="space-y-3">
          {filteredGames.length === 0 ? (
            <div className="flex h-56 flex-col items-center justify-center rounded-2xl border border-[#14282c] bg-[#0b171a] p-8 text-center">
              <Swords className="h-10 w-10 text-[#162e33] mb-3" />
              <h3 className="text-sm font-bold text-white">No games found</h3>
              <p className="text-xs text-[#8ba3a8] mt-1">Try switching filters or search terms</p>
            </div>
          ) : (
            filteredGames.map((game) => (
              <div
                key={game.id}
                className="group flex flex-col md:flex-row items-start md:items-center justify-between gap-4 rounded-2xl border border-[#14282c] bg-[#0b171a] p-4 transition-all hover:border-[#00e699]/30 hover:bg-[#0c191c]"
              >
                {/* Left: Result pill & Opponent info */}
                <div className="flex items-center gap-4">
                  {/* Outcome pill */}
                  <div
                    className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl font-bold ${
                      game.result === "win"
                        ? "bg-[#00e699]/15 text-[#00e699] border border-[#00e699]/30"
                        : game.result === "loss"
                          ? "bg-red-500/15 text-red-400 border border-red-500/30"
                          : "bg-neutral-800 text-neutral-300 border border-neutral-700"
                    }`}
                  >
                    <span className="text-xs font-black uppercase">{game.result}</span>
                    <span className="text-[10px] font-mono">
                      {game.ratingDelta > 0
                        ? `+${game.ratingDelta}`
                        : game.ratingDelta < 0
                          ? game.ratingDelta
                          : "0"}
                    </span>
                  </div>

                  {/* Opponent & Opening */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{game.opponent.name}</span>
                      <span className="rounded bg-[#0e1e22] px-1.5 py-0.5 text-[10px] font-mono text-[#8ba3a8]">
                        {game.opponent.rating}
                      </span>
                      <span className="text-[11px] text-[#5d7378]">
                        ({game.playerColor === "white" ? "You were White" : "You were Black"})
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[#8ba3a8]">
                      <span className="font-medium text-neutral-300">{game.opening}</span>
                      <span>•</span>
                      <span className="text-[#5d7378]">{game.termination}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Meta & Actions */}
                <div className="flex w-full md:w-auto items-center justify-between md:justify-end gap-3 border-t md:border-t-0 border-[#14282c] pt-2 md:pt-0">
                  <div className="text-right text-xs">
                    <div className="flex items-center gap-1.5 text-neutral-300 font-mono">
                      <Clock className="h-3 w-3 text-[#5d7378]" />
                      <span>{game.timeControl}</span>
                      <span className="text-[#5d7378]">•</span>
                      <span>{game.movesCount} moves</span>
                    </div>
                    <span className="text-[10px] text-[#5d7378]">{game.date}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyPgn(game.id)}
                      title="Copy PGN"
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#162e33] bg-[#0e1e22] text-[#8ba3a8] hover:text-white transition-colors"
                    >
                      {copiedId === game.id ? (
                        <Check className="h-4 w-4 text-[#00e699]" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveView("analysis")}
                      className="flex items-center gap-1.5 rounded-xl border border-[#00e699]/30 bg-[#00e699]/10 px-3 py-2 text-xs font-bold text-[#00e699] hover:bg-[#00e699] hover:text-[#081214] transition-all"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Analyze</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
