"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, ClipboardList, Home, ChartColumn, Users, FileText } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuLink,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/app/logout-button";

type Role = "TEACHER" | "STUDENT" | "ADMIN";

const MOBILE_TITLE: Record<Role, string> = {
  TEACHER: "Menu guru",
  STUDENT: "Menu siswa",
  ADMIN: "Menu admin",
};

const ROLE_LABEL: Record<Role, string> = {
  TEACHER: "Guru",
  STUDENT: "Siswa",
  ADMIN: "Admin",
};

const ROLE_HOME: Record<Role, string> = {
  TEACHER: "/guru",
  STUDENT: "/siswa",
  ADMIN: "/admin",
};

const NAV: Record<Role, { href: string; label: string; icon: React.ElementType }[]> = {
  TEACHER: [
    { href: "/guru", label: "Beranda", icon: Home },
    { href: "/guru/classes", label: "Kelas", icon: Users },
    { href: "/guru/assessments", label: "Asesmen", icon: FileText },
    { href: "/guru/grading", label: "Penilaian", icon: ClipboardList },
  ],
  STUDENT: [
    { href: "/siswa", label: "Beranda", icon: Home },
    { href: "/siswa/classes", label: "Kelas", icon: Users },
    { href: "/siswa/results", label: "Hasil", icon: ChartColumn },
  ],
  ADMIN: [
    { href: "/admin", label: "Beranda", icon: Home },
    { href: "/admin/classes", label: "Kelas", icon: Users },
    { href: "/admin/assessments", label: "Asesmen", icon: FileText },
    { href: "/admin/users", label: "Pengguna", icon: Users },
    { href: "/admin/monitoring", label: "Monitoring", icon: ChartColumn },
  ],
};

export function AppSidebar({ role, name, children }: { role: Role; name: string; children: React.ReactNode }) {
  const pathname = usePathname();

  const activeHref = NAV[role]
    .map((item) => item.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <SidebarProvider className="min-h-screen">
      <Sidebar
        aria-label="Navigasi utama"
        mobileTitle={MOBILE_TITLE[role]}
        mobileDescription="Navigasi utama aplikasi ESAINA"
      >
        <SidebarHeader className="border-b-0 px-5">
          <Link href={ROLE_HOME[role]} className="flex items-center gap-2">
            <GraduationCap className="size-6 text-primary" aria-hidden />
            <span className="font-heading text-lg font-bold tracking-tight text-primary">ESAINA</span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <nav aria-label={`Navigasi ${ROLE_LABEL[role]}`}>
                <SidebarMenu>
                  {NAV[role].map((item) => {
                    const active = item.href === activeHref;
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuLink href={item.href} isActive={active}>
                          <item.icon className="size-5 shrink-0" aria-hidden />
                          <span>{item.label}</span>
                          {active && <span className="sr-only">(halaman aktif)</span>}
                        </SidebarMenuLink>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </nav>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="h-auto flex-col items-stretch gap-2 border-t-0 py-3">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <p className="truncate text-xs text-muted-foreground" title={name}>
              {name}
            </p>
            <Badge variant="soft">{ROLE_LABEL[role]}</Badge>
          </div>
          <LogoutButton />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b border-border px-4 md:hidden">
          <SidebarTrigger label="Buka menu" />
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
