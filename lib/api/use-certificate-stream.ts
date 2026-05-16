import { useState, useCallback } from 'react';
import type { LogEvent } from '@/lib/acme/logger';

interface Certificate {
  id: number;
  domainId: number;
  certificate: string;
  privateKey: string;
  chain: string;
  issuedAt: Date;
  expiresAt: Date;
}

export function useCertificateStream() {
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [certificate, setCertificate] = useState<Certificate | null>(null);

  const startIssuance = useCallback((domainId: number) => {
    setLogs([]);
    setError(null);
    setCertificate(null);
    setIsLoading(true);

    const eventSource = new EventSource(`/api/certificates/issue-stream?domainId=${domainId}`);

    eventSource.addEventListener('log', (e) => {
      const logEvent: LogEvent = JSON.parse(e.data);
      setLogs((prev) => [...prev, logEvent]);
    });

    eventSource.addEventListener('complete', (e) => {
      const cert: Certificate = JSON.parse(e.data);
      setCertificate(cert);
      setIsLoading(false);
      eventSource.close();
    });

    eventSource.addEventListener('error', (e) => {
      if ((e as MessageEvent).data) {
        try {
          const errorData = JSON.parse((e as MessageEvent).data);
          setError(errorData.message);
        } catch {
          setError('Failed to parse error message');
        }
      }
      setIsLoading(false);
      eventSource.close();
    });

    eventSource.onerror = () => {
      if (!error) {
        setError('Connection error');
      }
      setIsLoading(false);
      eventSource.close();
    };

    return () => eventSource.close();
  }, []);

  return { logs, isLoading, error, certificate, startIssuance };
}
