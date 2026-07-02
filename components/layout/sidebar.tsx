"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Compass,
  FolderOpen,
  Clapperboard,
  CalendarDays,
  Users,
  Layers,
  Scale,
  Settings,
  LogOut,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/descobrir", label: "Descobrir", icon: Compass },
  { href: "/projetos", label: "Projetos", icon: FolderOpen },
  { href: "/editar", label: "Editor", icon: Clapperboard },
  { href: "/agendar", label: "Agendar", icon: CalendarDays },
  { href: "/referencia", label: "Referência", icon: Users },
  { href: "/batch", label: "Batch Edit", icon: Layers },
  { href: "/juridico", label: "Jurídico", icon: Scale },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r bg-card">
      <div className="flex h-16 items-center gap-2 border-b px-5">
        <Zap className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold tracking-tight">
          Postador<span className="text-primary">Auto</span>
        </span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </aside>
  );
}
