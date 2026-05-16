import { Hono } from 'hono';
import { db } from '@/lib/db/client';
import { domains, cloudflareConfigs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const domainRoutes = new Hono();

domainRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const { domain, email, includeWildcard } = body;

  if (!domain || !email) {
    return c.json({ error: 'Domain and email are required' }, 400);
  }

  const configs = await db.select().from(cloudflareConfigs).limit(1);
  if (!configs[0]) {
    return c.json({ error: 'Please configure Cloudflare credentials first' }, 400);
  }

  const result = await db.insert(domains).values({
    domain,
    email,
    includeWildcard: includeWildcard ?? true,
    cloudflareConfigId: configs[0].id,
  }).returning();

  return c.json(result[0], 201);
});

domainRoutes.get('/', async (c) => {
  const allDomains = await db.select().from(domains);
  return c.json(allDomains);
});

domainRoutes.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  await db.delete(domains).where(eq(domains.id, id));
  return c.json({ success: true });
});

export default domainRoutes;
