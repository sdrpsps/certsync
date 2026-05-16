import { Hono } from 'hono';
import { db } from '@/lib/db/client';
import { certificates, domains, cloudflareConfigs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { orderCertificate } from '@/lib/acme/client';

const certRoutes = new Hono();

certRoutes.post('/issue', async (c) => {
  const body = await c.req.json();
  const { domainId } = body;

  if (!domainId) {
    return c.json({ error: 'Domain ID is required' }, 400);
  }

  const domain = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
  if (!domain[0]) {
    return c.json({ error: 'Domain not found' }, 404);
  }

  const cfConfig = await db.select().from(cloudflareConfigs).where(eq(cloudflareConfigs.id, domain[0].cloudflareConfigId!)).limit(1);
  if (!cfConfig[0]) {
    return c.json({ error: 'Cloudflare config not found' }, 404);
  }

  const domainList = domain[0].includeWildcard
    ? [domain[0].domain, `*.${domain[0].domain}`]
    : [domain[0].domain];

  const cert = await orderCertificate(
    domainList,
    domain[0].email,
    { apiToken: cfConfig[0].apiToken, accountId: cfConfig[0].accountId || undefined }
  );

  const result = await db.insert(certificates).values({
    domainId,
    certificate: cert.certificate,
    privateKey: cert.privateKey,
    chain: cert.chain,
    expiresAt: cert.expiresAt,
  }).returning();

  return c.json(result[0], 201);
});

certRoutes.get('/', async (c) => {
  const allCerts = await db.select().from(certificates);
  return c.json(allCerts);
});

certRoutes.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const cert = await db.select().from(certificates).where(eq(certificates.id, id)).limit(1);
  return c.json(cert[0] || null);
});

export default certRoutes;
