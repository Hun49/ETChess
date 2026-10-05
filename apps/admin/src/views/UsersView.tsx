import { Search, ShieldAlert, ShieldCheck, SlidersHorizontal, UserX, X } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { banUser, unbanUser } from "../api.js";
import type { AdminUser } from "../types.js";

interface UsersViewProps {
  onOpenRatingAdjust: (user: AdminUser) => void;
}

export const UsersView: React.FC<UsersViewProps> = ({ onOpenRatingAdjust }) => {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "banned">("all");

  // Sample seed/fetched user registry
  const [users, setUsers] = useState<AdminUser[]>([
    {
      id: "u-1",
      name: "Hundaol Worku",
      email: "hundaol@etchess.com",
      role: "admin",
      avatar:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80",
      isBanned: false,
      createdAt: Date.now() - 86400000 * 30,
      ratings: { bullet: 1820, blitz: 1890, rapid: 1940, classical: 1980 },
      gamesPlayed: 142,
    },
    {
      id: "u-2",
      name: "ChessMaster",
      email: "master@ethio.com",
      role: "user",
      avatar:
        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80",
      isBanned: false,
      createdAt: Date.now() - 86400000 * 20,
      ratings: { bullet: 1950, blitz: 1987, rapid: 2010, classical: 2050 },
      gamesPlayed: 320,
    },
    {
      id: "u-3",
      name: "AlexRook",
      email: "alex@rook.org",
      role: "user",
      avatar:
        "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=80&q=80",
      isBanned: false,
      createdAt: Date.now() - 86400000 * 15,
      ratings: { bullet: 1910, blitz: 1964, rapid: 1980, classical: 1995 },
      gamesPlayed: 285,
    },
    {
      id: "u-4",
      name: "spammer_007",
      email: "bot007@trashmail.com",
      role: "user",
      isBanned: true,
      banReason: "In-game chat harassment & persistent spam",
      banExpiresAt: Date.now() + 86400000 * 7,
      createdAt: Date.now() - 86400000 * 3,
      ratings: { bullet: 1200, blitz: 1250, rapid: 1300, classical: 1300 },
      gamesPlayed: 18,
    },
  ]);

  // Ban Modal state
  const [selectedUserForBan, setSelectedUserForBan] = useState<AdminUser | null>(null);
  const [banDuration, setBanDuration] = useState<"1d" | "7d" | "30d" | "perm">("7d");
  const [banReason, setBanReason] = useState("");
  const [loading, setLoading] = useState(false);

  const filteredUsers = users.filter((u) => {
    const matchesQuery =
      u.name.toLowerCase().includes(query.toLowerCase()) ||
      u.email.toLowerCase().includes(query.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const matchesStatus =
      statusFilter === "all" || (statusFilter === "banned" ? u.isBanned : !u.isBanned);
    return matchesQuery && matchesRole && matchesStatus;
  });

  const handleBanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForBan || !banReason.trim()) return;
    setLoading(true);
    try {
      const now = Date.now();
      let expiresAt: number | null = null;
      if (banDuration === "1d") expiresAt = now + 86400000;
      if (banDuration === "7d") expiresAt = now + 86400000 * 7;
      if (banDuration === "30d") expiresAt = now + 86400000 * 30;

      await banUser(selectedUserForBan.id, banReason, expiresAt);

      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUserForBan.id
            ? { ...u, isBanned: true, banReason, banExpiresAt: expiresAt }
            : u,
        ),
      );
      setSelectedUserForBan(null);
      setBanReason("");
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnban = async (user: AdminUser) => {
    if (!confirm(`Are you sure you want to unban ${user.name}?`)) return;
    try {
      await unbanUser(user.id);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, isBanned: false, banReason: null, banExpiresAt: null } : u,
        ),
      );
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="flex-1 p-6 space-y-6 max-w-[1600px] mx-auto w-full">
      {/* Title & Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            User Management
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Search, inspect, adjust ratings, and manage player bans & suspensions.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-[#121c26] border border-[#1e2d3d] rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500/50 w-64 shadow-inner"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as "all" | "admin" | "user")}
            className="px-3 py-2 bg-[#121c26] border border-[#1e2d3d] rounded-xl text-xs text-slate-300 outline-none focus:border-emerald-500/50"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admins</option>
            <option value="user">Users</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "banned")}
            className="px-3 py-2 bg-[#121c26] border border-[#1e2d3d] rounded-xl text-xs text-slate-300 outline-none focus:border-emerald-500/50"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="banned">Banned</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-[#121c26] border border-[#1e2d3d] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#1a2634] text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-[#0d1520]/50">
                <th className="py-3 pl-4">User</th>
                <th className="py-3">Email</th>
                <th className="py-3 text-center">Role</th>
                <th className="py-3 text-center">Status</th>
                <th className="py-3 text-center">Blitz</th>
                <th className="py-3 text-center">Rapid</th>
                <th className="py-3 text-center">Games</th>
                <th className="py-3 text-right pr-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a2634]/60">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-[#162230] transition-colors">
                  <td className="py-3 pl-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-slate-700 overflow-hidden flex items-center justify-center font-bold text-slate-300 border border-slate-600">
                        {u.avatar ? (
                          <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
                        ) : (
                          u.name[0]
                        )}
                      </div>
                      <span className="font-semibold text-slate-200">{u.name}</span>
                    </div>
                  </td>
                  <td className="py-3 font-mono text-slate-400">{u.email}</td>
                  <td className="py-3 text-center">
                    {u.role === "admin" ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                        Admin
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-500/15 border border-slate-500/30 text-slate-400 text-[10px] font-medium">
                        User
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-center">
                    {u.isBanned ? (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[10px] font-bold">
                        Banned
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-medium">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-center font-mono font-semibold text-slate-200">
                    {u.ratings.blitz}
                  </td>
                  <td className="py-3 text-center font-mono font-semibold text-slate-200">
                    {u.ratings.rapid}
                  </td>
                  <td className="py-3 text-center font-mono text-slate-400">{u.gamesPlayed}</td>
                  <td className="py-3 text-right pr-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenRatingAdjust(u)}
                        title="Adjust Rating"
                        className="p-1.5 rounded-lg bg-[#0d1520] border border-[#1e2d3d] hover:border-emerald-500/40 text-slate-400 hover:text-emerald-400 transition-colors"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                      </button>

                      {u.isBanned ? (
                        <button
                          type="button"
                          onClick={() => handleUnban(u)}
                          title="Unban User"
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold text-[11px] hover:bg-emerald-500/20 transition-colors"
                        >
                          Unban
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedUserForBan(u)}
                          title="Ban User"
                          className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 font-semibold text-[11px] hover:bg-rose-500/20 transition-colors"
                        >
                          Ban
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ban User Modal */}
      {selectedUserForBan && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedUserForBan(null)}
        >
          <div
            className="w-full max-w-md bg-[#121c26] border border-[#233549] rounded-2xl shadow-2xl p-6 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#1e2d3d]">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <ShieldAlert className="w-5 h-5" />
                <span>Ban User — {selectedUserForBan.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserForBan(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBanSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Ban Duration
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(["1d", "7d", "30d", "perm"] as const).map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => setBanDuration(dur)}
                      className={`py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        banDuration === dur
                          ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                          : "bg-[#0d1520] text-slate-400 border-[#1e2d3d] hover:text-white"
                      }`}
                    >
                      {dur === "perm" ? "Permanent" : dur.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Reason for Ban (Audit Requirement)
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Specify violation (e.g. Engine assistance, toxic chat, intentional stalling)..."
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  className="w-full p-2.5 bg-[#0d1520] border border-[#1e2d3d] rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-rose-500 resize-none shadow-inner"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserForBan(null)}
                  className="px-4 py-2 rounded-xl bg-[#1a2634] text-slate-300 text-xs font-semibold hover:bg-[#233549] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !banReason.trim()}
                  className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Processing..." : "Confirm Ban"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
