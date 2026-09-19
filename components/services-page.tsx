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
                  updateForm('name', event.target.value)
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
                  updateForm('category', event.target.value)
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
                <option value="">No department</option>

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
                  updateForm('price', event.target.value)
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
                  updateForm('currency', event.target.value)
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
                <option value="one_time">One-time</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom</option>
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
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end md:col-span-2">
              <button
                type="button"
                onClick={resetForm}
                className="min-h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
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
                    ? 'Saving…'
                    : 'Creating…'
                  : editingService
                    ? 'Save changes'
                    : 'Create service'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Service catalog
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {services.length} service
              {services.length === 1 ? '' : 's'} configured.
            </p>
          </div>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search services..."
            aria-label="Search services"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:max-w-xs"
          />
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading services…
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-lg text-slate-500">
              ◈
            </div>

            <h3 className="mt-4 text-base font-semibold text-slate-950">
              {search
                ? 'No matching services'
                : 'No services yet'}
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              {search
                ? 'Try a different search term.'
                : 'Create your first service to start building the TechUnified service catalog.'}
            </p>

            {!search ? (
              <button
                type="button"
                onClick={() => {
                  setEditingService(null)
                  setForm(emptyForm)
                  setShowForm(true)
                }}
                className="mt-5 min-h-11 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Add first service
              </button>
            ) : null}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredServices.map((service) => (
              <article
                key={service.id}
                className="p-5 transition hover:bg-slate-50/70"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-950">
                        {service.name}
                      </h3>

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          service.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700'
                            : service.status === 'draft'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {service.status}
                      </span>
                    </div>

                    {service.description ? (
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                        {service.description}
                      </p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-slate-600">
                        {departmentName(service.department_id)}
                      </span>

                      {service.category ? (
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-slate-600">
                          {service.category}
                        </span>
                      ) : null}

                      <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-slate-600">
                        {billingLabel(service.billing_type)}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 lg:text-right">
                    <p className="text-lg font-semibold text-slate-950">
                      {formatPrice(service)}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {billingLabel(service.billing_type)}
                    </p>
                  </div>
                </div>
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
                  updateForm('name', event.target.value)
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
                  updateForm('category', event.target.value)
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
                <option value="">No department</option>

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
                  updateForm('price', event.target.value)
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
                  updateForm('currency', event.target.value)
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
                <option value="one_time">One-time</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom</option>
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
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end md:col-span-2">
              <button
                type="button"
                onClick={resetForm}
                className="min-h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
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
                    ? 'Saving…'
                    : 'Creating…'
                  : editingService
                    ? 'Save changes'
                    : 'Create service'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Service catalog
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {services.length} service
              {services.length === 1 ? '' : 's'} configured.
            </p>
          </div>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search services..."
            aria-label="Search services"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:max-w-xs"
          />
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading services…
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-lg text-slate-500">
              ◈
            </div>

            <h3 className="mt-4 text-base font-semibold text-slate-950">
              {search
                ? 'No matching services'
                : 'No services yet'}
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              {search
                ? 'Try a different search term.'
                : 'Create your first service to start building the TechUnified service catalog.'}
            </p>

            {!search ? (
              <button
                type="button"
                onClick={() => {
                  setEditingService(null)
                  setForm(emptyForm)
                  setShowForm(true)
                }}
                className="mt-5 min-h-11 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Add first service
              </button>
            ) : null}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredServices.map((service) => (
              <article
                key={service.id}
                className="p-5 transition hover:bg-slate-50/70"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-950">
                        {service.name}
                      </h3>

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          service.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700'
                            : service.status === 'draft'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {service.status}
                      </span>
                    </div>

                    {service.description ? (
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                        {service.description}
                      </p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-slate-600">
                        {departmentName(service.department_id)}
                      </span>

                      {service.category ? (
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-slate-600">
                          {service.category}
                        </span>
                      ) : null}

                      <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-slate-600">
                        {billingLabel(service.billing_type)}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 lg:text-right">
                    <p className="text-lg font-semibold text-slate-950">
                      {formatPrice(service)}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {billingLabel(service.billing_type)}
                    </p>
                  </div>
                </div>
                                  <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
                    <button
                      type="button"
                      onClick={() => startEditing(service)}
                      className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-white"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteService(service)}
                      disabled={deletingId === service.id}
                      className="min-h-10 rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingId === service.id
                        ? 'Deleting…'
                        : 'Delete'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
