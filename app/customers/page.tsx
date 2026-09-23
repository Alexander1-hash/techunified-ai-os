"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Check,
  ChevronDown,
  DollarSign,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  ShoppingBag,
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

type Sale = {
  id: string;
  customer_id: string | null;
  service_id: string | null;
  amount: number;
  currency: string;
  quantity: number;
  status: "draft" | "pending" | "won" | "lost" | "cancelled";
  payment_status: "unpaid" | "partial" | "paid" | "refunded";
  sale_date: string;
  notes: string | null;
};

type Service = {
  id: string;
  name: string;
  price: number | null;
  currency: string;
  status: string;
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

type CustomerInsight = {
  customer: Customer;
  sales: Sale[];
  wonSales: Sale[];
  revenueByCurrency: Map<string, number>;
  outstandingByCurrency: Map<string, number>;
  services: Service[];
  lastPurchase: string | null;
};

const STATUS_OPTIONS: { value: CustomerStatus; label: string }[] = [
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
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || "NGN"} ${amount.toLocaleString()}`;
  }
}

function saleValue(sale: Sale) {
  return Number(sale.amount || 0) * Math.max(1, Number(sale.quantity || 1));
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

function paymentClasses(status: Sale["payment_status"]) {
  switch (status) {
    case "paid":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "partial":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "refunded":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | "all">("all");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerForm>(EMPTY_FORM);

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadCustomers = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);

      const query = params.toString();

      const [customerResponse, salesResponse, servicesResponse] = await Promise.all([
        fetch(`/api/customers${query ? `?${query}` : ""}`, {
          method: "GET",
          cache: "no-store",
        }),
        fetch("/api/sales", { method: "GET", cache: "no-store" }),
        fetch("/api/services", { method: "GET", cache: "no-store" }),
      ]);

      const [customerResult, salesResult, servicesResult] = await Promise.all([
        customerResponse.json(),
        salesResponse.json(),
        servicesResponse.json(),
      ]);

      if (!customerResponse.ok) {
        throw new Error(customerResult.error ?? "Failed to load customers.");
      }

      if (!salesResponse.ok) {
        throw new Error(salesResult.error ?? "Failed to load customer sales.");
      }

      if (!servicesResponse.ok) {
        throw new Error(servicesResult.error ?? "Failed to load services.");
      }

      setCustomers(customerResult.customers ?? []);
      setSales(salesResult.sales ?? []);
      setServices(servicesResult.services ?? []);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to load customer intelligence.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCustomers(), 250);
    return () => window.clearTimeout(timer);
  }, [search, statusFilter]);

  const insights = useMemo<CustomerInsight[]>(() => {
    return customers.map((customer) => {
      const customerSales = sales.filter((sale) => sale.customer_id === customer.id);
      const wonSales = customerSales.filter((sale) => sale.status === "won");

      const revenueByCurrency = new Map<string, number>();
      const outstandingByCurrency = new Map<string, number>();

      for (const sale of wonSales) {
        revenueByCurrency.set(
          sale.currency,
          (revenueByCurrency.get(sale.currency) ?? 0) + saleValue(sale),
        );
      }

      for (const sale of customerSales) {
        if (sale.payment_status === "unpaid" || sale.payment_status === "partial") {
          outstandingByCurrency.set(
            sale.currency,
            (outstandingByCurrency.get(sale.currency) ?? 0) + saleValue(sale),
          );
        }
      }

      const serviceIds = new Set(
        wonSales.map((sale) => sale.service_id).filter(Boolean),
      );

      const relatedServices = services.filter((service) => serviceIds.has(service.id));

      const lastPurchase = wonSales
        .slice()
        .sort(
          (a, b) =>
            new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime(),
        )[0]?.sale_date ?? null;

      return {
        customer,
        sales: customerSales,
        wonSales,
        revenueByCurrency,
        outstandingByCurrency,
        services: relatedServices,
        lastPurchase,
      };
    });
  }, [customers, sales, services]);

  const totals = useMemo(() => {
    const allRevenue = new Map<string, number>();
    const outstanding = new Map<string, number>();

    for (const insight of insights) {
      for (const [currency, value] of insight.revenueByCurrency) {
        allRevenue.set(currency, (allRevenue.get(currency) ?? 0) + value);
      }
      for (const [currency, value] of insight.outstandingByCurrency) {
        outstanding.set(currency, (outstanding.get(currency) ?? 0) + value);
      }
    }

    return {
      all: customers.length,
      leads: customers.filter((customer) => customer.status === "lead").length,
      prospects: customers.filter((customer) => customer.status === "prospect").length,
      activeCustomers: customers.filter((customer) => customer.status === "customer").length,
      inactive: customers.filter((customer) => customer.status === "inactive").length,
      buyingCustomers: insights.filter((item) => item.wonSales.length > 0).length,
      totalPurchases: insights.reduce((sum, item) => sum + item.wonSales.length, 0),
      allRevenue,
      outstanding,
    };
  }, [customers, insights]);

  const primaryCurrency = useMemo(() => {
    return totals.allRevenue.keys().next().value || "NGN";
  }, [totals.allRevenue]);

  const primaryRevenue = totals.allRevenue.get(primaryCurrency) ?? 0;
  const primaryOutstanding = totals.outstanding.get(primaryCurrency) ?? 0;

  const topCustomers = useMemo(() => {
    return insights
      .map((item) => ({
        ...item,
        revenue: item.revenueByCurrency.get(primaryCurrency) ?? 0,
      }))
      .filter((item) => item.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [insights, primaryCurrency]);

  const selectedInsight = useMemo(() => {
    if (!selectedCustomer) return null;
    return insights.find((item) => item.customer.id === selectedCustomer.id) ?? null;
  }, [selectedCustomer, insights]);

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
    if (saving) return;
    setShowForm(false);
    setEditingCustomer(null);
    setForm(EMPTY_FORM);
  };

  const updateForm = (field: keyof CustomerForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setMessage({ type: "error", text: "Customer name is required." });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);

      const isEditing = Boolean(editingCustomer);
      const response = await fetch(
        isEditing ? `/api/customers/${editingCustomer?.id}` : "/api/customers",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            company_name: form.company_name.trim(),
            status: form.status,
            source: form.source.trim(),
            notes: form.notes.trim(),
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            (isEditing ? "Failed to update customer." : "Failed to create customer."),
        );
      }

      setShowForm(false);
      setEditingCustomer(null);
      setForm(EMPTY_FORM);
      setMessage({
        type: "success",
        text: isEditing ? "Customer updated successfully." : "Customer created successfully.",
      });

      await loadCustomers();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Something went wrong.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (customer: Customer) => {
    if (!window.confirm(`Delete ${customer.name}? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingId(customer.id);
      setMessage(null);

      const response = await fetch(`/api/customers/${customer.id}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Failed to delete customer.");
      }

      if (selectedCustomer?.id === customer.id) {
        setSelectedCustomer(null);
      }

      setMessage({ type: "success", text: "Customer deleted successfully." });
      await loadCustomers();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to delete customer.",
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
              <span>Business / Customers</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              Customer intelligence
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Manage customer records while seeing their purchases, revenue, services, payment exposure, and transaction history.
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
              {message.type === "success" ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              <span>{message.text}</span>
            </div>
            <button type="button" onClick={() => setMessage(null)} className="rounded p-1 hover:bg-black/5">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            ["Customers", totals.all],
            ["Leads", totals.leads],
            ["Prospects", totals.prospects],
            ["Buying customers", totals.buyingCustomers],
            ["Purchases", totals.totalPurchases],
          ].map(([label, value]) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                if (label === "Leads") setStatusFilter("lead");
                else if (label === "Prospects") setStatusFilter("prospect");
                else if (label === "Customers") setStatusFilter("all");
              }}
              className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
            </button>
          ))}
        </section>

        <section className="mb-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-slate-400" />
              <div>
                <h2 className="text-sm font-semibold text-slate-950">Customer revenue overview</h2>
                <p className="mt-1 text-xs text-slate-500">Confirmed revenue from won customer sales.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Recorded revenue</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">{formatMoney(primaryRevenue, primaryCurrency)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Outstanding / partial</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">{formatMoney(primaryOutstanding, primaryCurrency)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Inactive accounts</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">{totals.inactive}</p>
              </div>
            </div>
            {totals.allRevenue.size > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {[...totals.allRevenue.entries()].map(([currency, value]) => (
                  <span key={currency} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
                    {currency}: {formatMoney(value, currency)}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-950">Top customers</h2>
            <div className="mt-4 space-y-3">
              {topCustomers.length === 0 ? (
                <p className="text-sm text-slate-500">No won customer sales yet.</p>
              ) : (
                topCustomers.map((item, index) => (
                  <button
                    key={item.customer.id}
                    type="button"
                    onClick={() => setSelectedCustomer(item.customer)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <span className="truncate text-sm font-medium text-slate-700">
                      {index + 1}. {item.customer.name}
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-slate-950">
                      {formatMoney(item.revenue, primaryCurrency)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </section>

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
              onChange={(event) => setStatusFilter(event.target.value as CustomerStatus | "all")}
              className="h-10 min-w-[160px] appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-9 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            >
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading customer intelligence...
              </div>
            </div>
          ) : customers.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
              <Users className="h-9 w-9 text-slate-300" />
              <h2 className="mt-4 text-base font-semibold text-slate-950">No customers found</h2>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                {search.trim() || statusFilter !== "all"
                  ? "Try changing your search or status filter."
                  : "Add your first customer to start building customer intelligence."}
              </p>
              {!search.trim() && statusFilter === "all" && (
                <button type="button" onClick={openCreate} className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-medium text-white hover:bg-slate-800">
                  <Plus className="h-4 w-4" />
                  Add customer
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-left">
                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Customer</th>
                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Status</th>
                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Purchases</th>
                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Revenue</th>
                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Services</th>
                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Last purchase</th>
                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Outstanding</th>
                    <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {insights.map((item) => {
                    const revenue = item.revenueByCurrency.get(primaryCurrency) ?? 0;
                    const outstanding = item.outstandingByCurrency.get(primaryCurrency) ?? 0;
                    return (
                      <tr key={item.customer.id} className="transition hover:bg-slate-50/60">
                        <td className="px-5 py-4">
                          <button type="button" onClick={() => setSelectedCustomer(item.customer)} className="flex items-center gap-3 text-left">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100">
                              <UserRound className="h-4 w-4 text-slate-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-950">{item.customer.name}</p>
                              {item.customer.company_name && (
                                <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                                  <Building2 className="h-3 w-3" />
                                  <span className="truncate">{item.customer.company_name}</span>
                                </div>
                              )}
                            </div>
                          </button>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(item.customer.status)}`}>
                            {statusLabel(item.customer.status)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm font-medium text-slate-800">{item.wonSales.length}</td>
                        <td className="px-5 py-4 text-sm font-semibold text-slate-950">
                          {formatMoney(revenue, primaryCurrency)}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {item.services.slice(0, 2).map((service) => (
                              <span key={service.id} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
                                {service.name}
                              </span>
                            ))}
                            {item.services.length > 2 && (
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-500">
                                +{item.services.length - 2}
                              </span>
                            )}
                            {item.services.length === 0 && <span className="text-xs text-slate-400">—</span>}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-500">{formatDate(item.lastPurchase)}</td>
                        <td className="px-5 py-4 text-sm font-medium text-slate-700">
                          {outstanding > 0 ? formatMoney(outstanding, primaryCurrency) : "—"}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-1">
                            <button type="button" onClick={() => setSelectedCustomer(item.customer)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" title="View customer intelligence">
                              <ShoppingBag className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => openEdit(item.customer)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" title="Edit customer">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => void handleDelete(item.customer)} disabled={deletingId === item.customer.id} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50" title="Delete customer">
                              {deletingId === item.customer.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {selectedInsight && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-6">
          <button type="button" aria-label="Close customer intelligence" className="absolute inset-0 cursor-default" onClick={() => setSelectedCustomer(null)} />
          <div className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-3xl sm:rounded-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Customer intelligence</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">{selectedInsight.customer.name}</h2>
                {selectedInsight.customer.company_name && <p className="mt-0.5 text-sm text-slate-500">{selectedInsight.customer.company_name}</p>}
              </div>
              <button type="button" onClick={() => setSelectedCustomer(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">Won purchases</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">{selectedInsight.wonSales.length}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">Services</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">{selectedInsight.services.length}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">Revenue</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">{formatMoney(selectedInsight.revenueByCurrency.get(primaryCurrency) ?? 0, primaryCurrency)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">Outstanding</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">{formatMoney(selectedInsight.outstandingByCurrency.get(primaryCurrency) ?? 0, primaryCurrency)}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Contact</p>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    {selectedInsight.customer.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-400" />{selectedInsight.customer.email}</div>}
                    {selectedInsight.customer.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" />{selectedInsight.customer.phone}</div>}
                    <div className="flex items-center gap-2"><Users className="h-4 w-4 text-slate-400" />{statusLabel(selectedInsight.customer.status)}</div>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Relationship signals</p>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    <p>Last purchase: <span className="font-medium text-slate-900">{formatDate(selectedInsight.lastPurchase)}</span></p>
                    <p>Source: <span className="font-medium text-slate-900">{selectedInsight.customer.source || "—"}</span></p>
                    <p>Total sales records: <span className="font-medium text-slate-900">{selectedInsight.sales.length}</span></p>
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-950">Sales history</h3>
                </div>
                {selectedInsight.sales.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No sales are connected to this customer yet.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full min-w-[650px]">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Value</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Sale</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Payment</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedInsight.sales.map((sale) => {
                          const service = services.find((item) => item.id === sale.service_id);
                          return (
                            <tr key={sale.id}>
                              <td className="px-4 py-3 text-sm text-slate-500">{formatDate(sale.sale_date)}</td>
                              <td className="px-4 py-3 text-sm font-semibold text-slate-950">{formatMoney(saleValue(sale), sale.currency)}</td>
                              <td className="px-4 py-3">
                                <div>
                                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                                    sale.status === "won"
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                      : sale.status === "lost"
                                        ? "border-red-200 bg-red-50 text-red-700"
                                        : "border-slate-200 bg-slate-100 text-slate-600"
                                  }`}>
                                    {titleCase(sale.status)}
                                  </span>
                                  <p className="mt-1 text-xs text-slate-400">{service?.name || "Service not found"}</p>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${paymentClasses(sale.payment_status)}`}>
                                  {titleCase(sale.payment_status)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {selectedInsight.services.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-slate-400" />
                    <h3 className="text-sm font-semibold text-slate-950">Services purchased</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedInsight.services.map((service) => (
                      <span key={service.id} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700">
                        {service.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-6">
          <div className="absolute inset-0" onClick={closeForm} />
          <div className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">{editingCustomer ? "Edit customer" : "Add customer"}</h2>
                <p className="mt-0.5 text-xs text-slate-500">{editingCustomer ? "Update the customer information below." : "Create a new customer record for your organization."}</p>
              </div>
              <button type="button" onClick={closeForm} disabled={saving} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-50">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Customer name *</label>
                  <input type="text" value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder="e.g. John Doe" required className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
                  <input type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} placeholder="customer@example.com" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Phone</label>
                  <input type="tel" value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} placeholder="+234..." className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Company</label>
                  <input type="text" value={form.company_name} onChange={(event) => updateForm("company_name", event.target.value)} placeholder="Company name" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
                  <select value={form.status} onChange={(event) => updateForm("status", event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100">
                    {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Source</label>
                  <input type="text" value={form.source} onChange={(event) => updateForm("source", event.target.value)} placeholder="e.g. Website, Referral, Instagram" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Notes</label>
                  <textarea value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} placeholder="Add useful context about this customer..." rows={4} className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100" />
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeForm} disabled={saving} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingCustomer ? "Save changes" : "Create customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
