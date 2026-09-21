'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  Check,
  ChevronDown,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react'

type SaleStatus =
  | 'draft'
  | 'pending'
  | 'won'
  | 'lost'
  | 'cancelled'

type PaymentStatus =
  | 'unpaid'
  | 'partial'
  | 'paid'
  | 'refunded'

type Customer = {
  id: string
  name: string
  email: string | null
  company_name: string | null
  status: string
}

type Service = {
  id: string
  name: string
  price: number | null
  currency: string
  billing_type: string
  status: string
}

type Sale = {
  id: string
  organization_id: string
  customer_id: string | null
  service_id: string | null
  amount: number
  currency: string
  quantity: number
  status: SaleStatus
  payment_status: PaymentStatus
  sale_date: string
  notes: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  customer?: Customer | null
  service?: Service | null
}

type SaleForm = {
  customer_id: string
  service_id: string
  amount: string
  currency: string
  quantity: string
  status: SaleStatus
  payment_status: PaymentStatus
  sale_date: string
  notes: string
}

const SALE_STATUSES: SaleStatus[] = [
  'draft',
  'pending',
  'won',
  'lost',
  'cancelled',
]

const PAYMENT_STATUSES: PaymentStatus[] = [
  'unpaid',
  'partial',
  'paid',
  'refunded',
]

const EMPTY_FORM: SaleForm = {
  customer_id: '',
  service_id: '',
  amount: '',
  currency: 'NGN',
  quantity: '1',
  status: 'pending',
  payment_status: 'unpaid',
  sale_date: new Date().toISOString().slice(0, 10),
  notes: '',
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency || 'NGN',
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency || 'NGN'} ${amount.toLocaleString()}`
  }
}

function formatDate(value: string) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function statusClasses(status: SaleStatus) {
  switch (status) {
    case 'won':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'pending':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'lost':
      return 'bg-red-50 text-red-700 border-red-200'
    case 'cancelled':
      return 'bg-gray-100 text-gray-600 border-gray-200'
    default:
      return 'bg-blue-50 text-blue-700 border-blue-200'
  }
}

function paymentClasses(status: PaymentStatus) {
  switch (status) {
    case 'paid':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'partial':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'refunded':
      return 'bg-red-50 text-red-700 border-red-200'
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200'
  }
}

function titleCase(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [services, setServices] = useState<Service[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editingSale, setEditingSale] = useState<Sale | null>(null)

  const [form, setForm] = useState<SaleForm>(EMPTY_FORM)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | SaleStatus>(
    'all',
  )
  const [paymentFilter, setPaymentFilter] = useState<
    'all' | PaymentStatus
  >('all')

  const [notice, setNotice] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  function showNotice(
    type: 'success' | 'error',
    message: string,
  ) {
    setNotice({ type, message })

    window.setTimeout(() => {
      setNotice(null)
    }, 3500)
  }

  async function loadData() {
    setLoading(true)

    try {
      const [salesResponse, customersResponse, servicesResponse] =
        await Promise.all([
          fetch('/api/sales', {
            cache: 'no-store',
          }),
          fetch('/api/customers', {
            cache: 'no-store',
          }),
          fetch('/api/services', {
            cache: 'no-store',
          }),
        ])

      const salesData = await salesResponse.json()
      const customersData = await customersResponse.json()
      const servicesData = await servicesResponse.json()

      if (!salesResponse.ok) {
        throw new Error(
          salesData?.error || 'Failed to load sales.',
        )
      }

      if (!customersResponse.ok) {
        throw new Error(
          customersData?.error || 'Failed to load customers.',
        )
      }

      if (!servicesResponse.ok) {
        throw new Error(
          servicesData?.error || 'Failed to load services.',
        )
      }

      setSales(
        Array.isArray(salesData?.sales)
          ? salesData.sales
          : Array.isArray(salesData)
            ? salesData
            : [],
      )

      setCustomers(
        Array.isArray(customersData?.customers)
          ? customersData.customers
          : Array.isArray(customersData)
            ? customersData
            : [],
      )

      setServices(
        Array.isArray(servicesData?.services)
          ? servicesData.services
          : Array.isArray(servicesData)
            ? servicesData
            : [],
      )
    } catch (error) {
      showNotice(
        'error',
        error instanceof Error
          ? error.message
          : 'Failed to load sales data.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const filteredSales = useMemo(() => {
    const query = search.trim().toLowerCase()

    return sales.filter((sale) => {
      const customerName =
        sale.customer?.name ||
        customers.find((customer) => customer.id === sale.customer_id)
          ?.name ||
        ''

      const serviceName =
        sale.service?.name ||
        services.find((service) => service.id === sale.service_id)
          ?.name ||
        ''

      const matchesSearch =
        !query ||
        customerName.toLowerCase().includes(query) ||
        serviceName.toLowerCase().includes(query) ||
        sale.notes?.toLowerCase().includes(query) ||
        sale.status.toLowerCase().includes(query) ||
        sale.payment_status.toLowerCase().includes(query)

      const matchesStatus =
        statusFilter === 'all' || sale.status === statusFilter

      const matchesPayment =
        paymentFilter === 'all' ||
        sale.payment_status === paymentFilter

      return matchesSearch && matchesStatus && matchesPayment
    })
  }, [
    sales,
    customers,
    services,
    search,
    statusFilter,
    paymentFilter,
  ])

  const metrics = useMemo(() => {
    const total = sales.length

    const won = sales.filter((sale) => sale.status === 'won')

    const pending = sales.filter(
      (sale) => sale.status === 'pending',
    )

    const paid = sales.filter(
      (sale) => sale.payment_status === 'paid',
    )

    const wonRevenue = won.reduce(
      (sum, sale) => sum + sale.amount * sale.quantity,
      0,
    )

    const paidRevenue = paid.reduce(
      (sum, sale) => sum + sale.amount * sale.quantity,
      0,
    )

    return {
      total,
      won: won.length,
      pending: pending.length,
      wonRevenue,
      paidRevenue,
    }
  }, [sales])

  function openCreateForm() {
    setEditingSale(null)
    setForm({
      ...EMPTY_FORM,
      sale_date: new Date().toISOString().slice(0, 10),
    })
    setShowForm(true)
  }

  function openEditForm(sale: Sale) {
    setEditingSale(sale)

    setForm({
      customer_id: sale.customer_id || '',
      service_id: sale.service_id || '',
      amount: String(sale.amount ?? ''),
      currency: sale.currency || 'NGN',
      quantity: String(sale.quantity ?? 1),
      status: sale.status,
      payment_status: sale.payment_status,
      sale_date: sale.sale_date
        ? new Date(sale.sale_date).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      notes: sale.notes || '',
    })

    setShowForm(true)
  }

  function closeForm() {
    if (saving) return

    setShowForm(false)
    setEditingSale(null)
    setForm(EMPTY_FORM)
  }

  function handleServiceChange(serviceId: string) {
    const service = services.find(
      (item) => item.id === serviceId,
    )

    setForm((current) => ({
      ...current,
      service_id: serviceId,
      amount:
        service?.price !== null &&
        service?.price !== undefined &&
        current.amount.trim() === ''
          ? String(service.price)
          : current.amount,
      currency: service?.currency || current.currency || 'NGN',
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!form.customer_id) {
      showNotice('error', 'Please select a customer.')
      return
    }

    if (!form.amount.trim()) {
      showNotice('error', 'Please enter the sale amount.')
      return
    }

    const amount = Number(form.amount)
    const quantity = Number(form.quantity)

    if (!Number.isFinite(amount) || amount < 0) {
      showNotice('error', 'Enter a valid sale amount.')
      return
    }

    if (
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      showNotice('error', 'Quantity must be at least 1.')
      return
    }

    setSaving(true)

    try {
      const payload = {
        customer_id: form.customer_id || null,
        service_id: form.service_id || null,
        amount,
        currency: form.currency.trim() || 'NGN',
        quantity,
        status: form.status,
        payment_status: form.payment_status,
        sale_date: form.sale_date
          ? new Date(
              `${form.sale_date}T00:00:00`,
            ).toISOString()
          : new Date().toISOString(),
        notes: form.notes.trim() || null,
      }

      const response = await fetch(
        editingSale
          ? `/api/sales/${editingSale.id}`
          : '/api/sales',
        {
          method: editingSale ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data?.error ||
            (editingSale
              ? 'Failed to update sale.'
              : 'Failed to create sale.'),
        )
      }

      showNotice(
        'success',
        editingSale
          ? 'Sale updated successfully.'
          : 'Sale created successfully.',
      )

      closeForm()
      await loadData()
    } catch (error) {
      showNotice(
        'error',
        error instanceof Error
          ? error.message
          : 'Something went wrong.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function deleteSale(sale: Sale) {
    const customerName =
      sale.customer?.name ||
      customers.find(
        (customer) => customer.id === sale.customer_id,
      )?.name ||
      'this customer'

    const confirmed = window.confirm(
      `Delete the sale for ${customerName}? This action cannot be undone.`,
    )

    if (!confirmed) return

    try {
      const response = await fetch(`/api/sales/${sale.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data?.error || 'Failed to delete sale.',
        )
      }

      showNotice('success', 'Sale deleted successfully.')
      await loadData()
    } catch (error) {
      showNotice(
        'error',
        error instanceof Error
          ? error.message
          : 'Failed to delete sale.',
      )
    }
  }

  function getCustomer(sale: Sale) {
    return (
      sale.customer ||
      customers.find(
        (customer) => customer.id === sale.customer_id,
      ) ||
      null
    )
  }

  function getService(sale: Sale) {
    return (
      sale.service ||
      services.find(
        (service) => service.id === sale.service_id,
      ) ||
      null
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {notice && (
        <div className="fixed right-4 top-4 z-[100] w-[calc(100%-2rem)] max-w-md">
          <div
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${
              notice.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {notice.type === 'success' ? (
                <Check className="h-5 w-5" />
              ) : (
                <X className="h-5 w-5" />
              )}
            </div>

            <p className="flex-1 text-sm font-medium">
              {notice.message}
            </p>

            <button
              type="button"
              onClick={() => setNotice(null)}
              className="shrink-0 rounded-md p-1 hover:bg-black/5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-white">
                <ShoppingCart className="h-5 w-5" />
              </div>

              <span className="text-sm font-medium text-gray-500">
                Business
              </span>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-gray-950">
              Sales
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Track customers, transactions, payments, and revenue.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800"
          >
            <Plus className="h-4 w-4" />
            New sale
          </button>
        </div>

        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Total sales
            </p>
            <p className="mt-2 text-2xl font-semibold text-gray-950">
              {metrics.total}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Won
            </p>
            <p className="mt-2 text-2xl font-semibold text-emerald-600">
              {metrics.won}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Pending
            </p>
            <p className="mt-2 text-2xl font-semibold text-amber-600">
              {metrics.pending}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Won revenue
            </p>
            <p className="mt-2 text-xl font-semibold text-gray-950">
              {formatMoney(metrics.wonRevenue, 'NGN')}
            </p>
          </div>

          <div className="col-span-2 rounded-2xl border border-gray-200 bg-white p-4 lg:col-span-1">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Paid revenue
            </p>
            <p className="mt-2 text-xl font-semibold text-gray-950">
              {formatMoney(metrics.paidRevenue, 'NGN')}
            </p>
          </div>
        </section>

        <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search customer, service, status..."
                className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 text-sm outline-none transition focus:border-gray-400 focus:bg-white"
              />
            </div>

            <div className="relative">
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as
                      | 'all'
                      | SaleStatus,
                  )
                }
                className="h-11 w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 pr-10 text-sm outline-none focus:border-gray-400 lg:min-w-[170px]"
              >
                <option value="all">All statuses</option>
                {SALE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {titleCase(status)}
                  </option>
                ))}
              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>

            <div className="relative">
              <select
                value={paymentFilter}
                onChange={(event) =>
                  setPaymentFilter(
                    event.target.value as
                      | 'all'
                      | PaymentStatus,
                  )
                }
                className="h-11 w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 pr-10 text-sm outline-none focus:border-gray-400 lg:min-w-[170px]"
              >
                <option value="all">All payments</option>
                {PAYMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {titleCase(status)}
                  </option>
                ))}
              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading sales...
              </div>
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
                <ShoppingCart className="h-6 w-6 text-gray-500" />
              </div>

              <h2 className="text-base font-semibold text-gray-950">
                No sales found
              </h2>

              <p className="mt-1 max-w-md text-sm text-gray-500">
                {search ||
                statusFilter !== 'all' ||
                paymentFilter !== 'all'
                  ? 'Try changing your filters or search.'
                  : 'Create your first sale to start tracking business revenue.'}
              </p>

              {!search &&
                statusFilter === 'all' &&
                paymentFilter === 'all' && (
                  <button
                    type="button"
                    onClick={openCreateForm}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
                  >
                    <Plus className="h-4 w-4" />
                    Create sale
                  </button>
                )}
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[950px]">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/70 text-left">
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Customer
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Service
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Amount
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Status
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Payment
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Date
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredSales.map((sale) => {
                      const customer = getCustomer(sale)
                      const service = getService(sale)

                      return (
                        <tr
                          key={sale.id}
                          className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
                        >
                          <td className="px-5 py-4">
                            <div className="font-medium text-gray-950">
                              {customer?.name || 'No customer'}
                            </div>

                            {customer?.company_name && (
                              <div className="mt-0.5 text-xs text-gray-500">
                                {customer.company_name}
                              </div>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <div className="text-sm text-gray-700">
                              {service?.name || 'No service'}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="font-semibold text-gray-950">
                              {formatMoney(
                                sale.amount * sale.quantity,
                                sale.currency,
                              )}
                            </div>

                            {sale.quantity > 1 && (
                              <div className="text-xs text-gray-500">
                                {sale.quantity} units
                              </div>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(
                                sale.status,
                              )}`}
                            >
                              {titleCase(sale.status)}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${paymentClasses(
                                sale.payment_status,
                              )}`}
                            >
                              {titleCase(sale.payment_status)}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-sm text-gray-500">
                            {formatDate(sale.sale_date)}
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  openEditForm(sale)
                                }
                                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-950"
                                title="Edit sale"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void deleteSale(sale)
                                }
                                className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"
                                title="Delete sale"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-gray-100 md:hidden">
                {filteredSales.map((sale) => {
                  const customer = getCustomer(sale)
                  const service = getService(sale)

                  return (
                    <div key={sale.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold text-gray-950">
                            {customer?.name || 'No customer'}
                          </h3>

                          <p className="mt-1 truncate text-sm text-gray-500">
                            {service?.name || 'No service'}
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="font-semibold text-gray-950">
                            {formatMoney(
                              sale.amount * sale.quantity,
                              sale.currency,
                            )}
                          </p>

                          {sale.quantity > 1 && (
                            <p className="text-xs text-gray-500">
                              × {sale.quantity}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(
                            sale.status,
                          )}`}
                        >
                          {titleCase(sale.status)}
                        </span>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${paymentClasses(
                            sale.payment_status,
                          )}`}
                        >
                          {titleCase(sale.payment_status)}
                        </span>

                        <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600">
                          {formatDate(sale.sale_date)}
                        </span>
                      </div>

                      <div className="mt-4 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            openEditForm(sale)
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void deleteSale(sale)
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </section>
      </main>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[95vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-950">
                  {editingSale ? 'Edit sale' : 'Create sale'}
                </h2>

                <p className="mt-0.5 text-sm text-gray-500">
                  {editingSale
                    ? 'Update this sales record.'
                    : 'Add a new transaction to your business.'}
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-5"
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-800">
                    Customer
                  </label>

                  <select
                    value={form.customer_id}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        customer_id: event.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400"
                    required
                  >
                    <option value="">
                      Select customer
                    </option>

                    {customers.map((customer) => (
                      <option
                        key={customer.id}
                        value={customer.id}
                      >
                        {customer.name}
                        {customer.company_name
                          ? ` — ${customer.company_name}`
                          : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-800">
                    Service
                  </label>

                  <select
                    value={form.service_id}
                    onChange={(event) =>
                      handleServiceChange(
                        event.target.value,
                      )
                    }
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400"
                  >
                    <option value="">
                      Select service
                    </option>

                    {services.map((service) => (
                      <option
                        key={service.id}
                        value={service.id}
                      >
                        {service.name}
                        {service.price !== null
                          ? ` — ${formatMoney(
                              service.price,
                              service.currency,
                            )}`
                          : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-800">
                    Amount
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        amount: event.target.value,
                      }))
                    }
                    placeholder="0.00"
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-800">
                    Currency
                  </label>

                  <input
                    type="text"
                    value={form.currency}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        currency:
                          event.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="NGN"
                    maxLength={10}
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm uppercase outline-none focus:border-gray-400"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-800">
                    Quantity
                  </label>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.quantity}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        quantity: event.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-800">
                    Sale status
                  </label>

                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        status:
                          event.target.value as SaleStatus,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400"
                  >
                    {SALE_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {titleCase(status)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-800">
                    Payment status
                  </label>

                  <select
                    value={form.payment_status}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        payment_status:
                          event.target.value as PaymentStatus,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400"
                  >
                    {PAYMENT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {titleCase(status)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-800">
                    Sale date
                  </label>

                  <input
                    type="date"
                    value={form.sale_date}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        sale_date: event.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-400"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-800">
                  Notes
                </label>

                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  rows={4}
                  placeholder="Add any relevant notes about this sale..."
                  className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-gray-400"
                />
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}

                  {editingSale
                    ? 'Save changes'
                    : 'Create sale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
