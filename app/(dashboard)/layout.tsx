import Link from 'next/link';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <aside className="w-64 border-r bg-slate-50 dark:bg-slate-900">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-cert-primary">CERT_SYNC</h1>
        </div>
        <nav className="space-y-1 px-3">
          <Link
            href="/"
            className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Dashboard
          </Link>
          <Link
            href="/certificates"
            className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Certificates
          </Link>
          <Link
            href="/config"
            className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Configuration
          </Link>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
