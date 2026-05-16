'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCertificates } from '@/lib/api/hooks';

export default function DashboardPage() {
  const { data: certificates = [], isLoading } = useCertificates();

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const stats = {
    total: certificates.length,
    valid: certificates.filter(c => new Date(c.expiresAt) > now).length,
    expiring: certificates.filter(c => {
      const expiresAt = new Date(c.expiresAt);
      return expiresAt > now && expiresAt <= thirtyDaysFromNow;
    }).length,
  };

  const recentCerts = certificates.slice(0, 5);

  if (isLoading) {
    return <div className="p-8">Loading...</div>;
  }
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Certificate management overview
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Certificates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Valid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cert-valid">{stats.valid}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cert-expiring">{stats.expiring}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Certificates</CardTitle>
        </CardHeader>
        <CardContent>
          {recentCerts.length === 0 ? (
            <p className="text-sm text-slate-500">No certificates yet</p>
          ) : (
            <div className="space-y-2">
              {recentCerts.map((cert) => (
                <div key={cert.id} className="flex justify-between items-center p-2 border rounded">
                  <span className="font-medium">Certificate #{cert.id}</span>
                  <span className="text-sm text-slate-500">
                    Expires: {new Date(cert.expiresAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
