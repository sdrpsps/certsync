import { Hono } from 'hono';
import { db } from '@/lib/db/client';
import { domains } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const domainRoutes = new Hono();

domainRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const { domain, email, includeWildcard, cloudflareConfigId } = body;

  if (!domain || !email) {
    return c.json({ error: 'Domain and email are required' }, 400);
  }

  const result = await db.insert(domains).values({
    domain,
    email,
    includeWildcard: includeWildcard ?? true,
    cloudflareConfigId,
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
