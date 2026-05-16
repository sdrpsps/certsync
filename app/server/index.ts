import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import health from './routes/health';

const app = new Hono().basePath('/api');

app.use('*', logger());
app.use('*', cors());

app.route('/', health);

export default app;
