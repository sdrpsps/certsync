import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import health from './routes/health';
import config from './routes/config';
import domainRoutes from './routes/domains';
import certRoutes from './routes/certificates';

const app = new Hono().basePath('/api');

app.use('*', logger());
app.use('*', cors());

app.route('/', health);
app.route('/config', config);
app.route('/domains', domainRoutes);
app.route('/certificates', certRoutes);

export default app;
