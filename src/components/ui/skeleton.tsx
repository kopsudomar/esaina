import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      data-slot="skeleton"
      className={cn(
        "animate-pulse rounded-[var(--neu-radius-control)] bg-[var(--neu-surface-low)] motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}
