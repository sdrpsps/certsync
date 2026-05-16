import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const cloudflareConfigs = sqliteTable('cloudflare_configs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  apiToken: text('api_token').notNull(),
  accountId: text('account_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const domains = sqliteTable('domains', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  domain: text('domain').notNull().unique(),
  email: text('email').notNull(),
  includeWildcard: integer('include_wildcard', { mode: 'boolean' }).default(true),
  cloudflareConfigId: integer('cloudflare_config_id').references(() => cloudflareConfigs.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const certificates = sqliteTable('certificates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  domainId: integer('domain_id').references(() => domains.id).notNull(),
  certificate: text('certificate').notNull(),
  privateKey: text('private_key').notNull(),
  chain: text('chain').notNull(),
  issuedAt: integer('issued_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  status: text('status', { enum: ['valid', 'expiring', 'expired'] }).default('valid'),
});

export const deploymentTargets = sqliteTable('deployment_targets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  type: text('type', { enum: ['synology', 'ssh'] }).notNull(),
  host: text('host').notNull(),
  port: integer('port').default(22),
  username: text('username'),
  config: text('config', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const renewalJobs = sqliteTable('renewal_jobs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  certificateId: integer('certificate_id').references(() => certificates.id).notNull(),
  scheduledAt: integer('scheduled_at', { mode: 'timestamp' }).notNull(),
  status: text('status', { enum: ['pending', 'running', 'completed', 'failed'] }).default('pending'),
  lastRunAt: integer('last_run_at', { mode: 'timestamp' }),
  error: text('error'),
});

