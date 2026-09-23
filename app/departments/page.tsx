"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Department = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  is_active: boolean | null;
  sort_order: number | null;
};

type Service = {
  id: string;
  department_id: string | null;
  name: string;
  status: "active" | "inactive" | "draft";
  price: number | null;
  currency: string;
};

type Customer = {
  id: string;
  name: string;
  company_name: string | null;
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
};

type DepartmentForm = {
  name: string;
  description: string;
  icon: string;
  is_active: boolean;
};

type Insight = {
  department: Department;
  services: Service[];
  sales: Sale[];
  wonSales: Sale[];
  customers: Customer[];
  revenue: Map<string, number>;
  paid: Map<string, number>;
  outstanding: Map<string, number>;
  units: number;
  lastSale: string | null;
};

const emptyForm: DepartmentForm = {
  name: "",
  description: "",
  icon: "",
  is_active: true,
};

function saleValue(sale: Sale) {
  return Number(sale.amount || 0) * Math.max(1, Number(sale.quantity || 1));
}

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency || "NGN"} ${value.toLocaleString()}`;
  }
}

function dateLabel(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<DepartmentForm>(emptyForm);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const responses = await Promise.all([
        fetch("/api/departments", { cache: "no-store" }),
        fetch("/api/services", { cache: "no-store" }),
        fetch("/api/customers", { cache: "no-store" }),
        fetch("/api/sales", { cache: "no-store" }),
      ]);
      const results = await Promise.all(responses.map((response) => response.json()));
      if (responses.some((response) => !response.ok)) {
        throw new Error(results.find((result, index) => !responses[index].ok)?.error || "Unable to load department intelligence.");
      }
      if (results.some((result) => !result.success)) {
        throw new Error("Unable to load department intelligence.");
      }
      setDepartments(results[0].departments ?? []);
      setServices(results[1].services ?? []);
      setCustomers(results[2].customers ?? []);
      setSales(results[3].sales ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load department intelligence.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const insights = useMemo<Insight[]>(() => departments.map((department) => {
    const departmentServices = services.filter((service) => service.department_id === department.id);
    const serviceIds = new Set(departmentServices.map((service) => service.id));
    const departmentSales = sales.filter((sale) => sale.service_id !== null && serviceIds.has(sale.service_id));
    const wonSales = departmentSales.filter((sale) => sale.status === "won");
    const customerIds = new Set<string>();
    const revenue = new Map<string, number>();
    const paid = new Map<string, number>();
    const outstanding = new Map<string, number>();
    let units = 0;

    for (const sale of wonSales) {
      const value = saleValue(sale);
      revenue.set(sale.currency, (revenue.get(sale.currency) ?? 0) + value);
      units += Math.max(1, Number(sale.quantity || 1));
      if (sale.customer_id) customerIds.add(sale.customer_id);
      if (sale.payment_status === "paid") {
        paid.set(sale.currency, (paid.get(sale.currency) ?? 0) + value);
      }
    }

    for (const sale of departmentSales) {
      if ((sale.payment_status === "unpaid" || sale.payment_status === "partial") && sale.status !== "cancelled") {
        outstanding.set(sale.currency, (outstanding.get(sale.currency) ?? 0) + saleValue(sale));
      }
    }

    const lastSale = departmentSales
      .slice()
      .sort((a, b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime())[0]?.sale_date ?? null;

    return {
      department,
      services: departmentServices,
      sales: departmentSales,
      wonSales,
      customers: customers.filter((customer) => customerIds.has(customer.id)),
      revenue,
      paid,
      outstanding,
      units,
      lastSale,
    };
  }), [departments, services, sales, customers]);

  const totals = useMemo(() => {
    const revenue = new Map<string, number>();
    const paid = new Map<string, number>();
    const outstanding = new Map<string, number>();
    for (const item of insights) {
      for (const [currency, value] of item.revenue) revenue.set(currency, (revenue.get(currency) ?? 0) + value);
      for (const [currency, value] of item.paid) paid.set(currency, (paid.get(currency) ?? 0) + value);
      for (const [currency, value] of item.outstanding) outstanding.set(currency, (outstanding.get(currency) ?? 0) + value);
    }
    return {
      revenue,
      paid,
      outstanding,
      active: departments.filter((department) => department.is_active).length,
      withServices: insights.filter((item) => item.services.length > 0).length,
      withSales: insights.filter((item) => item.wonSales.length > 0).length,
      units: insights.reduce((sum, item) => sum + item.units, 0),
    };
  }, [departments, insights]);

  const primaryCurrency = [...totals.revenue.keys()][0] || "NGN";

  const filteredInsights = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return insights;
    return insights.filter((item) =>
      item.department.name.toLowerCase().includes(query) ||
      item.department.slug.toLowerCase().includes(query) ||
      (item.department.description ?? "").toLowerCase().includes(query) ||
      item.services.some((service) => service.name.toLowerCase().includes(query))
    );
  }, [insights, search]);

  const selectedInsight = selectedDepartment
    ? insights.find((item) => item.department.id === selectedDepartment.id)
    : null;

  function openCreateForm() {
    setEditingDepartment(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function openEditForm(department: Department) {
    setEditingDepartment(department);
    setForm({
      name: department.name,
      description: department.description ?? "",
      icon: department.icon ?? "",
      is_active: department.is_active ?? true,
    });
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;
    setShowForm(false);
    setEditingDepartment(null);
    setForm(emptyForm);
  }

  async function saveDepartment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) {
      setError("Department name is required.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const isEditing = Boolean(editingDepartment);
      const response = await fetch(
        isEditing ? `/api/departments/${editingDepartment?.id}` : "/api/departments",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            description: form.description.trim(),
            icon: form.icon.trim(),
            is_active: form.is_active,
          }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Failed to ${isEditing ? "update" : "create"} department.`);
      setSuccess(isEditing ? "Department updated successfully." : "Department created successfully.");
      setShowForm(false);
      setEditingDepartment(null);
      setForm(emptyForm);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save department.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleDepartment(department: Department) {
    try {
      setError("");
      setSuccess("");
      const response = await fetch(`/api/departments/${department.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !department.is_active }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to update department status.");
      setSuccess(result.department.is_active ? `${department.name} is now active.` : `${department.name} is now inactive.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update department status.");
    }
  }

  async function deleteDepartment(department: Department) {
    if (!window.confirm(`Delete "${department.name}"?\n\nThis cannot be undone. If services are assigned to this department, the system will prevent deletion.`)) return;
    try {
      setDeletingId(department.id);
      setError("");
      setSuccess("");
      const response = await fetch(`/api/departments/${department.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to delete department.");
      setSuccess("Department deleted successfully.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete department.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="min-h-full space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Business</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Department intelligence</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">See how each department connects to services, customers, sales, revenue, payments, and operational activity.</p>
        </div>
        <button type="button" onClick={openCreateForm} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800">+ Add department</button>
      </header>

      {(error || success) && (
        <div role={error ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {error || success}
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ["Departments", departments.length],
          ["Active", totals.active],
          ["With services", totals.withServices],
          ["With sales", totals.withSales],
          ["Units sold", totals.units],
        ].map(([labelText, value]) => (
          <div key={String(labelText)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{labelText}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-950">Department revenue overview</h2>
          <p className="mt-1 text-xs text-slate-500">Revenue is calculated from won sales connected to services owned by each department.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Confirmed revenue</p><p className="mt-1 text-lg font-semibold text-slate-950">{money(totals.revenue.get(primaryCurrency) ?? 0, primaryCurrency)}</p></div>
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Paid revenue</p><p className="mt-1 text-lg font-semibold text-slate-950">{money(totals.paid.get(primaryCurrency) ?? 0, primaryCurrency)}</p></div>
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Outstanding</p><p className="mt-1 text-lg font-semibold text-slate-950">{money(totals.outstanding.get(primaryCurrency) ?? 0, primaryCurrency)}</p></div>
          </div>
          {totals.revenue.size > 0 && <div className="mt-4 flex flex-wrap gap-2">{[...totals.revenue.entries()].map(([currency, value]) => <span key={currency} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600">{currency}: {money(value, currency)}</span>)}</div>}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-950">Department performance</h2>
          <div className="mt-4 space-y-3">
            {insights.filter((item) => (item.revenue.get(primaryCurrency) ?? 0) > 0).sort((a, b) => (b.revenue.get(primaryCurrency) ?? 0) - (a.revenue.get(primaryCurrency) ?? 0)).slice(0, 5).map((item) => (
              <button key={item.department.id} type="button" onClick={() => setSelectedDepartment(item.department)} className="flex w-full items-center justify-between gap-3 text-left">
                <span className="truncate text-sm font-medium text-slate-700">{item.department.name}</span>
                <span className="shrink-0 text-sm font-semibold text-slate-950">{money(item.revenue.get(primaryCurrency) ?? 0, primaryCurrency)}</span>
              </button>
            ))}
            {insights.filter((item) => (item.revenue.get(primaryCurrency) ?? 0) > 0).length === 0 && <p className="text-sm text-slate-500">No won sales are connected to departments yet.</p>}
          </div>
        </div>
      </section>

      {showForm && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-6"><h2 className="text-lg font-semibold text-slate-950">{editingDepartment ? "Edit department" : "Create department"}</h2><p className="mt-1 text-sm text-slate-500">Keep the organizational structure connected to your operating data.</p></div>
          <form onSubmit={saveDepartment} className="grid gap-5 md:grid-cols-2">
            <div><label className="mb-2 block text-sm font-medium text-slate-700">Department name</label><input value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} required placeholder="e.g. Sales" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500" /></div>
            <div><label className="mb-2 block text-sm font-medium text-slate-700">Icon</label><input value={form.icon} onChange={(e) => setForm((current) => ({ ...current, icon: e.target.value }))} placeholder="e.g. sales" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500" /></div>
            <div className="md:col-span-2"><label className="mb-2 block text-sm font-medium text-slate-700">Description</label><textarea value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} rows={3} placeholder="What does this department handle?" className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500" /></div>
            <label className="flex items-center gap-3 md:col-span-2"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm((current) => ({ ...current, is_active: e.target.checked }))} className="h-4 w-4" /><span className="text-sm font-medium text-slate-700">Department is active</span></label>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end md:col-span-2"><button type="button" onClick={closeForm} disabled={saving} className="min-h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700">Cancel</button><button type="submit" disabled={saving} className="min-h-11 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving..." : editingDepartment ? "Save changes" : "Create department"}</button></div>
          </form>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-lg font-semibold text-slate-950">Department performance</h2><p className="mt-1 text-sm text-slate-500">{departments.length} department{departments.length === 1 ? "" : "s"} in your organization.</p></div><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search departments or services..." className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 lg:max-w-sm" /></div></div>
        <div className="overflow-x-auto">
          {loading ? <div className="flex min-h-[300px] items-center justify-center text-sm text-slate-500">Loading department intelligence...</div> : filteredInsights.length === 0 ? <div className="px-6 py-12 text-center"><h3 className="text-base font-semibold text-slate-950">{search ? "No matching departments" : "No departments yet"}</h3><p className="mt-2 text-sm text-slate-500">{search ? "Try a different search term." : "Create your first department to start building your company structure."}</p></div> : (
            <table className="w-full min-w-[1050px]">
              <thead><tr className="border-b border-slate-200 bg-slate-50 text-left"><th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Department</th><th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Services</th><th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Customers</th><th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Units</th><th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Revenue</th><th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Paid</th><th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Outstanding</th><th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Last sale</th><th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{filteredInsights.map((item) => (
                <tr key={item.department.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-4"><button type="button" onClick={() => setSelectedDepartment(item.department)} className="text-left"><p className="font-medium text-slate-950">{item.department.name}</p><p className="mt-0.5 text-xs text-slate-500">{item.department.is_active ? "Active" : "Inactive"} · {item.department.slug}</p></button></td>
                  <td className="px-5 py-4 text-sm font-medium text-slate-800">{item.services.length}</td>
                  <td className="px-5 py-4 text-sm font-medium text-slate-800">{item.customers.length}</td>
                  <td className="px-5 py-4 text-sm text-slate-700">{item.units}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-slate-950">{money(item.revenue.get(primaryCurrency) ?? 0, primaryCurrency)}</td>
                  <td className="px-5 py-4 text-sm text-slate-700">{money(item.paid.get(primaryCurrency) ?? 0, primaryCurrency)}</td>
                  <td className="px-5 py-4 text-sm text-slate-700">{(item.outstanding.get(primaryCurrency) ?? 0) > 0 ? money(item.outstanding.get(primaryCurrency) ?? 0, primaryCurrency) : "—"}</td>
                  <td className="px-5 py-4 text-sm text-slate-500">{dateLabel(item.lastSale)}</td>
                  <td className="px-5 py-4"><div className="flex justify-end gap-1"><button type="button" onClick={() => setSelectedDepartment(item.department)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">View</button><button type="button" onClick={() => openEditForm(item.department)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">Edit</button><button type="button" onClick={() => void toggleDepartment(item.department)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">{item.department.is_active ? "Deactivate" : "Activate"}</button><button type="button" onClick={() => void deleteDepartment(item.department)} disabled={deletingId === item.department.id} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 disabled:opacity-50">{deletingId === item.department.id ? "Deleting..." : "Delete"}</button></div></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </section>

      {selectedInsight && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-6">
          <button type="button" aria-label="Close department intelligence" className="absolute inset-0" onClick={() => setSelectedDepartment(null)} />
          <div className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-5xl sm:rounded-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4"><div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Department intelligence</p><h2 className="mt-1 text-xl font-semibold text-slate-950">{selectedInsight.department.name}</h2><p className="mt-0.5 text-sm text-slate-500">{selectedInsight.services.length} service{selectedInsight.services.length === 1 ? "" : "s"} · {selectedInsight.department.is_active ? "Active" : "Inactive"}</p></div><button type="button" onClick={() => setSelectedDepartment(null)} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100">Close</button></div>
            <div className="space-y-5 p-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Services</p><p className="mt-1 text-xl font-semibold">{selectedInsight.services.length}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Customers</p><p className="mt-1 text-xl font-semibold">{selectedInsight.customers.length}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Units</p><p className="mt-1 text-xl font-semibold">{selectedInsight.units}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Revenue</p><p className="mt-1 text-xl font-semibold">{money(selectedInsight.revenue.get(primaryCurrency) ?? 0, primaryCurrency)}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Outstanding</p><p className="mt-1 text-xl font-semibold">{money(selectedInsight.outstanding.get(primaryCurrency) ?? 0, primaryCurrency)}</p></div></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4"><h3 className="text-sm font-semibold text-slate-950">Services in this department</h3><div className="mt-3 space-y-2">{selectedInsight.services.length ? selectedInsight.services.map((service) => <div key={service.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"><div><p className="text-sm font-medium text-slate-800">{service.name}</p><p className="text-xs text-slate-500">{label(service.status)}</p></div><span className="text-xs text-slate-600">{service.price === null ? "Custom" : money(Number(service.price), service.currency)}</span></div>) : <p className="text-sm text-slate-500">No services are assigned to this department yet.</p>}</div></div>
                <div className="rounded-xl border border-slate-200 p-4"><h3 className="text-sm font-semibold text-slate-950">Department signals</h3><div className="mt-3 space-y-2 text-sm text-slate-600"><p>Won sales: <span className="font-medium text-slate-900">{selectedInsight.wonSales.length}</span></p><p>Total sales records: <span className="font-medium text-slate-900">{selectedInsight.sales.length}</span></p><p>Last sale: <span className="font-medium text-slate-900">{dateLabel(selectedInsight.lastSale)}</span></p><p>Paid revenue: <span className="font-medium text-slate-900">{money(selectedInsight.paid.get(primaryCurrency) ?? 0, primaryCurrency)}</span></p></div></div>
              </div>
              <div><h3 className="mb-3 text-sm font-semibold text-slate-950">Customers connected through department services</h3>{selectedInsight.customers.length ? <div className="grid gap-2 sm:grid-cols-2">{selectedInsight.customers.map((customer) => <div key={customer.id} className="rounded-xl border border-slate-200 px-4 py-3"><p className="text-sm font-medium text-slate-800">{customer.name}</p>{customer.company_name && <p className="text-xs text-slate-500">{customer.company_name}</p>}</div>)}</div> : <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No confirmed customers connected yet.</p>}</div>
              <div><h3 className="mb-3 text-sm font-semibold text-slate-950">Sales activity</h3>{selectedInsight.sales.length ? <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[760px]"><thead className="bg-slate-50"><tr><th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-slate-500">Date</th><th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-slate-500">Service</th><th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-slate-500">Customer</th><th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-slate-500">Value</th><th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-slate-500">Sale</th><th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-slate-500">Payment</th></tr></thead><tbody className="divide-y divide-slate-100">{selectedInsight.sales.map((sale) => <tr key={sale.id}><td className="px-4 py-3 text-sm text-slate-500">{dateLabel(sale.sale_date)}</td><td className="px-4 py-3 text-sm text-slate-700">{selectedInsight.services.find((service) => service.id === sale.service_id)?.name || "Unknown service"}</td><td className="px-4 py-3 text-sm text-slate-700">{customers.find((customer) => customer.id === sale.customer_id)?.name || "Unknown customer"}</td><td className="px-4 py-3 text-sm font-semibold text-slate-950">{money(saleValue(sale), sale.currency)}</td><td className="px-4 py-3 text-xs text-slate-600">{label(sale.status)}</td><td className="px-4 py-3 text-xs text-slate-600">{label(sale.payment_status)}</td></tr>)}</tbody></table></div> : <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No sales connected to this department yet.</p>}</div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
