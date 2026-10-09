import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  ExternalLink,
  Flame,
  Info,
  Radio,
  Swords,
  Trash2,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import type React from "react";
import { useEffect } from "react";
import { type AppNotification, useGameStore } from "../store/gameStore";

export const NotificationDrawer: React.FC = () => {
  const {
    isNotificationDrawerOpen,
    closeNotificationDrawer,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    removeNotification,
    setActiveView,
  } = useGameStore();

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isNotificationDrawerOpen) {
        closeNotificationDrawer();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isNotificationDrawerOpen, closeNotificationDrawer]);

  if (!isNotificationDrawerOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleAcceptChallenge = (notification: AppNotification) => {
    markNotificationRead(notification.id);
    closeNotificationDrawer();
    // Launch game or navigate to challenge
    setActiveView("play_online");
  };

  const handleDeclineChallenge = (id: string) => {
    removeNotification(id);
  };

  const formatTimestamp = (ts: number): string => {
    const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
      {/* Backdrop overlay dismiss */}
      <button
        type="button"
        aria-label="Close notification drawer"
        onClick={closeNotificationDrawer}
        className="flex-1 cursor-default bg-transparent"
      />

      {/* Sliding Drawer Container */}
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-[#14282c] bg-[#0b171a] shadow-2xl text-neutral-100 animate-slide-left select-none">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-[#14282c] px-5 py-4 bg-[#081214]/80">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0e2428] text-[#00e699] border border-[#16363d]">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">Notifications</h2>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-[#00e699]/15 px-2 py-0.5 text-[10px] font-bold text-[#00e699] border border-[#00e699]/30">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#8ba3a8]">
                Challenges, results, and platform announcements
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={markAllNotificationsRead}
                title="Mark all as read"
                className="rounded-lg p-2 text-[#8ba3a8] hover:text-white hover:bg-[#0e1e22] transition-colors"
              >
                <CheckCheck className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={closeNotificationDrawer}
              aria-label="Close"
              className="rounded-lg p-2 text-[#8ba3a8] hover:text-white hover:bg-[#0e1e22] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {notifications.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-center p-6 text-[#587277]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0e1e22] border border-[#14282c] mb-3 text-[#587277]">
                <Bell className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold text-white">All caught up!</p>
              <p className="text-[11px] text-[#8ba3a8] mt-1 max-w-[200px]">
                You have no unread notifications or pending challenges right now.
              </p>
            </div>
          ) : (
            notifications.map((item) => {
              const isChallenge = item.type === "challenge";
              const isMatch = item.type === "match_result";
              const isAnnouncement = item.type === "announcement";

              return (
                <div
                  key={item.id}
                  onClick={() => markNotificationRead(item.id)}
                  className={`group relative flex flex-col gap-2 rounded-2xl border p-3.5 transition-all ${
                    item.read
                      ? "border-[#14282c] bg-[#0e1e22]/50 hover:bg-[#0e1e22]"
                      : "border-[#00e699]/30 bg-[#0e2428]/40 hover:bg-[#0e2428]/60 shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-xs font-bold ${
                          isChallenge
                            ? "bg-[#00e699]/15 text-[#00e699] border-[#00e699]/30"
                            : isMatch
                              ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                              : "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
                        }`}
                      >
                        {isChallenge ? (
                          <Swords className="h-4 w-4" />
                        ) : isMatch ? (
                          <Trophy className="h-4 w-4" />
                        ) : (
                          <Info className="h-4 w-4" />
                        )}
                      </div>

                      {/* Content */}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-xs font-bold text-white">{item.title}</h3>
                          {!item.read && <span className="h-1.5 w-1.5 rounded-full bg-[#00e699]" />}
                        </div>
                        <p className="text-[11px] text-[#8ba3a8] mt-0.5 leading-relaxed">
                          {item.message}
                        </p>
                      </div>
                    </div>

                    {/* Timestamp & Dismiss */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] font-mono text-[#587277]">
                        {formatTimestamp(item.timestamp)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeNotification(item.id);
                        }}
                        title="Dismiss"
                        className="opacity-0 group-hover:opacity-100 text-[#587277] hover:text-white transition-opacity p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Challenge Action Buttons (for registered players) */}
                  {isChallenge && (
                    <div className="mt-1 flex items-center gap-2 pt-2 border-t border-[#162e33]">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAcceptChallenge(item);
                        }}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#00e699] py-1.5 text-xs font-bold text-[#081214] hover:bg-[#00c885] transition-colors"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Accept Game</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeclineChallenge(item.id);
                        }}
                        className="flex items-center justify-center rounded-xl border border-[#14282c] bg-[#0e1e22] px-3 py-1.5 text-xs font-medium text-neutral-400 hover:text-white hover:bg-[#162e33] transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  )}

                  {/* Match Result Delta Badge */}
                  {isMatch && item.data?.ratingDiff !== undefined && (
                    <div className="mt-1 flex items-center justify-between text-[11px] pt-1">
                      <span className="text-[#8ba3a8]">Rating Adjustment:</span>
                      <span
                        className={`font-mono font-bold ${
                          item.data.ratingDiff > 0
                            ? "text-[#00e699]"
                            : item.data.ratingDiff < 0
                              ? "text-red-400"
                              : "text-neutral-400"
                        }`}
                      >
                        {item.data.ratingDiff > 0
                          ? `+${item.data.ratingDiff}`
                          : item.data.ratingDiff}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t border-[#14282c] px-5 py-3 bg-[#081214]/60 flex items-center justify-between">
            <button
              type="button"
              onClick={clearNotifications}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8ba3a8] hover:text-red-400 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear all notifications</span>
            </button>
          </div>
        )}
      </aside>
    </div>
  );
};
