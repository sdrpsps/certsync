import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from './client';

export function useCloudflareConfig() {
  return useQuery({
    queryKey: ['cloudflare-config'],
    queryFn: api.fetchCloudflareConfig,
  });
}

export function useSaveCloudflareConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.saveCloudflareConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cloudflare-config'] });
    },
  });
}

export function useDomains() {
  return useQuery({
    queryKey: ['domains'],
    queryFn: api.fetchDomains,
  });
}

export function useCreateDomain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createDomain,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
    },
  });
}

export function useDeleteDomain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteDomain,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
    },
  });
}

export function useCertificates() {
  return useQuery({
    queryKey: ['certificates'],
    queryFn: api.fetchCertificates,
  });
}

export function useIssueCertificate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.issueCertificate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
    },
  });
}
