"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { BarChart3, Clock3, FileText, LayoutDashboard, Menu, X } from "lucide-react";

type AdminPage = "dashboard" | "contracts" | "time-entries" | "reports";

const navigation: { href: string; label: string; page: AdminPage; icon: typeof LayoutDashboard }[] = [
  { href: "/admin", label: "Dashboard ticket", page: "dashboard", icon: LayoutDashboard },
  { href: "/admin/contracts", label: "Contratti", page: "contracts", icon: FileText },
  { href: "/admin/time-entries", label: "Registro attività", page: "time-entries", icon: Clock3 },
  { href: "/admin/reports", label: "Report", page: "reports", icon: BarChart3 },
];

export default function AdminPageShell({
  activePage,
  title,
  children,
}: {
  activePage: Exclude<AdminPage, "dashboard" | "contracts">;
  title: string;
  children: ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col text-slate-900 md:flex-row">
      <header className="grid grid-cols-3 items-center border-b border-slate-200 bg-white px-4 py-3 md:hidden print:hidden">
        <button
          aria-controls="admin-page-sidebar"
          aria-expanded={isSidebarOpen}
          aria-label="Apri menu"
          className="justify-self-start rounded-lg p-2 text-xl"
          onClick={() => setIsSidebarOpen(true)}
          type="button"
        >
          <Menu aria-hidden="true" size={20} />
        </button>
        <h1 className="text-center font-bold">{title}</h1>
        <span aria-hidden="true" />
      </header>

      {isSidebarOpen && (
        <button
          aria-label="Chiudi navigazione"
          className="fixed inset-0 z-40 cursor-default bg-slate-900/50 md:hidden print:hidden"
          onClick={() => setIsSidebarOpen(false)}
          type="button"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform duration-300 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:sticky md:top-0 md:flex md:translate-x-0 print:hidden`}
        id="admin-page-sidebar"
      >
        <div className="flex items-start justify-between border-b border-slate-200 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">Amministrazione</p>
            <p className="mt-1 text-xl font-bold">Dashboard ticket</p>
          </div>
          <button
            aria-label="Chiudi menu"
            className="rounded-lg p-2 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
            type="button"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>
        <nav aria-label="Navigazione amministrazione" className="flex-1 space-y-1 p-4">
          {navigation.map(({ href, label, page, icon: Icon }) => {
            const isActive = page === activePage;
            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 font-semibold transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
                href={href}
                key={page}
                onClick={() => setIsSidebarOpen(false)}
              >
                <Icon aria-hidden="true" size={18} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 bg-slate-50 p-4 sm:p-6 print:bg-white print:p-0">
        {children}
      </main>
    </div>
  );
}
