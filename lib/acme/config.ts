export const ACME_DIRECTORY_URLS = {
  staging: 'https://acme-staging-v02.api.letsencrypt.org/directory',
  production: 'https://acme-v02.api.letsencrypt.org/directory',
} as const;

export type AcmeEnvironment = keyof typeof ACME_DIRECTORY_URLS;

export function getAcmeDirectoryUrl(env?: string): string {
  const environment = (env || process.env.ACME_ENV || 'staging') as AcmeEnvironment;
  return ACME_DIRECTORY_URLS[environment] || ACME_DIRECTORY_URLS.staging;
}
