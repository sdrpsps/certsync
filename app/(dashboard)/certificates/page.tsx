'use client';

import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { FileCheck, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
import { toast } from 'sonner';
import { useCertificates, useDomains, useIssueCertificate } from '@/lib/api/hooks';
import { domains, certificates } from '@/lib/db/schema';

type Domain = typeof domains.$inferSelect;
type Certificate = typeof certificates.$inferSelect;

const issueCertSchema = z.object({
  domainId: z.string().min(1, 'Domain is required'),
});

export default function CertificatesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: certificates = [], isLoading: certsLoading } = useCertificates();
  const { data: domains = [], isLoading: domainsLoading } = useDomains();
  const issueCertificate = useIssueCertificate();

  const issueForm = useForm({
    defaultValues: {
      domainId: '',
    },
    validators: {
      onSubmit: issueCertSchema
    },
    onSubmit: async ({ value }) => {
      issueCertificate.mutate(parseInt(value.domainId), {
        onSuccess: () => {
          toast.success('Certificate issued successfully');
          setIsDialogOpen(false);
          issueForm.reset();
        },
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : 'Failed to issue certificate';
          toast.error(message);
        },
      });
    },
  });

  if (certsLoading || domainsLoading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Certificates</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Manage SSL/TLS certificates
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Issue Certificate
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Issue Certificate</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              issueForm.handleSubmit();
            }} className="space-y-4">
              <issueForm.Field name="domainId">
                {(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>
                        Select Domain <span className="text-red-500">*</span>
                      </FieldLabel>
                      <Select
                        value={field.state.value}
                        onValueChange={field.handleChange}
                      >
                        <SelectTrigger
                          id={field.name}
                          onBlur={field.handleBlur}
                          aria-invalid={isInvalid}
                        >
                          <SelectValue placeholder="Select a domain" />
                        </SelectTrigger>
                        <SelectContent>
                          {domains.map((domain: Domain) => (
                            <SelectItem key={domain.id} value={domain.id.toString()}>
                              {domain.domain}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              </issueForm.Field>
              <Button type="submit" disabled={issueCertificate.isPending}>
                {issueCertificate.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileCheck className="h-4 w-4" />
                )}
                {issueCertificate.isPending ? 'Issuing...' : 'Issue Certificate'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Certificates</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Domain ID</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {certificates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-slate-500">
                    No certificates yet
                  </TableCell>
                </TableRow>
              ) : (
                certificates.map((cert: Certificate) => {
                  const expiresAt = new Date(cert.expiresAt);
                  const now = new Date();
                  const isExpired = expiresAt < now;
                  const isExpiring = expiresAt > now && expiresAt <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

                  return (
                    <TableRow key={cert.id}>
                      <TableCell>{cert.id}</TableCell>
                      <TableCell>{cert.domainId}</TableCell>
                      <TableCell>{cert.issuedAt ? new Date(cert.issuedAt).toLocaleDateString() : '-'}</TableCell>
                      <TableCell>{expiresAt.toLocaleDateString()}</TableCell>
                      <TableCell>
                        <span className={isExpired ? 'text-cert-expired' : isExpiring ? 'text-cert-expiring' : 'text-cert-valid'}>
                          {isExpired ? 'Expired' : isExpiring ? 'Expiring Soon' : 'Valid'}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
