'use client'

import { useEffect, useMemo, useState } from 'react'

type Department = { id: string; name: string }
type Customer = { id: string; name: string; company_name: string | null }
type Sale = {
  id: string
  customer_id: string | null
  service_id: string | null
  amount: number
  currency: string
  quantity: number
  status: 'draft' | 'pending' | 'won' | 'lost' | 'cancelled'
  payment_status: 'unpaid' | 'partial' | 'paid' | 'refunded'
  sale_date: string
}

type Service = {
  id: string
  organization_id: string
  department_id: string | null
  name: string
  slug: string
  description: string | null
  category: string | null
  price: number | null
  currency: string
  billing_type: 'one_time' | 'monthly' | 'yearly' | 'custom'
  status: 'active' | 'inactive' | 'draft'
  is_active: boolean
  sort_order: number
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

type ServiceForm = {
  name: string
  description: string
  category: string
  price: string
  currency: string
  billing_type: Service['billing_type']
  status: Service['status']
  department_id: string
}

type ServiceInsight = {
  service: Service
  sales: Sale[]
  wonSales: Sale[]
  customers: Customer[]
  revenue: Map<string, number>
  paidRevenue: Map<string, number>
  outstanding: Map<string, number>
  units: number
  lastSale: string | null
}

const emptyForm: ServiceForm = {
  name: '',
  description: '',
  category: '',
  price: '',
  currency: 'NGN',
  billing_type: 'one_time',
  status: 'active',
  department_id: '',
}

function valueOf(sale: Sale) {
  return Number(sale.amount || 0) * Math.max(1, Number(sale.quantity || 1))
}

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency || 'NGN',
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return `${currency || 'NGN'} ${value.toLocaleString()}`
  }
}

function dateLabel(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function title(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<ServiceForm>(emptyForm)
  const [editingService, setEditingService] = useState<Service | null>(null)

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const responses = await Promise.all([
        fetch('/api/services', { cache: 'no-store' }),
        fetch('/api/departments', { cache: 'no-store' }),
        fetch('/api/customers', { cache: 'no-store' }),
        fetch('/api/sales', { cache: 'no-store' }),
      ])
      const results = await Promise.all(responses.map((response) => response.json()))
      if (responses.some((response) => !response.ok)) {
        throw new Error(results.find((result, index) => !responses[index].ok)?.error || 'Unable to load service intelligence')
      }
      if (!results[0].success || !results[1].success || !results[2].success || !results[3].success) {
        throw new Error('Unable to load service intelligence')
      }
      setServices(results[0].services ?? [])
      setDepartments(results[1].departments ?? [])
      setCustomers(results[2].customers ?? [])
      setSales(results[3].sales ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load service intelligence')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadData() }, [])

  function updateForm<K extends keyof ServiceForm>(field: K, value: ServiceForm[K]) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function resetForm() {
    setForm(emptyForm)
    setEditingService(null)
    setShowForm(false)
    setError('')
  }

  function startEditing(service: Service) {
    setEditingService(service)
    setForm({
      name: service.name,
      description: service.description ?? '',
      category: service.category ?? '',
      price: service.price === null ? '' : String(service.price),
      currency: service.currency || 'NGN',
      billing_type: service.billing_type,
      status: service.status,
      department_id: service.department_id ?? '',
    })
    setError('')
    setSuccess('')
    setShowForm(true)
  }

  async function submitService(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.name.trim()) {
      setError('Service name is required.')
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const editing = Boolean(editingService)
      const response = await fetch(editing ? `/api/services/${editingService?.id}` : '/api/services', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          category: form.category.trim(),
          price: form.price,
          currency: form.currency,
          billing_type: form.billing_type,
          status: form.status,
          department_id: form.department_id || null,
          is_active: form.status === 'active',
        }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || 'Unable to save service')
      setShowForm(false)
      setEditingService(null)
      setForm(emptyForm)
      setSuccess(editing ? 'Service updated successfully.' : 'Service created successfully.')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save service')
    } finally {
      setSaving(false)
    }
  }

  async function deleteService(service: Service) {
    if (!window.confirm(`Delete "${service.name}"? This action cannot be undone.`)) return
    setDeletingId(service.id)
    setError('')
    try {
      const response = await fetch(`/api/services/${service.id}`, { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || 'Unable to delete service')
      if (selectedService?.id === service.id) setSelectedService(null)
      setSuccess('Service deleted successfully.')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete service')
    } finally {
      setDeletingId(null)
    }
  }

  const insights = useMemo<ServiceInsight[]>(() => services.map((service) => {
    const serviceSales = sales.filter((sale) => sale.service_id === service.id)
    const wonSales = serviceSales.filter((sale) => sale.status === 'won')
    const revenue = new Map<string, number>()
    const paidRevenue = new Map<string, number>()
    const outstanding = new Map<string, number>()
    const customerIds = new Set<string>()
    let units = 0
    for (const sale of wonSales) {
      const value = valueOf(sale)
      revenue.set(sale.currency, (revenue.get(sale.currency) ?? 0) + value)
      units += Math.max(1, Number(sale.quantity || 1))
      if (sale.customer_id) customerIds.add(sale.customer_id)
      if (sale.payment_status === 'paid') paidRevenue.set(sale.currency, (paidRevenue.get(sale.currency) ?? 0) + value)
    }
    for (const sale of serviceSales) {
      if ((sale.payment_status === 'unpaid' || sale.payment_status === 'partial') && sale.status !== 'cancelled') {
        outstanding.set(sale.currency, (outstanding.get(sale.currency) ?? 0) + valueOf(sale))
      }
    }
    const lastSale = serviceSales.slice().sort((a, b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime())[0]?.sale_date ?? null
    return {
      service,
      sales: serviceSales,
      wonSales,
      customers: customers.filter((customer) => customerIds.has(customer.id)),
      revenue,
      paidRevenue,
      outstanding,
      units,
      lastSale,
    }
  }), [services, sales, customers])

  const totals = useMemo(() => {
    const revenue = new Map<string, number>()
    const paid = new Map<string, number>()
    const outstanding = new Map<string, number>()
    for (const item of insights) {
      for (const [currency, value] of item.revenue) revenue.set(currency, (revenue.get(currency) ?? 0) + value)
      for (const [currency, value] of item.paidRevenue) paid.set(currency, (paid.get(currency) ?? 0) + value)
      for (const [currency, value] of item.outstanding) outstanding.set(currency, (outstanding.get(currency) ?? 0) + value)
    }
    return {
      revenue, paid, outstanding,
      active: services.filter((service) => service.status === 'active').length,
      withSales: insights.filter((item) => item.wonSales.length > 0).length,
      units: insights.reduce((sum, item) => sum + item.units, 0),
    }
  }, [insights, services])

  const primaryCurrency = [...totals.revenue.keys()][0] || 'NGN'
  const filteredServices = useMemo(() => {
    const term = search.trim().toLowerCase()
    return insights.filter((item) => !term ||
      item.service.name.toLowerCase().includes(term) ||
      item.service.description?.toLowerCase().includes(term) ||
      item.service.category?.toLowerCase().includes(term) ||
      customers.some((customer) => item.customers.some((related) => related.id === customer.id) && customer.name.toLowerCase().includes(term))
    )
  }, [insights, search, customers])

  const selectedInsight = selectedService ? insights.find((item) => item.service.id === selectedService.id) : null

  function departmentName(id: string | null) {
    return id ? departments.find((department) => department.id === id)?.name ?? 'Unassigned' : 'Unassigned'
  }

  function formatPrice(service: Service) {
    if (service.price === null) return 'Custom pricing'
    return money(Number(service.price), service.currency || 'NGN')
  }

  function billingLabel(type: Service['billing_type']) {
    return type === 'monthly' ? 'Monthly' : type === 'yearly' ? 'Yearly' : type === 'custom' ? 'Custom' : 'One-time'
  }

  function statusClasses(status: Service['status']) {
    return status === 'active'
      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
      : status === 'draft'
        ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
        : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
  }

  return (
    <main className="min-h-full space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Business</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Service intelligence</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Manage the service catalog and see customers, sales, units, revenue, payments, and transaction activity connected to every service.</p>
        </div>
        <button type="button" onClick={() => { if (showForm) resetForm(); else { setEditingService(null); setForm(emptyForm); setError(''); setShowForm(true) } }} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800">
          {showForm ? 'Close form' : '+ Add service'}
        </button>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ['Services', services.length],
          ['Active', totals.active],
          ['With sales', totals.withSales],
          ['Units sold', totals.units],
          ['Customers reached', new Set(insights.flatMap((item) => item.customers.map((customer) => customer.id))).size],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-950">Service revenue overview</h2>
          <p className="mt-1 text-xs text-slate-500">Confirmed revenue is based on won sales. Payment figures are shown separately.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Confirmed revenue</p><p className="mt-1 text-lg font-semibold text-slate-950">{money(totals.revenue.get(primaryCurrency) ?? 0, primaryCurrency)}</p></div>
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Paid revenue</p><p className="mt-1 text-lg font-semibold text-slate-950">{money(totals.paid.get(primaryCurrency) ?? 0, primaryCurrency)}</p></div>
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Outstanding</p><p className="mt-1 text-lg font-semibold text-slate-950">{money(totals.outstanding.get(primaryCurrency) ?? 0, primaryCurrency)}</p></div>
          </div>
          {totals.revenue.size > 0 && <div className="mt-4 flex flex-wrap gap-2">{[...totals.revenue.entries()].map(([currency, value]) => <span key={currency} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600">{currency}: {money(value, currency)}</span>)}</div>}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-950">Top services</h2>
          <div className="mt-4 space-y-3">
            {insights.filter((item) => (item.revenue.get(primaryCurrency) ?? 0) > 0).sort((a, b) => (b.revenue.get(primaryCurrency) ?? 0) - (a.revenue.get(primaryCurrency) ?? 0)).slice(0, 5).map((item, index) => (
              <button key={item.service.id} type="button" onClick={() => setSelectedService(item.service)} className="flex w-full items-center justify-between gap-3 text-left">
                <span className="truncate text-sm font-medium text-slate-700">{index + 1}. {item.service.name}</span>
                <span className="shrink-0 text-sm font-semibold text-slate-950">{money(item.revenue.get(primaryCurrency) ?? 0, primaryCurrency)}</span>
              </button>
            ))}
            {insights.filter((item) => (item.revenue.get(primaryCurrency) ?? 0) > 0).length === 0 && <p className="text-sm text-slate-500">No won service sales yet.</p>}
          </div>
        </div>
      </section>

      {showForm && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-6"><h2 className="text-lg font-semibold text-slate-950">{editingService ? 'Edit service' : 'Create service'}</h2><p className="mt-1 text-sm text-slate-500">{editingService ? 'Update the service information below.' : 'Add a real service to your organization.'}</p></div>
          <form onSubmit={submitService} className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2"><label className="mb-2 block text-sm font-medium text-slate-700">Service name</label><input value={form.name} onChange={(e) => updateForm('name', e.target.value)} required placeholder="e.g. AI Business Automation" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></div>
            <div className="md:col-span-2"><label className="mb-2 block text-sm font-medium text-slate-700">Description</label><textarea value={form.description} onChange={(e) => updateForm('description', e.target.value)} rows={4} placeholder="Describe what this service delivers." className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></div>
            <div><label className="mb-2 block text-sm font-medium text-slate-700">Category</label><input value={form.category} onChange={(e) => updateForm('category', e.target.value)} placeholder="e.g. AI, Consulting, Repair" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></div>
            <div><label className="mb-2 block text-sm font-medium text-slate-700">Department</label><select value={form.department_id} onChange={(e) => updateForm('department_id', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"><option value="">No department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></div>
            <div><label className="mb-2 block text-sm font-medium text-slate-700">Price</label><input type="number" min="0" step="0.01" value={form.price} onChange={(e) => updateForm('price', e.target.value)} placeholder="0.00" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" /></div>
            <div><label className="mb-2 block text-sm font-medium text-slate-700">Currency</label><select value={form.currency} onChange={(e) => updateForm('currency', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"><option value="NGN">NGN — Nigerian Naira</option><option value="USD">USD — US Dollar</option><option value="GBP">GBP — British Pound</option><option value="EUR">EUR — Euro</option></select></div>
            <div><label className="mb-2 block text-sm font-medium text-slate-700">Billing type</label><select value={form.billing_type} onChange={(e) => updateForm('billing_type', e.target.value as Service['billing_type'])} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"><option value="one_time">One-time</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option><option value="custom">Custom</option></select></div>
            <div><label className="mb-2 block text-sm font-medium text-slate-700">Status</label><select value={form.status} onChange={(e) => updateForm('status', e.target.value as Service['status'])} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"><option value="active">Active</option><option value="draft">Draft</option><option value="inactive">Inactive</option></select></div>
            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end md:col-span-2"><button type="button" onClick={resetForm} disabled={saving} className="min-h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700">Cancel</button><button type="submit" disabled={saving} className="min-h-11 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white disabled:opacity-60">{saving ? (editingService ? 'Saving...' : 'Creating...') : (editingService ? 'Save changes' : 'Create service')}</button></div>
          </form>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-lg font-semibold text-slate-950">Service performance</h2><p className="mt-1 text-sm text-slate-500">{services.length} service{services.length === 1 ? '' : 's'} in your organization.</p></div><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search services or customers..." className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 lg:max-w-sm" /></div></div>
        <div className="overflow-x-auto">
          {loading ? <div className="flex min-h-[300px] items-center justify-center text-sm text-slate-500">Loading service intelligence...</div> : filteredServices.length === 0 ? <div className="px-6 py-12 text-center"><h3 className="text-base font-semibold text-slate-950">{search ? 'No services found' : 'No services yet'}</h3><p className="mt-2 text-sm text-slate-500">{search ? 'Try a different search term.' : 'Create your first service to start building your service catalog.'}</p></div> : (
            <table className="w-full min-w-[1050px]">
              <thead><tr className="border-b border-slate-200 bg-slate-50 text-left"><th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Service</th><th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Department</th><th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Customers</th><th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Units</th><th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Revenue</th><th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Paid</th><th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Outstanding</th><th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Last sale</th><th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{filteredServices.map((item) => {
                const revenue = item.revenue.get(primaryCurrency) ?? 0
                const paid = item.paidRevenue.get(primaryCurrency) ?? 0
                const outstanding = item.outstanding.get(primaryCurrency) ?? 0
                return <tr key={item.service.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-4"><button type="button" onClick={() => setSelectedService(item.service)} className="text-left"><p className="font-medium text-slate-950">{item.service.name}</p><p className="mt-0.5 text-xs text-slate-500">{item.service.category || 'Uncategorized'} · {item.service.status}</p></button></td>
                  <td className="px-5 py-4 text-sm text-slate-600">{departmentName(item.service.department_id)}</td>
                  <td className="px-5 py-4 text-sm font-medium text-slate-800">{item.customers.length}</td>
                  <td className="px-5 py-4 text-sm text-slate-700">{item.units}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-slate-950">{money(revenue, primaryCurrency)}</td>
                  <td className="px-5 py-4 text-sm text-slate-700">{money(paid, primaryCurrency)}</td>
                  <td className="px-5 py-4 text-sm text-slate-700">{outstanding > 0 ? money(outstanding, primaryCurrency) : '—'}</td>
                  <td className="px-5 py-4 text-sm text-slate-500">{dateLabel(item.lastSale)}</td>
                  <td className="px-5 py-4"><div className="flex justify-end gap-1"><button type="button" onClick={() => setSelectedService(item.service)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">View</button><button type="button" onClick={() => startEditing(item.service)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">Edit</button><button type="button" onClick={() => void deleteService(item.service)} disabled={deletingId === item.service.id} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 disabled:opacity-50">{deletingId === item.service.id ? 'Deleting...' : 'Delete'}</button></div></td>
                </tr>
              })}</tbody>
            </table>
          )}
        </div>
      </section>

      {selectedInsight && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-6">
        <button type="button" aria-label="Close service intelligence" className="absolute inset-0" onClick={() => setSelectedService(null)} />
        <div className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-4xl sm:rounded-2xl">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4"><div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Service intelligence</p><h2 className="mt-1 text-xl font-semibold text-slate-950">{selectedInsight.service.name}</h2><p className="mt-0.5 text-sm text-slate-500">{departmentName(selectedInsight.service.department_id)} · {billingLabel(selectedInsight.service.billing_type)}</p></div><button type="button" onClick={() => setSelectedService(null)} className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100">Close</button></div>
          <div className="space-y-5 p-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Customers</p><p className="mt-1 text-xl font-semibold text-slate-950">{selectedInsight.customers.length}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Units sold</p><p className="mt-1 text-xl font-semibold text-slate-950">{selectedInsight.units}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Revenue</p><p className="mt-1 text-xl font-semibold text-slate-950">{money(selectedInsight.revenue.get(primaryCurrency) ?? 0, primaryCurrency)}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Outstanding</p><p className="mt-1 text-xl font-semibold text-slate-950">{money(selectedInsight.outstanding.get(primaryCurrency) ?? 0, primaryCurrency)}</p></div></div>
            <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-xl border border-slate-200 p-4"><h3 className="text-sm font-semibold text-slate-950">Customers using this service</h3><div className="mt-3 space-y-2">{selectedInsight.customers.length ? selectedInsight.customers.map((customer) => <div key={customer.id} className="rounded-lg bg-slate-50 px-3 py-2"><p className="text-sm font-medium text-slate-800">{customer.name}</p>{customer.company_name && <p className="text-xs text-slate-500">{customer.company_name}</p>}</div>) : <p className="text-sm text-slate-500">No confirmed customers yet.</p>}</div></div><div className="rounded-xl border border-slate-200 p-4"><h3 className="text-sm font-semibold text-slate-950">Service signals</h3><div className="mt-3 space-y-2 text-sm text-slate-600"><p>Price: <span className="font-medium text-slate-900">{formatPrice(selectedInsight.service)}</span></p><p>Status: <span className="font-medium text-slate-900">{title(selectedInsight.service.status)}</span></p><p>Last sale: <span className="font-medium text-slate-900">{dateLabel(selectedInsight.lastSale)}</span></p><p>Sales records: <span className="font-medium text-slate-900">{selectedInsight.sales.length}</span></p></div></div></div>
            <div><h3 className="mb-3 text-sm font-semibold text-slate-950">Sales history</h3>{selectedInsight.sales.length ? <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[700px]"><thead className="bg-slate-50"><tr><th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-slate-500">Date</th><th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-slate-500">Customer</th><th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-slate-500">Value</th><th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-slate-500">Sale</th><th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-slate-500">Payment</th></tr></thead><tbody className="divide-y divide-slate-100">{selectedInsight.sales.map((sale) => <tr key={sale.id}><td className="px-4 py-3 text-sm text-slate-500">{dateLabel(sale.sale_date)}</td><td className="px-4 py-3 text-sm text-slate-700">{customers.find((customer) => customer.id === sale.customer_id)?.name || 'Unknown customer'}</td><td className="px-4 py-3 text-sm font-semibold text-slate-950">{money(valueOf(sale), sale.currency)}</td><td className="px-4 py-3"><span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">{title(sale.status)}</span></td><td className="px-4 py-3"><span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">{title(sale.payment_status)}</span></td></tr>)}</tbody></table></div> : <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No sales connected to this service yet.</p>}</div>
          </div>
        </div>
      </div>}
    </main>
  )
}
