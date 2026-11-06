import { cn } from "@/lib/utils";

const VARIANTS = {
  lime:
    "bg-[#b6ff3c] text-[#05060a] border border-[#d9ff9a]/60 shadow-[0_0_36px_-10px_rgba(182,255,60,0.85)] hover:shadow-[0_0_60px_-6px_rgba(182,255,60,0.95)] hover:brightness-[1.06]",
  pink:
    "bg-[#ff2e9a] text-white border border-[#ff8ec8]/50 shadow-[0_0_36px_-10px_rgba(255,46,154,0.85)] hover:shadow-[0_0_60px_-6px_rgba(255,46,154,0.95)] hover:brightness-[1.06]",
  glass:
    "glass-pill text-white/85 hover:text-white hover:border-white/25 hover:bg-white/10",
  outlineLime:
    "border border-[#b6ff3c]/45 text-[#d9ff9a] bg-[#b6ff3c]/[0.06] hover:bg-[#b6ff3c]/[0.14] hover:border-[#b6ff3c]/80",
  outlinePink:
    "border border-[#ff2e9a]/45 text-[#ffb0d6] bg-[#ff2e9a]/[0.06] hover:bg-[#ff2e9a]/[0.14] hover:border-[#ff2e9a]/80",
  ghost: "text-white/60 hover:text-white hover:bg-white/[0.06]",
  danger:
    "border border-red-400/40 text-red-200 bg-red-500/10 hover:bg-red-500/20",
};

const SIZES = {
  sm: "h-9 px-4 text-[11px] tracking-[0.18em]",
  md: "h-11 px-5 text-[12px] tracking-[0.16em]",
  lg: "h-14 px-7 text-[13px] tracking-[0.2em]",
  hero: "h-[68px] px-8 text-[15px] tracking-[0.22em]",
};

export default function NeonButton({
  children,
  variant = "glass",
  size = "md",
  className,
  disabled,
  icon: Icon,
  sublabel,
  align = "center",
  ...props
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "group relative inline-flex select-none items-center gap-3 overflow-hidden rounded-xl font-heading font-semibold uppercase",
        "transition-all duration-300 ease-out active:scale-[0.985]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b6ff3c]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05060a]",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:brightness-100",
        VARIANTS[variant] || VARIANTS.glass,
        SIZES[size] || SIZES.md,
        align === "start" ? "justify-start" : "justify-center",
        className,
      )}
      {...props}
    >
      {(variant === "lime" || variant === "pink") && (
        <span className="pointer-events-none absolute inset-0 -translate-x-[150%] bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-700 group-hover:translate-x-[150%]" />
      )}
      {Icon && <Icon className="relative h-4 w-4 shrink-0" strokeWidth={2} />}
      <span className="relative flex flex-col items-start leading-none">
        <span>{children}</span>
        {sublabel && (
          <span className="mt-1.5 text-[9px] font-normal tracking-[0.18em] opacity-60">
            {sublabel}
          </span>
        )}
      </span>
    </button>
  );
}