"use client";

import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Save, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
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
import { toast } from "sonner";
import {
  useCloudflareConfig,
  useSaveCloudflareConfig,
  useDomains,
  useCreateDomain,
  useDeleteDomain,
} from "@/lib/api/hooks";
import { domains } from "@/lib/db/schema";

type Domain = typeof domains.$inferSelect;

const cloudflareSchema = z.object({
  apiToken: z.string().min(1, "API Token is required"),
  accountId: z.string().nullable(),
});

const domainSchema = z.object({
  domain: z.string().min(1, "Domain is required"),
  email: z.email("Invalid email address"),
  includeWildcard: z.boolean(),
});

export default function ConfigPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: config } = useCloudflareConfig();
  const { data: domains = [] } = useDomains();
  const saveConfig = useSaveCloudflareConfig();
  const createDomain = useCreateDomain();
  const deleteDomain = useDeleteDomain();

  const cloudflareForm = useForm({
    defaultValues: {
      apiToken: config?.apiToken || "",
      accountId: config?.accountId,
    },
    validators: {
      onSubmit: cloudflareSchema,
    },
    onSubmit: async ({ value }) => {
      saveConfig.mutate(value, {
        onSuccess: () => toast.success("Configuration saved successfully"),
        onError: (err: unknown) => {
          const message =
            err instanceof Error ? err.message : "Failed to save configuration";
          toast.error(message);
        },
      });
    },
  });

  const domainForm = useForm({
    defaultValues: {
      domain: "",
      email: "",
      includeWildcard: true,
    },
    validators: {
      onSubmit: domainSchema,
    },
    onSubmit: async ({ value }) => {
      createDomain.mutate(value, {
        onSuccess: () => {
          toast.success("Domain added successfully");
          setIsDialogOpen(false);
          domainForm.reset();
        },
        onError: (err: unknown) => {
          const message =
            err instanceof Error ? err.message : "Failed to add domain";
          toast.error(message);
        },
      });
    },
  });

  function handleDeleteDomain(id: number) {
    deleteDomain.mutate(id, {
      onSuccess: () => toast.success("Domain deleted successfully"),
      onError: (err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Failed to delete domain";
        toast.error(message);
      },
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configuration</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Manage Cloudflare credentials and domains
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cloudflare Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              cloudflareForm.handleSubmit();
            }}
            className="space-y-4"
          >
            <cloudflareForm.Field name="apiToken">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      API Token <span className="text-red-500">*</span>
                    </FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="password"
                      placeholder="Enter Cloudflare API token"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                );
              }}
            </cloudflareForm.Field>
            <cloudflareForm.Field name="accountId">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Account ID</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    placeholder="Enter Cloudflare account ID (optional)"
                    value={field.state.value || ""}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            </cloudflareForm.Field>
            <Button type="submit" disabled={saveConfig.isPending}>
              {saveConfig.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saveConfig.isPending ? "Saving..." : "Save Configuration"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Domains</CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4" />
                  Add Domain
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Domain</DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    domainForm.handleSubmit();
                  }}
                  className="space-y-4"
                >
                  <domainForm.Field name="domain">
                    {(field) => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>
                            Domain <span className="text-red-500">*</span>
                          </FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            placeholder="example.com"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            aria-invalid={isInvalid}
                          />
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      );
                    }}
                  </domainForm.Field>
                  <domainForm.Field name="email">
                    {(field) => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>
                            Email <span className="text-red-500">*</span>
                          </FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            type="email"
                            placeholder="admin@example.com"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            aria-invalid={isInvalid}
                          />
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      );
                    }}
                  </domainForm.Field>
                  <domainForm.Field name="includeWildcard">
                    {(field) => (
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="wildcard"
                          checked={field.state.value}
                          onChange={(e) => field.handleChange(e.target.checked)}
                        />
                        <FieldLabel htmlFor="wildcard">
                          Include wildcard (*)
                        </FieldLabel>
                      </div>
                    )}
                  </domainForm.Field>
                  <Button type="submit" disabled={createDomain.isPending}>
                    {createDomain.isPending ? "Adding..." : "Add Domain"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Wildcard</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-sm text-slate-500"
                  >
                    No domains configured
                  </TableCell>
                </TableRow>
              ) : (
                domains.map((domain: Domain) => (
                  <TableRow key={domain.id}>
                    <TableCell>{domain.domain}</TableCell>
                    <TableCell>{domain.email}</TableCell>
                    <TableCell>
                      {domain.includeWildcard ? "Yes" : "No"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteDomain(domain.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
