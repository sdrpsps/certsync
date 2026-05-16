import { db } from '@/lib/db/client';
import { cloudflareConfigs } from '@/lib/db/schema';
import { Hono } from 'hono';

const config = new Hono();

config.post('/cloudflare', async (c) => {
  const body = await c.req.json();
  const { apiToken, accountId } = body;

  if (!apiToken) {
    return c.json({ error: 'API token is required' }, 400);
  }

  const result = await db.insert(cloudflareConfigs).values({
    apiToken,
    accountId,
  }).returning();

  return c.json(result[0], 201);
});

config.get('/cloudflare', async (c) => {
  const configs = await db.select().from(cloudflareConfigs).limit(1);
  return c.json(configs[0] || null);
});

export default config;
