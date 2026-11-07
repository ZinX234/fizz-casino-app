import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function GameDialog({
  open,
  onOpenChange,
  eyebrow,
  title,
  description,
  children,
  footer,
  className,
  wide = false,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "border-white/10 bg-[#080a0f]/95 p-0 text-white shadow-[0_40px_120px_-40px_rgba(0,0,0,0.95)] backdrop-blur-2xl",
          wide ? "max-w-[620px]" : "max-w-[480px]",
          className,
        )}
      >
        <div className="relative overflow-hidden rounded-lg">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(ellipse_at_50%_0%,rgba(182,255,60,0.14),transparent_70%)]" />
          <div className="relative px-5 pb-5 pt-6 sm:px-7 sm:pb-6 sm:pt-7">
            {eyebrow && (
              <div className="mb-2 font-heading text-[9px] uppercase tracking-[0.34em] text-[#b6ff3c]/70">
                {eyebrow}
              </div>
            )}
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-[0.06em] text-white">
              {title}
            </DialogTitle>
            {description && (
              <DialogDescription className="mt-1.5 text-[12.5px] leading-relaxed text-white/45">
                {description}
              </DialogDescription>
            )}
            <div className="mt-5">{children}</div>
            {footer && <div className="mt-6 flex flex-wrap items-center justify-end gap-2">{footer}</div>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SettingRow({ label, hint, children, stacked = false }) {
  return (
    <div
      className={cn(
        "border-b border-white/[0.06] py-3.5 last:border-b-0",
        stacked ? "space-y-2.5" : "flex items-center justify-between gap-4",
      )}
    >
      <div className="min-w-0">
        <div className="font-heading text-[11px] uppercase tracking-[0.18em] text-white/75">{label}</div>
        {hint && <div className="mt-1 text-[11px] leading-snug text-white/35">{hint}</div>}
      </div>
      <div className={cn("shrink-0", stacked && "w-full")}>{children}</div>
    </div>
  );
}

export function Segmented({ options, value, onChange, size = "sm" }) {
  return (
    <div className="inline-flex rounded-lg border border-white/10 bg-black/40 p-0.5">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-[6px] font-heading uppercase tracking-[0.14em] transition-all",
              size === "sm" ? "px-2.5 py-1.5 text-[9.5px]" : "px-3 py-2 text-[10px]",
              active
                ? "bg-[#b6ff3c] text-[#05060a] shadow-[0_0_16px_-4px_rgba(182,255,60,0.7)]"
                : "text-white/50 hover:text-white/85",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}