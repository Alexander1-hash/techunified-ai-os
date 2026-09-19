'use client'

import { useEffect, useMemo, useState } from 'react'

type Department = {
  id: string
  name: string
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

export function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<ServiceForm>(emptyForm)
  const [editingService, setEditingService] =
    useState<Service | null>(null)

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [servicesResponse, departmentsResponse] =
        await Promise.all([
          fetch('/api/services', {
            method: 'GET',
            cache: 'no-store',
          }),
          fetch('/api/departments', {
            method: 'GET',
            cache: 'no-store',
          }),
        ])

      const servicesResult = await servicesResponse.json()
      const departmentsResult =
        await departmentsResponse.json()

      if (!servicesResponse.ok || !servicesResult.success) {
        throw new Error(
          servicesResult.error ||
            'Unable to load services',
        )
      }

      if (
        !departmentsResponse.ok ||
        !departmentsResult.success
      ) {
        throw new Error(
          departmentsResult.error ||
            'Unable to load departments',
        )
      }

      setServices(servicesResult.services ?? [])
      setDepartments(
        departmentsResult.departments ?? [],
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load services',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  function updateForm<K extends keyof ServiceForm>(
    field: K,
    value: ServiceForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
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
      price:
        service.price === null
          ? ''
          : String(service.price),
      currency: service.currency || 'NGN',
      billing_type: service.billing_type,
      status: service.status,
      department_id: service.department_id ?? '',
    })

    setError('')
    setSuccess('')
    setShowForm(true)
  }

  async function createService(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!form.name.trim()) {
      setError('Service name is required.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          category: form.category.trim(),
          price: form.price,
          currency: form.currency,
          billing_type: form.billing_type,
          status: form.status,
          department_id:
            form.department_id || null,
          is_active: form.status === 'active',
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            'Unable to create service',
        )
      }

      setServices((current) => [
        ...current,
        result.service as Service,
      ])

      setForm(emptyForm)
      setShowForm(false)
      setSuccess('Service created successfully.')

      window.setTimeout(() => {
        setSuccess('')
      }, 3000)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create service',
      )
    } finally {
      setSaving(false)
    }
  }

  async function updateService(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!editingService) {
      return
    }

    if (!form.name.trim()) {
      setError('Service name is required.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(
        `/api/services/${editingService.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: form.name.trim(),
            description: form.description.trim(),
            category: form.category.trim(),
            price: form.price,
            currency: form.currency,
            billing_type: form.billing_type,
            status: form.status,
            department_id:
              form.department_id || null,
            is_active: form.status === 'active',
          }),
        },
      )

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            'Unable to update service',
        )
      }

      const updatedService =
        result.service as Service

      setServices((current) =>
        current.map((service) =>
          service.id === updatedService.id
            ? updatedService
            : service,
        ),
      )

      setForm(emptyForm)
      setEditingService(null)
      setShowForm(false)
      setSuccess('Service updated successfully.')

      window.setTimeout(() => {
        setSuccess('')
      }, 3000)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update service',
      )
    } finally {
      setSaving(false)
    }
  }

  async function deleteService(service: Service) {
    const confirmed = window.confirm(
      `Delete "${service.name}"? This action cannot be undone.`,
    )

    if (!confirmed) {
      return
    }

    setDeletingId(service.id)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(
        `/api/services/${service.id}`,
        {
          method: 'DELETE',
        },
      )

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            'Unable to delete service',
        )
      }

      setServices((current) =>
        current.filter(
          (item) => item.id !== service.id,
        ),
      )

      if (editingService?.id === service.id) {
        resetForm()
      }

      setSuccess('Service deleted successfully.')

      window.setTimeout(() => {
        setSuccess('')
      }, 3000)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to delete service',
      )
    } finally {
      setDeletingId(null)
    }
  }

  const filteredServices = useMemo(() => {
    const term = search.trim().toLowerCase()

    if (!term) {
      return services
    }

    return services.filter((service) => {
      return (
        service.name.toLowerCase().includes(term) ||
        service.description
          ?.toLowerCase()
          .includes(term) ||
        service.category
          ?.toLowerCase()
          .includes(term)
      )
    })
  }, [services, search])

  function departmentName(id: string | null) {
    if (!id) {
      return 'Unassigned'
    }

    return (
      departments.find(
        (department) => department.id === id,
      )?.name ?? 'Unassigned'
    )
  }

  function formatPrice(service: Service) {
    if (service.price === null) {
      return 'Custom pricing'
    }

    try {
      return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: service.currency || 'NGN',
        maximumFractionDigits: 2,
      }).format(Number(service.price))
    } catch {
      return `${service.currency} ${service.price}`
    }
  }

  function billingLabel(
    type: Service['billing_type'],
  ) {
    switch (type) {
      case 'monthly':
        return 'Monthly'

      case 'yearly':
        return 'Yearly'

      case 'custom':
        return 'Custom'

      default:
        return 'One-time'
    }
  }

  function statusClasses(
    status: Service['status'],
  ) {
    switch (status) {
      case 'active':
        return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'

      case 'draft':
        return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'

      default:
        return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
    }
  }

  return (
    <main className="min-h-full space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
            Business
          </p>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            Services
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Define the products and services TechUnified
            offers, including pricing, billing, status,
            and department ownership.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (showForm) {
              resetForm()
            } else {
              setEditingService(null)
              setForm(emptyForm)
              setError('')
              setSuccess('')
              setShowForm(true)
            }
          }}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          {showForm ? 'Close form' : '+ Add service'}
        </button>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      {success ? (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          {success}
        </div>
      ) : null}

      {showForm ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-950">
              {editingService
                ? 'Edit service'
                : 'Create service'}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {editingService
                ? 'Update the service information below.'
                : 'Add a real service to your organization.'}
            </p>
          </div>

          <form
            onSubmit={
              editingService
                ? updateService
                : createService
            }
            className="grid gap-5 md:grid-cols-2"
          >
            <div className="md:col-span-2">
              <label
                htmlFor="service-name"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Service name
              </label>

              <input
                id="service-name"
                value={form.name}
                onChange={(event) =>
                  updateForm(
                    'name',
                    event.target.value,
                  )
                }
                required
                placeholder="e.g. AI Business Automation"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="service-description"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Description
              </label>

              <textarea
                id="service-description"
                value={form.description}
                onChange={(event) =>
                  updateForm(
                    'description',
                    event.target.value,
                  )
                }
                rows={4}
                placeholder="Describe what this service delivers."
                className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="service-category"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Category
              </label>

              <input
                id="service-category"
                value={form.category}
                onChange={(event) =>
                  updateForm(
                    'category',
                    event.target.value,
                  )
                }
                placeholder="e.g. AI, Consulting, Repair"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="service-department"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Department
              </label>

              <select
                id="service-department"
                value={form.department_id}
                onChange={(event) =>
                  updateForm(
                    'department_id',
                    event.target.value,
                  )
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">
                  No department
                </option>

                {departments.map((department) => (
                  <option
                    key={department.id}
                    value={department.id}
                  >
                    {department.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="service-price"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Price
              </label>

              <input
                id="service-price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(event) =>
                  updateForm(
                    'price',
                    event.target.value,
                  )
                }
                placeholder="0.00"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="service-currency"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Currency
              </label>

              <select
                id="service-currency"
                value={form.currency}
                onChange={(event) =>
                  updateForm(
                    'currency',
                    event.target.value,
                  )
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="NGN">
                  NGN — Nigerian Naira
                </option>

                <option value="USD">
                  USD — US Dollar
                </option>

                <option value="GBP">
                  GBP — British Pound
                </option>

                <option value="EUR">
                  EUR — Euro
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor="service-billing"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Billing type
              </label>

              <select
                id="service-billing"
                value={form.billing_type}
                onChange={(event) =>
                  updateForm(
                    'billing_type',
                    event.target
                      .value as Service['billing_type'],
                  )
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="one_time">
                  One-time
                </option>

                <option value="monthly">
                  Monthly
                </option>

                <option value="yearly">
                  Yearly
                </option>

                <option value="custom">
                  Custom
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor="service-status"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Status
              </label>

              <select
                id="service-status"
                value={form.status}
                onChange={(event) =>
                  updateForm(
                    'status',
                    event.target.value as Service['status'],
                  )
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="active">
                  Active
                </option>

                <option value="draft">
                  Draft
                </option>

                <option value="inactive">
                  Inactive
                </option>
              </select>
            </div>

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end md:col-span-2">
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="min-h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="min-h-11 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? editingService
                    ? 'Saving...'
                    : 'Creating...'
                  : editingService
                    ? 'Save changes'
                    : 'Create service'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Service catalog
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {services.length} service
                {services.length === 1 ? '' : 's'} in your
                organization.
              </p>
            </div>

            <div className="w-full lg:max-w-sm">
              <label
                htmlFor="service-search"
                className="sr-only"
              >
                Search services
              </label>

              <input
                id="service-search"
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search services..."
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="animate-pulse rounded-2xl border border-slate-200 p-5"
                >
                  <div className="h-5 w-2/3 rounded bg-slate-200" />

                  <div className="mt-3 h-4 w-full rounded bg-slate-100" />

                  <div className="mt-2 h-4 w-4/5 rounded bg-slate-100" />

                  <div className="mt-6 h-8 w-1/2 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl">
                +
              </div>

              <h3 className="mt-4 text-base font-semibold text-slate-950">
                {search
                  ? 'No services found'
                  : 'No services yet'}
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                {search
                  ? 'Try a different search term.'
                  : 'Create your first service to start building your service catalog.'}
              </p>

              {!search ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingService(null)
                    setForm(emptyForm)
                    setError('')
                    setSuccess('')
                    setShowForm(true)
                  }}
                  className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  + Add your first service
                </button>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredServices.map((service) => (
                <article
                  key={service.id}
                  className="flex min-h-[260px] flex-col rounded-2xl border border-slate-200 p-5 transition hover:border-slate-300 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-slate-950">
                        {service.name}
                      </h3>

                      <p className="mt-1 text-xs font-medium text-slate-500">
                        {service.category ||
                          'Uncategorized'}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(
                        service.status,
                      )}`}
                    >
                      {service.status
                        .charAt(0)
                        .toUpperCase() +
                        service.status.slice(1)}
                    </span>
                  </div>

                  <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">
                    {service.description ||
                      'No description provided.'}
                  </p>

                  <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-slate-500">
                        Pricing
                      </span>

                      <span className="text-sm font-semibold text-slate-950">
                        {formatPrice(service)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-slate-500">
                        Billing
                      </span>

                      <span className="text-sm text-slate-700">
                        {billingLabel(
                          service.billing_type,
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-slate-500">
                        Department
                      </span>

                      <span className="max-w-[60%] truncate text-right text-sm text-slate-700">
                        {departmentName(
                          service.department_id,
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="mt-auto flex gap-2 pt-5">
                    <button
                      type="button"
                      onClick={() =>
                        startEditing(service)
                      }
                      disabled={
                        deletingId === service.id
                      }
                      className="min-h-10 flex-1 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void deleteService(service)
                      }
                      disabled={
                        deletingId === service.id
                      }
                      className="min-h-10 flex-1 rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingId === service.id
                        ? 'Deleting...'
                        : 'Delete'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
