import type { CloudflareConfig } from './types';

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';

interface CloudflareZone {
  id: string;
  name: string;
}

interface CloudflareDnsRecord {
  id: string;
  name: string;
  type: string;
  content: string;
}

async function getZoneId(domain: string, apiToken: string): Promise<string> {
  const rootDomain = domain.split('.').slice(-2).join('.');
  const response = await fetch(`${CLOUDFLARE_API_BASE}/zones?name=${rootDomain}`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  });

  if (!response.ok) {
    throw new Error(`Cloudflare API error: ${response.statusText}`);
  }

  const data = await response.json();
  const zone = data.result?.[0] as CloudflareZone | undefined;

  if (!zone) {
    throw new Error(`Zone not found for domain: ${rootDomain}`);
  }

  return zone.id;
}

async function createDnsRecord(
  zoneId: string,
  name: string,
  content: string,
  apiToken: string
): Promise<string> {
  const response = await fetch(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/dns_records`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'TXT',
      name,
      content,
      ttl: 120,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create DNS record: ${response.statusText}`);
  }

  const data = await response.json();
  return data.result.id;
}

async function deleteDnsRecord(zoneId: string, recordId: string, apiToken: string): Promise<void> {
  const response = await fetch(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/dns_records/${recordId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${apiToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete DNS record: ${response.statusText}`);
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createCloudflareDnsChallenge(config: CloudflareConfig) {
  const recordCache = new Map<string, { zoneId: string; recordId: string }>();

  return {
    async createChallenge(authz: any, challenge: any, keyAuthorization: string): Promise<void> {
      const domain = authz.identifier.value.replace(/^\*\./, '');
      const recordName = `_acme-challenge.${domain}`;
      const recordValue = keyAuthorization;

      console.log(`Creating DNS TXT record: ${recordName}`);

      const zoneId = await getZoneId(domain, config.apiToken);
      const recordId = await createDnsRecord(zoneId, recordName, recordValue, config.apiToken);

      recordCache.set(domain, { zoneId, recordId });

      console.log(`DNS record created for ${recordName}`);
    },

    async removeChallenge(authz: any, challenge: any, keyAuthorization: string): Promise<void> {
      const domain = authz.identifier.value.replace(/^\*\./, '');
      const cached = recordCache.get(domain);

      if (!cached) {
        console.warn(`No cached record found for ${domain}`);
        return;
      }

      console.log(`Removing DNS TXT record for ${domain}`);
      await deleteDnsRecord(cached.zoneId, cached.recordId, config.apiToken);
      recordCache.delete(domain);
    },
  };
}

