import { Hono } from 'hono';
import { db } from '@/lib/db/client';
import { certificates, domains, cloudflareConfigs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { orderCertificate } from '@/lib/acme/client';
import { AcmeLogger } from '@/lib/acme/logger';

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

certRoutes.get('/issue-stream', async (c) => {
  const domainId = parseInt(c.req.query('domainId') || '0');

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const sendEvent = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        if (!domainId) {
          sendEvent('error', { message: 'Domain ID is required' });
          controller.close();
          return;
        }

        const domain = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
        if (!domain[0]) {
          sendEvent('error', { message: 'Domain not found' });
          controller.close();
          return;
        }

        if (!domain[0].cloudflareConfigId) {
          sendEvent('error', { message: 'Domain is not linked to Cloudflare config' });
          controller.close();
          return;
        }

        const cfConfig = await db.select().from(cloudflareConfigs)
          .where(eq(cloudflareConfigs.id, domain[0].cloudflareConfigId)).limit(1);
        if (!cfConfig[0]) {
          sendEvent('error', { message: 'Cloudflare config not found' });
          controller.close();
          return;
        }

        const logger = new AcmeLogger((logEvent) => {
          sendEvent('log', logEvent);
        });

        const domainList = domain[0].includeWildcard
          ? [domain[0].domain, `*.${domain[0].domain}`]
          : [domain[0].domain];

        const cert = await orderCertificate(
          domainList,
          domain[0].email,
          { apiToken: cfConfig[0].apiToken, accountId: cfConfig[0].accountId || undefined },
          undefined,
          logger
        );

        const result = await db.insert(certificates).values({
          domainId,
          certificate: cert.certificate,
          privateKey: cert.privateKey,
          chain: cert.chain,
          expiresAt: cert.expiresAt,
        }).returning();

        sendEvent('complete', result[0]);
      } catch (error) {
        sendEvent('error', {
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
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
