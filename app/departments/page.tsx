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

type DepartmentForm = {
  name: string;
  description: string;
  icon: string;
  is_active: boolean;
};

const emptyForm: DepartmentForm = {
  name: "",
  description: "",
  icon: "",
  is_active: true,
};

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingDepartment, setEditingDepartment] =
    useState<Department | null>(null);

  const [search, setSearch] = useState("");
  const [form, setForm] = useState<DepartmentForm>(emptyForm);

  async function loadDepartments() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/departments", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to load departments."
        );
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
    if (saving) {
      return;
    }

    setShowForm(false);
    setEditingDepartment(null);
    setForm(emptyForm);
  }

  async function saveDepartment(
    event: FormEvent<HTMLFormElement>
  ) {
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
        isEditing
          ? `/api/departments/${editingDepartment?.id}`
          : "/api/departments",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: form.name,
            description: form.description,
            icon: form.icon,
            is_active: form.is_active,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            `Failed to ${
              isEditing ? "update" : "create"
            } department.`
        );
      }

      if (isEditing) {
        setDepartments((current) =>
          current.map((department) =>
            department.id === result.department.id
              ? result.department
              : department
          )
        );

        setSuccess("Department updated successfully.");
      } else {
        setDepartments((current) => [
          ...current,
          result.department,
        ]);

        setSuccess("Department created successfully.");
      }

      setShowForm(false);
      setEditingDepartment(null);
      setForm(emptyForm);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save department."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleDepartment(
    department: Department
  ) {
    try {
      setError("");
      setSuccess("");

      const response = await fetch(
        `/api/departments/${department.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            is_active: !department.is_active,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Failed to update department status."
        );
      }

      setDepartments((current) =>
        current.map((item) =>
          item.id === department.id
            ? result.department
            : item
        )
      );

      setSuccess(
        result.department.is_active
          ? `${department.name} is now active.`
          : `${department.name} is now inactive.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update department status."
      );
    }
  }

  async function deleteDepartment(department: Department) {
    const confirmed = window.confirm(
      `Delete "${department.name}"?\n\nThis cannot be undone. If services are assigned to this department, the system will prevent the deletion.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(department.id);
      setError("");
      setSuccess("");

      const response = await fetch(
        `/api/departments/${department.id}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to delete department."
        );
      }

      setDepartments((current) =>
        current.filter(
          (item) => item.id !== department.id
        )
      );

      setSuccess("Department deleted successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete department."
      );
    } finally {
      setDeletingId(null);
    }
  }

  const filteredDepartments = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return departments;
    }

    return departments.filter((department) => {
      return (
        department.name.toLowerCase().includes(query) ||
        department.slug.toLowerCase().includes(query) ||
        (department.description ?? "")
          .toLowerCase()
          .includes(query)
      );
    });
  }, [departments, search]);

  const activeCount = departments.filter(
    (department) => department.is_active
  ).length;

  const inactiveCount = departments.length - activeCount;

  return (
    <main className="min-h-screen bg-white p-4 text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">
              Business
            </p>

            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Departments
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-slate-500 sm:text-base">
              Organize your company into operational
              departments and connect your business structure
              to the TechUnified AI OS.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateForm}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            + Add Department
          </button>
        </header>

        {(error || success) && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {error || success}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">
              Total departments
            </p>

            <p className="mt-2 text-2xl font-semibold">
              {departments.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">
              Active
            </p>

            <p className="mt-2 text-2xl font-semibold text-emerald-600">
              {activeCount}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">
              Inactive
            </p>

            <p className="mt-2 text-2xl font-semibold text-slate-500">
              {inactiveCount}
            </p>
          </div>
        </section>

        {showForm && (
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {editingDepartment
                    ? "Edit department"
                    : "Create department"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {editingDepartment
                    ? "Update the department information."
                    : "Add a real department to your organization."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="text-sm font-medium text-slate-500 hover:text-slate-900 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>

            <form
              onSubmit={saveDepartment}
              className="grid gap-4 sm:grid-cols-2"
            >
              <label className="space-y-2">
                <span className="text-sm font-medium">
                  Department name
                </span>

                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
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
                  value={form.icon}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      icon: event.target.value,
                    }))
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
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="What does this department handle?"
                  rows={3}
                  className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </label>

              <label className="flex items-center gap-3 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      is_active: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />

                <span className="text-sm font-medium">
                  Department is active
                </span>
              </label>

              <div className="flex gap-3 sm:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : editingDepartment
                    ? "Save Changes"
                    : "Create Department"}
                </button>

                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        <section>
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Your departments
              </h2>

              <p className="text-sm text-slate-500">
                {filteredDepartments.length} of{" "}
                {departments.length} department
                {departments.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="w-full sm:max-w-sm">
              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search departments..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              />
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
                Create your first department to start
                building the company structure.
              </p>

              <button
                type="button"
                onClick={openCreateForm}
                className="mt-5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
              >
                Create first department
              </button>
            </div>
          ) : filteredDepartments.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
              <h3 className="text-base font-semibold">
                No matching departments
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Try a different search term.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredDepartments.map((department) => (
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

                  <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      onClick={() =>
                        openEditForm(department)
                      }
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        toggleDepartment(department)
                      }
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {department.is_active
                        ? "Deactivate"
                        : "Activate"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        deleteDepartment(department)
                      }
                      disabled={
                        deletingId === department.id
                      }
                      className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingId === department.id
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
