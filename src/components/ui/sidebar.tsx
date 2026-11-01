"use client";

import * as React from "react";

import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_WIDTH_ICON = "3.5rem";
const SIDEBAR_SHORTCUT = "b";

type SidebarContextValue = {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  openMobile: boolean;
  setOpenMobile: React.Dispatch<React.SetStateAction<boolean>>;
  isMobile: boolean;
  toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);
const SidebarPresentationContext = React.createContext({
  iconCollapsed: false,
  mobileWidth: SIDEBAR_WIDTH_MOBILE as string | number,
});

function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) throw new Error("useSidebar must be used within a SidebarProvider.");
  return context;
}

function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = React.useState(false);
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = openProp ?? uncontrolledOpen;

  const setOpen = React.useCallback<React.Dispatch<React.SetStateAction<boolean>>>(
    (next) => {
      const value = typeof next === "function" ? next(open) : next;
      if (openProp === undefined) setUncontrolledOpen(value);
      onOpenChange?.(value);
    },
    [onOpenChange, open, openProp],
  );

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) setOpenMobile((value) => !value);
    else setOpen((value) => !value);
  }, [isMobile, setOpen]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.defaultPrevented ||
        event.isComposing ||
        (target instanceof HTMLElement &&
          (target.isContentEditable || target.closest("input, textarea, select")))
      ) {
        return;
      }
      if (
        event.key.toLowerCase() === SIDEBAR_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  const state: SidebarContextValue["state"] = open ? "expanded" : "collapsed";
  const contextValue = React.useMemo(
    () => ({
      state,
      open,
      setOpen,
      openMobile,
      setOpenMobile,
      isMobile,
      toggleSidebar,
    }),
    [state, open, setOpen, openMobile, isMobile, toggleSidebar],
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <TooltipProvider delay={0}>
        <div
          data-slot="sidebar-wrapper"
          data-state={state}
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH,
              "--sidebar-width-mobile": SIDEBAR_WIDTH_MOBILE,
              "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
              ...style,
            } as React.CSSProperties
          }
          className={cn(
            "flex min-h-0 w-full min-w-0 text-[var(--foreground)]",
            className,
          )}
          {...props}
        >
          <SidebarPresentationContext.Provider value={{
            iconCollapsed: false,
            mobileWidth: (style as React.CSSProperties & { "--sidebar-width-mobile"?: string | number })?.["--sidebar-width-mobile"] ?? SIDEBAR_WIDTH_MOBILE,
          }}>
            {children}
          </SidebarPresentationContext.Provider>
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  );
}

type SidebarProps = React.ComponentProps<"aside"> & {
  side?: "left" | "right";
  variant?: "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon" | "none";
  mobileTitle?: string;
  mobileDescription?: string;
  closeLabel?: string;
};

function Sidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  mobileTitle = "Sidebar",
  mobileDescription = "Application navigation",
  closeLabel = "Close sidebar",
  className,
  style,
  ref,
  children,
  ...props
}: SidebarProps) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();
  const { mobileWidth } = React.useContext(SidebarPresentationContext);
  const collapsed = state === "collapsed";
  const offcanvasHidden = !isMobile && collapsed && collapsible === "offcanvas";
  const desktopContentRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const panel = desktopContentRef.current?.parentElement;
    if (!offcanvasHidden || !panel?.contains(panel.ownerDocument.activeElement)) return;

    // Restore only this panel's focus, before the hidden subtree loses it.
    // Internal, nested-provider and unavailable triggers are not return targets.
    const wrapper = panel.closest('[data-slot="sidebar-wrapper"]');
    const trigger = Array.from(
      wrapper?.querySelectorAll<HTMLElement>('[data-slot="sidebar-trigger"]') ?? [],
    ).find(element =>
      element.closest('[data-slot="sidebar-wrapper"]') === wrapper &&
      !panel.contains(element) &&
      !element.matches(":disabled, [aria-disabled='true']") &&
      !element.closest("[inert]") &&
      element.checkVisibility({ visibilityProperty: true, opacityProperty: true }),
    );
    trigger?.focus({ preventScroll: true });
  }, [offcanvasHidden]);

  const content = (
    <SidebarPresentationContext.Provider value={{ iconCollapsed: !isMobile && collapsed && collapsible === "icon", mobileWidth }}>
      {children}
    </SidebarPresentationContext.Provider>
  );

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent
          data-sidebar="sidebar"
          data-mobile="true"
          side={side}
          closeLabel={closeLabel}
          ref={ref as React.Ref<HTMLDivElement>}
          style={{ "--sidebar-width-mobile": mobileWidth, ...style } as React.CSSProperties}
          className={cn(
            "w-[min(var(--sidebar-width-mobile),calc(100vw-1rem))] gap-0 p-0 pt-0",
            className,
          )}
          {...props}
        >
          <div className="sr-only">
            <SheetTitle>{mobileTitle}</SheetTitle>
            <SheetDescription>{mobileDescription}</SheetDescription>
          </div>
          <div className="flex h-full min-h-0 flex-col bg-[var(--neu-surface)]">
            {content}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const width =
    collapsible === "none" || !collapsed
      ? "var(--sidebar-width)"
      : collapsible === "icon"
        ? "var(--sidebar-width-icon)"
        : "0px";

  const innerClass =
    variant === "sidebar"
      ? cn(
          "border-[color:var(--neu-edge)] bg-[var(--neu-surface)]",
          side === "left" ? "border-r" : "border-l",
        )
      : "m-2 rounded-[var(--neu-radius-surface)] border border-transparent bg-[var(--neu-surface)] [box-shadow:var(--neu-shadow-raised-sm)]";

  return (
    <aside
      data-slot="sidebar"
      data-state={state}
      data-side={side}
      data-variant={variant}
      data-collapsible={collapsible}
      style={{ width, ...style }}
      ref={ref}
      className={cn(
        "group/sidebar hidden min-h-0 shrink-0 overflow-hidden transition-[width,opacity] duration-[var(--neu-duration)] motion-reduce:transition-none md:flex",
        offcanvasHidden && "pointer-events-none opacity-0",
        className,
      )}
      {...props}
      inert={offcanvasHidden || props.inert}
    >
      <div
        ref={desktopContentRef}
        data-slot="sidebar-inner"
        className={cn(
          "flex h-full min-h-0 shrink-0 flex-col overflow-hidden text-[var(--foreground)]",
          collapsed && collapsible === "icon"
            ? "w-[var(--sidebar-width-icon)]"
            : "w-[var(--sidebar-width)]",
          innerClass,
        )}
      >
        {content}
      </div>
    </aside>
  );
}

function SidebarTrigger({
  className,
  label = "Toggle sidebar",
  children,
  onClick,
  ...props
}: React.ComponentProps<typeof Button> & { label?: string }) {
  const { isMobile, open, openMobile, toggleSidebar } = useSidebar();
  return (
    <Button
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon"
      aria-label={label}
      aria-expanded={isMobile ? openMobile : open}
      className={cn("size-9", className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          // Safari does not focus native buttons on pointer activation.
          if (isMobile && !openMobile) event.currentTarget.focus({ preventScroll: true });
          toggleSidebar();
        }
      }}
      {...props}
    >
      {children ?? <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>}
    </Button>
  );
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}
      {...props}
    />
  );
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      className={cn(
        "flex min-h-14 shrink-0 items-center gap-2 overflow-hidden border-b border-[var(--border)] px-3 py-2",
        className,
      )}
      {...props}
    />
  );
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn(
        "mt-auto flex shrink-0 flex-col gap-2 border-t border-[var(--border)] p-3",
        className,
      )}
      {...props}
    />
  );
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto p-2", className)}
      {...props}
    />
  );
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="sidebar-group"
      className={cn("grid min-w-0 gap-2 py-2", className)}
      {...props}
    />
  );
}

function SidebarGroupLabel({ className, ...props }: React.ComponentProps<"h3">) {
  const { iconCollapsed: collapsed } = React.useContext(SidebarPresentationContext);
  return (
    <h3
      data-slot="sidebar-group-label"
      className={cn(
        "px-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]",
        collapsed && "sr-only",
        className,
      )}
      {...props}
    />
  );
}

function SidebarGroupContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group-content"
      className={cn("min-w-0", className)}
      {...props}
    />
  );
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      className={cn("grid min-w-0 gap-1", className)}
      {...props}
    />
  );
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-item"
      className={cn("relative min-w-0", className)}
      {...props}
    />
  );
}

function menuClassName(
  collapsed: boolean,
  isActive: boolean,
  className?: string,
) {
  return cn(
    "flex h-9 w-full min-w-0 items-center gap-2 overflow-hidden rounded-[var(--neu-radius-control)] px-3 text-left text-sm font-medium text-[var(--foreground)] outline-none transition-[background-color,box-shadow,color] duration-[var(--neu-duration)] motion-reduce:transition-none hover:bg-[var(--neu-surface-soft)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-50",
    isActive &&
      "relative bg-[var(--neu-selected)] text-[var(--neu-accent-ink)] font-semibold [box-shadow:var(--neu-shadow-inset-sm)] before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-[var(--neu-accent-ink)]",
    collapsed &&
      "justify-center px-2 [&>span:last-child]:sr-only",
    className,
  );
}

function SidebarMenuButton({
  className,
  isActive = false,
  tooltip,
  children,
  "aria-label": ariaLabel,
  ...props
}: React.ComponentProps<"button"> & {
  isActive?: boolean;
  tooltip?: string;
}) {
  const { iconCollapsed: collapsed } = React.useContext(SidebarPresentationContext);
  const element = (
    <button
      type="button"
      data-slot="sidebar-menu-button"
      data-active={isActive}
      aria-label={ariaLabel ?? (collapsed ? tooltip : undefined)}
      className={menuClassName(collapsed, isActive, className)}
      {...props}
    >
      {children}
    </button>
  );

  if (!tooltip || !collapsed) return element;
  return (
    <Tooltip>
      <TooltipTrigger render={element} />
      <TooltipContent side="right">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function SidebarMenuLink({
  className,
  isActive = false,
  tooltip,
  children,
  "aria-label": ariaLabel,
  ...props
}: React.ComponentProps<"a"> & {
  isActive?: boolean;
  tooltip?: string;
}) {
  const { iconCollapsed: collapsed } = React.useContext(SidebarPresentationContext);
  const element = (
    <a
      data-slot="sidebar-menu-link"
      data-active={isActive}
      aria-current={isActive ? "page" : props["aria-current"]}
      aria-label={ariaLabel ?? (collapsed ? tooltip : undefined)}
      className={menuClassName(collapsed, isActive, className)}
      {...props}
    >
      {children}
    </a>
  );

  if (!tooltip || !collapsed) return element;
  return (
    <Tooltip>
      <TooltipTrigger render={element} />
      <TooltipContent side="right">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuLink,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
};
