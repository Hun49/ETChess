import {
  AlertCircle,
  ArrowLeft,
  Award,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Edit3,
  Flame,
  Globe,
  Loader2,
  Mail,
  Medal,
  Settings,
  Shield,
  Sparkles,
  Swords,
  Target,
  TrendingUp,
  Trophy,
  UserCheck,
  Zap,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { authClient, useSession } from "../lib/api";
import { useGameStore } from "../store/gameStore";

export const ProfileView: React.FC = () => {
  const { setActiveView } = useGameStore();
  const { data: session } = useSession();
  const [timeframe, setTimeframe] = useState<"30d" | "3m" | "1y" | "all">("30d");

  const userName = session?.user?.name || "AlexRook";
  const userEmail = session?.user?.email;
  const isEmailVerified = !!session?.user?.emailVerified;

  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSuccess, setOtpSuccess] = useState<string | null>(null);

  const handleSendOtp = async () => {
    if (!userEmail) return;
    setOtpError(null);
    setOtpSuccess(null);
    setOtpLoading(true);
    try {
      const res = await authClient.emailOtp.sendVerificationOtp({
        email: userEmail,
        type: "email-verification",
      });
      if (res.error) {
        setOtpError(res.error.message || "Failed to send code. Please try again.");
      } else {
        setOtpSent(true);
        setOtpSuccess(`Verification code sent to ${userEmail}! Check your inbox.`);
      }
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : "Failed to send verification OTP");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail || !otpCode.trim()) return;
    setOtpError(null);
    setOtpLoading(true);
    try {
      const res = await authClient.emailOtp.verifyEmail({
        email: userEmail,
        otp: otpCode.trim(),
      });
      if (res.error) {
        setOtpError(res.error.message || "Invalid or expired verification code.");
      } else {
        setOtpSuccess("Email verified successfully! You now have the Verified Player badge.");
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      }
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setOtpLoading(false);
    }
  };

  // Chart coordinate points for SVG line chart
  const chartData = [
    { label: "Sep 1", rating: 1480 },
    { label: "Sep 7", rating: 1495 },
    { label: "Sep 14", rating: 1512 },
    { label: "Sep 21", rating: 1528 },
    { label: "Sep 28", rating: 1515 },
    { label: "Oct 3", rating: 1542 },
  ];

  const minRating = 1450;
  const maxRating = 1580;

  // Build SVG path
  const svgWidth = 600;
  const svgHeight = 160;
  const points = chartData.map((d, index) => {
    const x = (index / (chartData.length - 1)) * (svgWidth - 40) + 20;
    const y =
      svgHeight - 20 - ((d.rating - minRating) / (maxRating - minRating)) * (svgHeight - 40);
    return { x, y, ...d };
  });

  const pathD = points.reduce((acc, curr, index) => {
    return index === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
  }, "");

  const areaD = `${pathD} L ${points[points.length - 1].x} ${svgHeight - 10} L ${points[0].x} ${svgHeight - 10} Z`;

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-[#081214] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        {/* Header Navigation */}
        <div className="flex items-center justify-between border-b border-[#14282c] pb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveView("home")}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#14282c] bg-[#0b171a] text-neutral-300 hover:border-[#00e699] hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">Player Profile</h1>
              <p className="text-xs text-[#8ba3a8]">
                Lifetime chess ratings, statistics, and milestones
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveView("settings")}
            className="flex items-center gap-1.5 rounded-xl border border-[#14282c] bg-[#0b171a] px-3 py-2 text-xs font-semibold text-neutral-300 hover:text-white transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Settings</span>
          </button>
        </div>

        {/* Profile Identity Card */}
        <div className="relative overflow-hidden rounded-3xl border border-[#14282c] bg-[#0b171a] p-6 shadow-xl">
          <div className="absolute right-0 top-0 h-64 w-64 translate-x-12 -translate-y-12 rounded-full bg-[#00e699]/5 blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Avatar with online dot */}
            {/* Avatar with online dot */}
            <div className="relative">
              {session?.user?.image ? (
                <img
                  src={session.user.image}
                  alt={userName}
                  className="h-20 w-20 rounded-2xl object-cover border-2 border-[#00e699]/40 shadow-lg shadow-[#00e699]/10"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00e699]/30 to-[#0e1e22] border-2 border-[#00e699]/40 text-2xl font-black text-[#00e699] shadow-lg shadow-[#00e699]/10">
                  {userName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full border-2 border-[#0b171a] bg-[#00e699]" />
            </div>

            {/* Info details */}
            <div className="flex-1 text-center sm:text-left space-y-1.5">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="text-2xl font-black text-white">{userName}</h2>
                {isEmailVerified ? (
                  <VerifiedBadge size="md" showLabel />
                ) : (
                  <span className="rounded-md border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-400">
                    Unverified
                  </span>
                )}
                <span className="rounded-md border border-[#00e699]/30 bg-[#00e699]/15 px-2 py-0.5 text-[11px] font-bold text-[#00e699]">
                  PRO
                </span>
              </div>
              <p className="text-xs font-mono text-[#8ba3a8]">
                {userEmail || `@${userName.toLowerCase().replace(/\s+/g, "")}`} • Member since Jan
                2024
              </p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-1 text-xs text-[#8ba3a8]">
                <div className="flex items-center gap-1">
                  <Flame className="h-3.5 w-3.5 text-orange-400" />
                  <span className="font-bold text-white">4 Game Streak</span>
                </div>
                <div className="flex items-center gap-1">
                  <Trophy className="h-3.5 w-3.5 text-[#00e699]" />
                  <span className="font-bold text-white">Top 12% Global</span>
                </div>
                <div className="flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5 text-blue-400" />
                  <span>North America</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveView("settings")}
                className="flex items-center gap-1.5 rounded-xl border border-[#162e33] bg-[#0e1e22] px-3.5 py-2 text-xs font-bold text-neutral-200 hover:border-[#00e699] hover:text-white transition-colors"
              >
                <Edit3 className="h-3.5 w-3.5 text-[#00e699]" />
                <span>Edit Profile</span>
              </button>
            </div>
          </div>
        </div>

        {/* Progressive Verification Card (only shown when unverified user is logged in) */}
        {!isEmailVerified && userEmail && (
          <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-[#0b171a] to-[#0b171a] p-6 shadow-xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 mt-0.5">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">
                      Claim Your Verified Player Badge
                    </h3>
                    <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                      Unverified
                    </span>
                  </div>
                  <p className="text-xs text-[#8ba3a8] mt-1 max-w-xl">
                    Verify your email to earn the mint checkmark badge, qualify for global rating
                    leaderboards, and enter official tournaments.
                  </p>
                </div>
              </div>

              {!otpSent ? (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={otpLoading}
                  className="shrink-0 flex items-center gap-2 rounded-xl bg-[#00e699] px-4 py-2.5 text-xs font-black text-[#081214] shadow-md shadow-[#00e699]/20 hover:bg-[#00c885] transition-all disabled:opacity-50 cursor-pointer"
                >
                  {otpLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  <span>Send Verification Code</span>
                </button>
              ) : null}
            </div>

            {/* OTP Input Form */}
            {otpSent && (
              <form
                onSubmit={handleVerifyOtp}
                className="mt-4 pt-4 border-t border-[#14282c] flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
              >
                <div className="flex-1 max-w-xs">
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="Enter 6-digit code"
                    className="w-full tracking-widest text-center font-mono text-base font-bold rounded-xl border border-[#162e33] bg-[#0e1e22] px-4 py-2 text-white placeholder-[#587277] focus:border-[#00e699] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={otpLoading || otpCode.length < 6}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#00e699] px-5 py-2.5 text-xs font-black text-[#081214] hover:bg-[#00c885] disabled:opacity-40 transition-all cursor-pointer"
                >
                  {otpLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  <span>Verify Code</span>
                </button>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={otpLoading}
                  className="rounded-xl border border-[#162e33] bg-[#0e1e22] px-3.5 py-2 text-xs font-semibold text-[#8ba3a8] hover:text-white cursor-pointer"
                >
                  Resend Code
                </button>
              </form>
            )}

            {/* Error / Success Feedback */}
            {otpError && (
              <div className="mt-3 flex items-center gap-2 text-xs text-red-400">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{otpError}</span>
              </div>
            )}
            {otpSuccess && (
              <div className="mt-3 flex items-center gap-2 text-xs text-[#00e699]">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>{otpSuccess}</span>
              </div>
            )}
          </div>
        )}

        {/* Rating Category Cards (Bullet, Blitz, Rapid) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Bullet Card */}
          <div className="rounded-2xl border border-[#14282c] bg-[#0b171a] p-5 hover:border-[#00e699]/30 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400">
                  <Zap className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Bullet
                </span>
              </div>
              <span className="text-xs text-[#8ba3a8]">1+0, 2+0</span>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-black text-white">1420</span>
              <span className="text-xs font-bold text-[#00e699]">+24 this month</span>
            </div>
            <div className="text-[11px] text-[#8ba3a8]">
              128 games played • <span className="font-bold text-white">54%</span> win rate
            </div>
          </div>

          {/* Blitz Card */}
          <div className="rounded-2xl border border-[#00e699]/30 bg-[#0b171a] p-5 shadow-lg shadow-[#00e699]/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-[#00e699] text-[#081214] text-[9px] font-black uppercase px-2 py-0.5 rounded-bl-lg">
              Primary
            </div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00e699]/15 text-[#00e699]">
                  <Flame className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-white uppercase tracking-wider">Blitz</span>
              </div>
              <span className="text-xs text-[#8ba3a8]">3+0, 3+2, 5+3</span>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-black text-[#00e699]">1542</span>
              <span className="text-xs font-bold text-[#00e699]">+38 this month</span>
            </div>
            <div className="text-[11px] text-[#8ba3a8]">
              412 games played • <span className="font-bold text-white">58%</span> win rate
            </div>
          </div>

          {/* Rapid Card */}
          <div className="rounded-2xl border border-[#14282c] bg-[#0b171a] p-5 hover:border-[#00e699]/30 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                  <Target className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-white uppercase tracking-wider">Rapid</span>
              </div>
              <span className="text-xs text-[#8ba3a8]">10+0, 15+10</span>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-black text-white">1610</span>
              <span className="text-xs font-bold text-[#00e699]">+18 this month</span>
            </div>
            <div className="text-[11px] text-[#8ba3a8]">
              302 games played • <span className="font-bold text-white">62%</span> win rate
            </div>
          </div>
        </div>

        {/* Rating Progression Chart Section */}
        <div className="rounded-2xl border border-[#14282c] bg-[#0b171a] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#00e699]" />
              <h3 className="text-sm font-bold text-white">Rating Progression (Blitz)</h3>
            </div>

            {/* Timeframe selector */}
            <div className="flex rounded-lg border border-[#14282c] bg-[#0e1e22] p-0.5 gap-0.5">
              {(
                [
                  { id: "30d", label: "30D" },
                  { id: "3m", label: "3M" },
                  { id: "1y", label: "1Y" },
                  { id: "all", label: "ALL" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTimeframe(tab.id)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-all ${
                    timeframe === tab.id
                      ? "bg-[#00e699] text-[#081214]"
                      : "text-[#8ba3a8] hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* SVG Line Chart */}
          <div className="w-full overflow-x-auto py-2">
            <div className="min-w-[500px]">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-40"
                role="img"
                aria-label="Rating progression chart"
              >
                <title>Rating progression chart</title>
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00e699" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#00e699" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid lines */}
                <line x1="20" y1="30" x2="580" y2="30" stroke="#14282c" strokeDasharray="3 3" />
                <line x1="20" y1="80" x2="580" y2="80" stroke="#14282c" strokeDasharray="3 3" />
                <line x1="20" y1="130" x2="580" y2="130" stroke="#14282c" strokeDasharray="3 3" />

                {/* Gradient area */}
                <path d={areaD} fill="url(#chartGradient)" />

                {/* Trend line */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="#00e699"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Data points */}
                {points.map((p) => (
                  <g key={p.label}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="4"
                      fill="#081214"
                      stroke="#00e699"
                      strokeWidth="2"
                    />
                    <text
                      x={p.x}
                      y={svgHeight - 2}
                      textAnchor="middle"
                      fill="#8ba3a8"
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      {p.label}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>
        </div>

        {/* Lifetime Stats & Badges Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Lifetime Record */}
          <div className="rounded-2xl border border-[#14282c] bg-[#0b171a] p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#8ba3a8]">
              Career Statistics
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#162e33] bg-[#0e1e22] p-3">
                <span className="text-[11px] text-[#8ba3a8] block">Total Games</span>
                <span className="text-xl font-black text-white">842</span>
              </div>
              <div className="rounded-xl border border-[#162e33] bg-[#0e1e22] p-3">
                <span className="text-[11px] text-[#8ba3a8] block">Win Rate</span>
                <span className="text-xl font-black text-[#00e699]">56.8%</span>
              </div>
              <div className="rounded-xl border border-[#162e33] bg-[#0e1e22] p-3">
                <span className="text-[11px] text-[#8ba3a8] block">Record (W-L-D)</span>
                <span className="text-sm font-bold font-mono text-white">478 - 312 - 52</span>
              </div>
              <div className="rounded-xl border border-[#162e33] bg-[#0e1e22] p-3">
                <span className="text-[11px] text-[#8ba3a8] block">Best Victory</span>
                <span className="text-sm font-bold text-white truncate">GrandmasterBot (1850)</span>
              </div>
            </div>
          </div>

          {/* Achievements / Badges */}
          <div className="rounded-2xl border border-[#14282c] bg-[#0b171a] p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#8ba3a8]">
              Earned Badges
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2.5 rounded-xl border border-[#162e33] bg-[#0e1e22] p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#00e699]/15 text-[#00e699]">
                  <Trophy className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">Speed Demon</span>
                  <span className="text-[10px] text-[#8ba3a8]">Won in under 20s</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-xl border border-[#162e33] bg-[#0e1e22] p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">Iron Fortress</span>
                  <span className="text-[10px] text-[#8ba3a8]">10 games without loss</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-xl border border-[#162e33] bg-[#0e1e22] p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/15 text-orange-400">
                  <Flame className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">Hot Streak</span>
                  <span className="text-[10px] text-[#8ba3a8]">5 consecutive wins</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-xl border border-[#162e33] bg-[#0e1e22] p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/15 text-purple-400">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">Tactical Genius</span>
                  <span className="text-[10px] text-[#8ba3a8]">Queen sacrifice mate</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
