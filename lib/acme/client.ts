import * as acme from 'acme-client';
import { getAcmeDirectoryUrl } from './config';
import { createCloudflareDnsChallenge } from './cloudflare-dns';
import type { AcmeConfig, CertificateResult, CloudflareConfig } from './types';
import { AcmeLogger } from './logger';

export async function orderCertificate(
  domains: string[],
  email: string,
  cloudflareConfig: CloudflareConfig,
  acmeConfig?: Partial<AcmeConfig>,
  logger?: AcmeLogger
): Promise<CertificateResult> {
  const log = logger || new AcmeLogger();
  const directoryUrl = getAcmeDirectoryUrl(acmeConfig?.environment);

  log.log(`Using ACME directory: ${directoryUrl}`);
  log.log(`Ordering certificate for: ${domains.join(', ')}`);

  const accountKey = await acme.crypto.createPrivateKey();
  const client = new acme.Client({
    directoryUrl,
    accountKey,
  });

  await client.createAccount({
    termsOfServiceAgreed: true,
    contact: [`mailto:${email}`],
  });

  log.log('ACME account created');

  const certificateKey = await acme.crypto.createPrivateKey();

  const order = await client.createOrder({
    identifiers: domains.map((domain) => ({ type: 'dns', value: domain })),
  });

  log.log('Certificate order created');

  const authorizations = await client.getAuthorizations(order);
  const dnsChallenge = createCloudflareDnsChallenge(cloudflareConfig);

  const challenges = [];

  for (const authz of authorizations) {
    const challenge = authz.challenges.find((c) => c.type === 'dns-01');
    if (!challenge) {
      throw new Error('DNS-01 challenge not available');
    }

    log.log(`Creating DNS challenge for ${authz.identifier.value}...`);
    const keyAuthorization = await client.getChallengeKeyAuthorization(challenge);
    await dnsChallenge.createChallenge(authz, challenge, keyAuthorization);
    challenges.push(challenge);
  }

  log.log('All DNS records created, waiting for propagation...');
  await new Promise(resolve => setTimeout(resolve, 30000));

  for (const challenge of challenges) {
    log.log(`Notifying ACME server to verify challenge...`);
    await client.completeChallenge(challenge);
  }

  log.log('Waiting for validation...');
  await client.waitForValidStatus(order);

  const [certificateKey2048, csr] = await acme.crypto.createCsr({
    commonName: domains[0],
    altNames: domains.slice(1),
  });

  await client.finalizeOrder(order, csr);
  const certificate = await client.getCertificate(order);

  log.log('Cleaning up DNS records...');
  for (const authz of authorizations) {
    const challenge = authz.challenges.find((c) => c.type === 'dns-01');
    if (challenge) {
      const keyAuthorization = await client.getChallengeKeyAuthorization(challenge);
      await dnsChallenge.removeChallenge(authz, challenge, keyAuthorization);
    }
  }

  log.log('Certificate issued successfully');

  return {
    certificate,
    privateKey: certificateKey2048.toString(),
    chain: certificate,
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
  };
}


