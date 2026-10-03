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
import { useMemo, useState } from "react";
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

const MOCK_HISTORY: HistoricalGame[] = [
  {
    id: "g1",
    type: "blitz",
    timeControl: "3+2",
    opponent: { name: "GrandmasterBot", rating: 1850 },
    playerColor: "white",
    result: "win",
    ratingDelta: +18,
    termination: "by Checkmate",
    opening: "Ruy Lopez: Morphy Defense",
    movesCount: 28,
    duration: "4m 12s",
    date: "10 minutes ago",
    category: "computer",
  },
  {
    id: "g2",
    type: "rapid",
    timeControl: "10+0",
    opponent: { name: "Elena_V", rating: 1580 },
    playerColor: "black",
    result: "win",
    ratingDelta: +14,
    termination: "by Resignation",
    opening: "Sicilian Defense: Najdorf",
    movesCount: 36,
    duration: "14m 20s",
    date: "2 hours ago",
    category: "online",
  },
  {
    id: "g3",
    type: "blitz",
    timeControl: "5+0",
    opponent: { name: "ViktorChess", rating: 1620 },
    playerColor: "white",
    result: "loss",
    ratingDelta: -12,
    termination: "by Timeout",
    opening: "Queen's Gambit Declined",
    movesCount: 42,
    duration: "9m 50s",
    date: "Yesterday",
    category: "online",
  },
  {
    id: "g4",
    type: "bullet",
    timeControl: "1+0",
    opponent: { name: "FlashTactics", rating: 1490 },
    playerColor: "black",
    result: "win",
    ratingDelta: +16,
    termination: "by Checkmate",
    opening: "King's Indian Attack",
    movesCount: 22,
    duration: "1m 45s",
    date: "Yesterday",
    category: "online",
  },
  {
    id: "g5",
    type: "rapid",
    timeControl: "10+5",
    opponent: { name: "David_Friend", rating: 1530 },
    playerColor: "white",
    result: "draw",
    ratingDelta: 0,
    termination: "by Repetition",
    opening: "Caro-Kann: Classical Variation",
    movesCount: 48,
    duration: "18m 10s",
    date: "3 days ago",
    category: "friend",
  },
  {
    id: "g6",
    type: "blitz",
    timeControl: "3+0",
    opponent: { name: "DarkKnight99", rating: 1555 },
    playerColor: "black",
    result: "loss",
    ratingDelta: -11,
    termination: "by Checkmate",
    opening: "French Defense: Winawer",
    movesCount: 31,
    duration: "5m 12s",
    date: "4 days ago",
    category: "online",
  },
];

export const GameHistoryView: React.FC = () => {
  const { setActiveView } = useGameStore();
  const [filter, setFilter] = useState<"all" | "online" | "friend" | "computer">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredGames = useMemo(() => {
    return MOCK_HISTORY.filter((game) => {
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
  }, [filter, searchQuery]);

  const handleCopyPgn = (gameId: string) => {
    navigator.clipboard.writeText(
      `[Event "ET Chess Online Game"]\n[Site "ET Chess"]\n[Result "1-0"]\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7`,
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
              <span className="font-bold text-white">4 Wins</span>
              <span className="text-[#5d7378]">•</span>
              <span className="text-red-400 font-bold">2 Losses</span>
              <span className="text-[#5d7378]">•</span>
              <span className="text-neutral-400 font-bold">1 Draw</span>
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
