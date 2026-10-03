import { Check, ShieldCheck } from "lucide-react";
import type React from "react";

interface VerifiedBadgeProps {
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  size = "md",
  showLabel = false,
  className = "",
}) => {
  const sizeClasses = {
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const iconSizes = {
    sm: "h-2 w-2 stroke-[3]",
    md: "h-2.5 w-2.5 stroke-[3]",
    lg: "h-3 w-3 stroke-[3]",
  };

  return (
    <div
      title="Verified Player (Anti-Cheat & Email Confirmed)"
      className={`inline-flex items-center gap-1.5 cursor-help select-none ${className}`}
    >
      <div
        className={`relative flex ${sizeClasses[size]} items-center justify-center rounded-full bg-[#00e699] text-[#081214] shadow-sm shadow-[#00e699]/30`}
      >
        <Check className={iconSizes[size]} />
      </div>

      {showLabel && (
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#00e699]">
          Verified
        </span>
      )}
    </div>
  );
};
