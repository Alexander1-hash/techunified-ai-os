"use client";

import { FormEvent, useEffect, useState } from "react";

type Department = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  is_active: boolean | null;
  sort_order: number | null;
};

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");

  async function loadDepartments() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/departments", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load departments.");
      }

      setDepartments(result.departments ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load departments."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDepartments();
  }, []);

  async function createDepartment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Department name is required.");
      return;
    }

    try {
      setCreating(true);
      setError("");

      const response = await fetch("/api/departments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description,
          icon,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to create department."
        );
      }

      setDepartments((current) => [
        ...current,
        result.department,
      ]);

      setName("");
      setDescription("");
      setIcon("");
      setShowForm(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create department."
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-white p-4 text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">
              Business
            </p>

            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Departments
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-slate-500 sm:text-base">
              Organize your company into operational departments
              and keep your business structure connected to the
              TechUnified AI OS.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowForm((current) => !current)}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            {showForm ? "Cancel" : "Add Department"}
          </button>
        </header>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {showForm && (
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
            <div className="mb-5">
              <h2 className="text-lg font-semibold">
                Create department
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Add a real department to your organization.
              </p>
            </div>

            <form
              onSubmit={createDepartment}
              className="grid gap-4 sm:grid-cols-2"
            >
              <label className="space-y-2">
                <span className="text-sm font-medium">
                  Department name
                </span>

                <input
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="e.g. Sales"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium">
                  Icon
                </span>

                <input
                  value={icon}
                  onChange={(event) =>
                    setIcon(event.target.value)
                  }
                  placeholder="e.g. sales"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </label>

              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-medium">
                  Description
                </span>

                <textarea
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  placeholder="What does this department handle?"
                  rows={3}
                  className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </label>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creating
                    ? "Creating..."
                    : "Create Department"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Your departments
              </h2>

              <p className="text-sm text-slate-500">
                {departments.length} department
                {departments.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              Loading departments...
            </div>
          ) : departments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <h3 className="text-base font-semibold">
                No departments yet
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                Create your first department to start building
                the company structure.
              </p>

              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="mt-5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
              >
                Create first department
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {departments.map((department) => (
                <article
                  key={department.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-700">
                        {department.icon || "D"}
                      </div>

                      <div className="min-w-0">
                        <h3 className="truncate font-semibold">
                          {department.name}
                        </h3>

                        <p className="truncate text-xs text-slate-400">
                          {department.slug}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        department.is_active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {department.is_active
                        ? "Active"
                        : "Inactive"}
                    </span>
                  </div>

                  <p className="mt-4 min-h-10 text-sm leading-5 text-slate-500">
                    {department.description ||
                      "No description provided."}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
