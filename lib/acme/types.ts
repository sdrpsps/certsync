export interface CloudflareConfig {
  apiToken: string;
  accountId?: string;
  zoneId?: string;
}

export interface AcmeConfig {
  environment: 'staging' | 'production';
  email: string;
  accountKeyPath?: string;
}

export interface CertificateResult {
  certificate: string;
  privateKey: string;
  chain: string;
  expiresAt: Date;
}

export interface DnsChallenge {
  domain: string;
  recordName: string;
  recordValue: string;
}
