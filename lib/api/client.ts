import { cloudflareConfigs, domains, certificates } from '@/lib/db/schema';

type CloudflareConfig = typeof cloudflareConfigs.$inferSelect;
type Domain = typeof domains.$inferSelect;
type Certificate = typeof certificates.$inferSelect;

async function fetchAPI(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  return res.json();
}

export async function fetchCloudflareConfig(): Promise<CloudflareConfig | null> {
  return fetchAPI('/api/config/cloudflare');
}

export async function saveCloudflareConfig(data: { apiToken: string; accountId?: string | null }): Promise<CloudflareConfig> {
  return fetchAPI('/api/config/cloudflare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function fetchDomains(): Promise<Domain[]> {
  return fetchAPI('/api/domains');
}

export async function createDomain(data: { domain: string; email: string; includeWildcard?: boolean; cloudflareConfigId?: number }): Promise<Domain> {
  return fetchAPI('/api/domains', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deleteDomain(id: number): Promise<void> {
  return fetchAPI(`/api/domains/${id}`, { method: 'DELETE' });
}

export async function fetchCertificates(): Promise<Certificate[]> {
  return fetchAPI('/api/certificates');
}

export async function issueCertificate(domainId: number): Promise<Certificate> {
  return fetchAPI('/api/certificates/issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domainId }),
  });
}
