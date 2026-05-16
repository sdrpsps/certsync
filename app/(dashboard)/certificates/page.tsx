"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import JSZip from "jszip";
import {
  FileCheck,
  Plus,
  Loader2,
  Download,
  Copy,
  MoreVertical,
  MoreHorizontalIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { toast } from "sonner";
import { useCertificates, useDomains } from "@/lib/api/hooks";
import { useCertificateStream } from "@/lib/api/use-certificate-stream";
import { domains, certificates } from "@/lib/db/schema";
import { ButtonGroup } from "@/components/ui/button-group";

type Domain = typeof domains.$inferSelect;
type Certificate = typeof certificates.$inferSelect;

const issueCertSchema = z.object({
  domainId: z.string().min(1, "Domain is required"),
});

export default function CertificatesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const { data: certificates = [] } = useCertificates();
  const { data: domains = [] } = useDomains();
  const { logs, isLoading, error, certificate, startIssuance } =
    useCertificateStream();

  const copyToClipboard = (content: string, label: string) => {
    navigator.clipboard
      .writeText(content)
      .then(() => {
        toast.success(`${label} copied to clipboard`);
      })
      .catch(() => {
        toast.error("Failed to copy to clipboard");
      });
  };

  const downloadZip = async (
    certificate: string,
    privateKey: string,
    filename: string,
  ) => {
    const zip = new JSZip();
    zip.file(`${filename}.crt`, certificate);
    zip.file(`${filename}.key`, privateKey);
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (certificate) {
      toast.success(`Certificate issued successfully (ID: ${certificate.id})`);
    }
  }, [certificate]);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const issueForm = useForm({
    defaultValues: {
      domainId: "",
    },
    validators: {
      onSubmit: issueCertSchema,
    },
    onSubmit: async ({ value }) => {
      startIssuance(parseInt(value.domainId));
    },
  });

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
            <form
              onSubmit={(e) => {
                e.preventDefault();
                issueForm.handleSubmit();
              }}
              className="space-y-4"
            >
              <issueForm.Field name="domainId">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;
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
                            <SelectItem
                              key={domain.id}
                              value={domain.id.toString()}
                            >
                              {domain.domain}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  );
                }}
              </issueForm.Field>

              {logs.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Logs:</div>
                  <div className="max-h-60 overflow-y-auto rounded border bg-slate-50 dark:bg-slate-900 p-3 space-y-1">
                    {logs.map((log, index) => (
                      <div key={index} className="text-xs font-mono">
                        <span className="text-slate-500">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>{" "}
                        <span
                          className={
                            log.level === "error"
                              ? "text-red-600"
                              : "text-slate-700 dark:text-slate-300"
                          }
                        >
                          {log.message}
                        </span>
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              )}

              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileCheck className="h-4 w-4" />
                )}
                {isLoading ? "Issuing..." : "Issue Certificate"}
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
                <TableHead>Domain</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {certificates.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-sm text-slate-500"
                  >
                    No certificates yet
                  </TableCell>
                </TableRow>
              ) : (
                certificates.map((cert: Certificate) => {
                  const expiresAt = new Date(cert.expiresAt);
                  const now = new Date();
                  const isExpired = expiresAt < now;
                  const isExpiring =
                    expiresAt > now &&
                    expiresAt <=
                      new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                  const domain = domains.find(
                    (d: Domain) => d.id === cert.domainId,
                  );

                  return (
                    <TableRow key={cert.id}>
                      <TableCell>{cert.id}</TableCell>
                      <TableCell>
                        {domain?.domain || `Domain #${cert.domainId}`}
                      </TableCell>
                      <TableCell>
                        {cert.issuedAt
                          ? new Date(cert.issuedAt).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell>{expiresAt.toLocaleDateString()}</TableCell>
                      <TableCell>
                        <span
                          className={
                            isExpired
                              ? "text-cert-expired"
                              : isExpiring
                                ? "text-cert-expiring"
                                : "text-cert-valid"
                          }
                        >
                          {isExpired
                            ? "Expired"
                            : isExpiring
                              ? "Expiring Soon"
                              : "Valid"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <ButtonGroup>
                          <Button
                            variant="outline"
                            onClick={() =>
                              downloadZip(
                                cert.certificate,
                                cert.privateKey,
                                domain?.domain || `cert-${cert.id}`,
                              )
                            }
                          >
                            <Download className="h-4 w-4" />
                            Download
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                aria-label="More Options"
                              >
                                <MoreHorizontalIcon />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuGroup>
                                <DropdownMenuItem
                                  onClick={() =>
                                    copyToClipboard(
                                      cert.certificate,
                                      "Certificate",
                                    )
                                  }
                                >
                                  <Copy className="h-4 w-4" />
                                  Cert
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    copyToClipboard(
                                      cert.privateKey,
                                      "Private Key",
                                    )
                                  }
                                >
                                  <Copy className="h-4 w-4" />
                                  Key
                                </DropdownMenuItem>
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </ButtonGroup>
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
