"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Check,
  ChevronDown,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";

type CustomerStatus = "lead" | "prospect" | "customer" | "inactive";

type Customer = {
  id: string;
  organization_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  status: CustomerStatus;
  source: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type CustomerForm = {
  name: string;
  email: string;
  phone: string;
  company_name: string;
  status: CustomerStatus;
  source: string;
  notes: string;
};

const STATUS_OPTIONS: {
  value: CustomerStatus;
  label: string;
}[] = [
  { value: "lead", label: "Lead" },
  { value: "prospect", label: "Prospect" },
  { value: "customer", label: "Customer" },
  { value: "inactive", label: "Inactive" },
];

const EMPTY_FORM: CustomerForm = {
  name: "",
  email: "",
  phone: "",
  company_name: "",
  status: "lead",
  source: "",
  notes: "",
};

function statusLabel(status: CustomerStatus) {
  return (
    STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function statusClasses(status: CustomerStatus) {
  switch (status) {
    case "customer":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "prospect":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "inactive":
      return "bg-slate-100 text-slate-600 border-slate-200";
    default:
      return "bg-amber-50 text-amber-700 border-amber-200";
  }
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    CustomerStatus | "all"
  >("all");

  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] =
    useState<Customer | null>(null);

  const [form, setForm] = useState<CustomerForm>(EMPTY_FORM);

  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadCustomers = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }

      const query = params.toString();

      const response = await fetch(
        `/api/customers${query ? `?${query}` : ""}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ?? "Failed to load customers."
        );
      }

      setCustomers(result.customers ?? []);
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to load customers.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCustomers();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [search, statusFilter]);

  const totals = useMemo(() => {
    return {
      all: customers.length,
      leads: customers.filter(
        (customer) => customer.status === "lead"
      ).length,
      prospects: customers.filter(
        (customer) => customer.status === "prospect"
      ).length,
      customers: customers.filter(
        (customer) => customer.status === "customer"
      ).length,
      inactive: customers.filter(
        (customer) => customer.status === "inactive"
      ).length,
    };
  }, [customers]);

  const openCreate = () => {
    setEditingCustomer(null);
    setForm(EMPTY_FORM);
    setMessage(null);
    setShowForm(true);
  };

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer);

    setForm({
      name: customer.name,
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      company_name: customer.company_name ?? "",
      status: customer.status,
      source: customer.source ?? "",
      notes: customer.notes ?? "",
    });

    setMessage(null);
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) {
      return;
    }

    setShowForm(false);
    setEditingCustomer(null);
    setForm(EMPTY_FORM);
  };

  const updateForm = (
    field: keyof CustomerForm,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setMessage({
        type: "error",
        text: "Customer name is required.",
      });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);

      const isEditing = Boolean(editingCustomer);

      const response = await fetch(
        isEditing
          ? `/api/customers/${editingCustomer?.id}`
          : "/api/customers",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            company_name: form.company_name.trim(),
            status: form.status,
            source: form.source.trim(),
            notes: form.notes.trim(),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            (isEditing
              ? "Failed to update customer."
              : "Failed to create customer.")
        );
      }

      setShowForm(false);
      setEditingCustomer(null);
      setForm(EMPTY_FORM);

      setMessage({
        type: "success",
        text: isEditing
          ? "Customer updated successfully."
          : "Customer created successfully.",
      });

      await loadCustomers();
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Something went wrong.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (customer: Customer) => {
    const confirmed = window.confirm(
      `Delete ${customer.name}? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(customer.id);
      setMessage(null);

      const response = await fetch(
        `/api/customers/${customer.id}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ?? "Failed to delete customer."
        );
      }

      setMessage({
        type: "success",
        text: "Customer deleted successfully.",
      });

      await loadCustomers();
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to delete customer.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="min-h-full bg-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <Users className="h-4 w-4" />
              <span>Business</span>
              <span>/</span>
              <span className="text-slate-700">
                Customers
              </span>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              Customers
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage leads, prospects, customers, and relationships
              across your organization.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add customer
          </button>
        </div>

        {message && (
          <div
            className={`mb-5 flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            <div className="flex items-center gap-2">
              {message.type === "success" ? (
                <Check className="h-4 w-4" />
              ) : (
                <X className="h-4 w-4" />
              )}
              <span>{message.text}</span>
            </div>

            <button
              type="button"
              onClick={() => setMessage(null)}
              className="rounded p-1 hover:bg-black/5"
              aria-label="Dismiss message"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`rounded-xl border p-4 text-left transition ${
              statusFilter === "all"
                ? "border-slate-300 bg-slate-50"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                All
              </span>
              <Users className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {totals.all}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("lead")}
            className={`rounded-xl border p-4 text-left transition ${
              statusFilter === "lead"
                ? "border-amber-200 bg-amber-50"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Leads
            </span>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {totals.leads}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("prospect")}
            className={`rounded-xl border p-4 text-left transition ${
              statusFilter === "prospect"
                ? "border-blue-200 bg-blue-50"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Prospects
            </span>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {totals.prospects}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("customer")}
            className={`rounded-xl border p-4 text-left transition ${
              statusFilter === "customer"
                ? "border-emerald-200 bg-emerald-50"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Customers
            </span>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {totals.customers}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("inactive")}
            className={`rounded-xl border p-4 text-left transition ${
              statusFilter === "inactive"
                ? "border-slate-300 bg-slate-100"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Inactive
            </span>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {totals.inactive}
            </p>
          </button>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customers, email, phone, or company..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as CustomerStatus | "all"
                )
              }
              className="h-10 min-w-[150px] appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-9 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            >
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>

            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading customers...
              </div>
            </div>
          ) : customers.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <Users className="h-5 w-5 text-slate-500" />
              </div>

              <h2 className="text-base font-semibold text-slate-950">
                No customers found
              </h2>

              <p className="mt-1 max-w-md text-sm text-slate-500">
                {search.trim() || statusFilter !== "all"
                  ? "Try changing your search or status filter."
                  : "Add your first customer to start building your customer base."}
              </p>

              {!search.trim() &&
                statusFilter === "all" && (
                  <button
                    type="button"
                    onClick={openCreate}
                    className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    <Plus className="h-4 w-4" />
                    Add customer
                  </button>
                )}
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[900px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-left">
                      <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                        Customer
                      </th>
                      <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                        Contact
                      </th>
                      <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                        Status
                      </th>
                      <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                        Source
                      </th>
                      <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                        Added
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {customers.map((customer) => (
                      <tr
                        key={customer.id}
                        className="transition hover:bg-slate-50/60"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100">
                              <UserRound className="h-4 w-4 text-slate-500" />
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-950">
                                {customer.name}
                              </p>

                              {customer.company_name && (
                                <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                                  <Building2 className="h-3 w-3" />
                                  <span className="truncate">
                                    {customer.company_name}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="space-y-1">
                            {customer.email && (
                              <div className="flex items-center gap-2 text-xs text-slate-600">
                                <Mail className="h-3.5 w-3.5 text-slate-400" />
                                <span className="truncate">
                                  {customer.email}
                                </span>
                              </div>
                            )}

                            {customer.phone && (
                              <div className="flex items-center gap-2 text-xs text-slate-600">
                                <Phone className="h-3.5 w-3.5 text-slate-400" />
                                <span>{customer.phone}</span>
                              </div>
                            )}

                            {!customer.email &&
                              !customer.phone && (
                                <span className="text-xs text-slate-400">
                                  No contact details
                                </span>
                              )}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(
                              customer.status
                            )}`}
                          >
                            {statusLabel(customer.status)}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {customer.source || "—"}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-500">
                          {formatDate(customer.created_at)}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                openEdit(customer)
                              }
                              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                              title="Edit customer"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void handleDelete(customer)
                              }
                              disabled={
                                deletingId === customer.id
                              }
                              className="rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                              title="Delete customer"
                            >
                              {deletingId === customer.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-slate-100 md:hidden">
                {customers.map((customer) => (
                  <div
                    key={customer.id}
                    className="p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100">
                          <UserRound className="h-4 w-4 text-slate-500" />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-950">
                            {customer.name}
                          </p>

                          {customer.company_name && (
                            <p className="mt-0.5 truncate text-xs text-slate-500">
                              {customer.company_name}
                            </p>
                          )}
                        </div>
                      </div>

                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(
                          customer.status
                        )}`}
                      >
                        {statusLabel(customer.status)}
                      </span>
                    </div>

                    <div className="mt-4 space-y-2">
                      {customer.email && (
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <Mail className="h-3.5 w-3.5 text-slate-400" />
                          <span className="break-all">
                            {customer.email}
                          </span>
                        </div>
                      )}

                      {customer.phone && (
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <Phone className="h-3.5 w-3.5 text-slate-400" />
                          <span>{customer.phone}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 text-xs text-slate-400">
                        <span>
                          {customer.source
                            ? `Source: ${customer.source}`
                            : formatDate(customer.created_at)}
                        </span>

                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              openEdit(customer)
                            }
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            title="Edit customer"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void handleDelete(customer)
                            }
                            disabled={
                              deletingId === customer.id
                            }
                            className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            title="Delete customer"
                          >
                            {deletingId === customer.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-6">
          <div
            className="absolute inset-0"
            onClick={closeForm}
          />

          <div className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  {editingCustomer
                    ? "Edit customer"
                    : "Add customer"}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {editingCustomer
                    ? "Update the customer information below."
                    : "Create a new customer record for your organization."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-5"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Customer name *
                  </label>

                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) =>
                      updateForm("name", event.target.value)
                    }
                    placeholder="e.g. John Doe"
                    required
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Email
                  </label>

                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      updateForm("email", event.target.value)
                    }
                    placeholder="customer@example.com"
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Phone
                  </label>

                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(event) =>
                      updateForm("phone", event.target.value)
                    }
                    placeholder="+234..."
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Company
                  </label>

                  <input
                    type="text"
                    value={form.company_name}
                    onChange={(event) =>
                      updateForm(
                        "company_name",
                        event.target.value
                      )
                    }
                    placeholder="Company name"
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Status
                  </label>

                  <select
                    value={form.status}
                    onChange={(event) =>
                      updateForm(
                        "status",
                        event.target.value
                      )
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Source
                  </label>

                  <input
                    type="text"
                    value={form.source}
                    onChange={(event) =>
                      updateForm("source", event.target.value)
                    }
                    placeholder="e.g. Website, Referral, Instagram"
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Notes
                  </label>

                  <textarea
                    value={form.notes}
                    onChange={(event) =>
                      updateForm("notes", event.target.value)
                    }
                    placeholder="Add useful context about this customer..."
                    rows={4}
                    className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {editingCustomer
                    ? "Save changes"
                    : "Create customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
