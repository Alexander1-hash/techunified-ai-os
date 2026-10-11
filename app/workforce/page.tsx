"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { BriefcaseBusiness, Globe2, LoaderCircle, MapPin, Plus, RefreshCw, ShieldCheck } from "lucide-react";

type Vacancy = {
  id: string;
  title: string;
  industry: string;
  jurisdiction: string;
  location_text: string;
  location_mode: "local" | "region" | "country" | "worldwide" | "remote";
  employment_type: string;
  description: string;
  requirements: string[];
  required_licences: string[];
  processing_authorized: boolean;
  status: string;
  created_at: string;
};

const initialForm = {
  title: "",
  industry: "",
  jurisdiction: "",
  location_text: "",
  location_mode: "local",
  employment_type: "full_time",
  description: "",
  requirements: "",
  required_licences: "",
  processing_authorized: false,
  authorization_reference: "",
};

function splitLines(value: string) {
  return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
}

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function WorkforcePage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadVacancies = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/workforce/vacancies", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load vacancies.");
      setVacancies(result.vacancies ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load vacancies.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadVacancies(); }, [loadVacancies]);

  function update<K extends keyof typeof initialForm>(key: K, value: (typeof initialForm)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const payload = {
      ...form,
      requirements: splitLines(form.requirements),
      required_licences: splitLines(form.required_licences),
      status: form.processing_authorized && form.authorization_reference.trim() ? "open" : "draft",
    };
    try {
      const response = await fetch("/api/workforce/vacancies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save vacancy.");
      setVacancies((current) => [result.vacancy, ...current]);
      setForm(initialForm);
      setShowForm(false);
      setNotice("Vacancy saved. Live candidate sourcing is a separate integration step and is not yet active.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save vacancy.");
    } finally {
      setSaving(false);
    }
  }

  const fieldClass = "w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-500";
  const labelClass = "mb-1.5 block text-sm font-medium text-slate-300";

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-900 bg-cyan-950/50 px-3 py-1 text-xs font-medium text-cyan-300">
              <BriefcaseBusiness size={14} /> Workforce intelligence
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Recruitment workspace</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Define a role for any industry and location. Manage vacancies now; connect approved live talent sources in the next integration stage.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void loadVacancies()} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2.5 text-sm hover:bg-slate-900" type="button">
              <RefreshCw size={16} /> Refresh
            </button>
            <button onClick={() => setShowForm((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-300" type="button">
              <Plus size={17} /> New vacancy
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-sm text-slate-400">Saved vacancies</p>
            <p className="mt-2 text-3xl font-semibold">{vacancies.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-sm text-slate-400">Open for sourcing</p>
            <p className="mt-2 text-3xl font-semibold">{vacancies.filter((item) => item.status === "open").length}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="flex items-center gap-2 text-sm text-slate-400"><ShieldCheck size={15} /> Processing authorization</p>
            <p className="mt-2 text-sm font-medium text-slate-200">Required before sourcing</p>
          </div>
        </div>

        {error && <div role="alert" className="mt-5 rounded-xl border border-rose-900 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">{error}</div>}
        {notice && <div role="status" className="mt-5 rounded-xl border border-emerald-900 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">{notice}</div>}

        {showForm && (
          <form onSubmit={submit} className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6">
            <h2 className="mb-5 text-lg font-semibold">Define the role</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className={labelClass}>Job title *</label><input required minLength={2} maxLength={160} className={fieldClass} value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="e.g. Veterinary Doctor" /></div>
              <div><label className={labelClass}>Industry *</label><input required minLength={2} maxLength={120} className={fieldClass} value={form.industry} onChange={(e) => update("industry", e.target.value)} placeholder="e.g. Animal healthcare" /></div>
              <div><label className={labelClass}>Country / jurisdiction *</label><input required minLength={2} maxLength={160} className={fieldClass} value={form.jurisdiction} onChange={(e) => update("jurisdiction", e.target.value)} placeholder="e.g. Canada — Ontario" /></div>
              <div><label className={labelClass}>Location *</label><input required minLength={2} maxLength={240} className={fieldClass} value={form.location_text} onChange={(e) => update("location_text", e.target.value)} placeholder="e.g. Toronto, Ontario" /></div>
              <div><label className={labelClass}>Search scope</label><select className={fieldClass} value={form.location_mode} onChange={(e) => update("location_mode", e.target.value)}><option value="local">Local area</option><option value="region">Region / state / province</option><option value="country">Country-wide</option><option value="worldwide">Worldwide</option><option value="remote">Remote work</option></select></div>
              <div><label className={labelClass}>Employment type</label><select className={fieldClass} value={form.employment_type} onChange={(e) => update("employment_type", e.target.value)}><option value="full_time">Full time</option><option value="part_time">Part time</option><option value="contract">Contract</option><option value="temporary">Temporary</option><option value="internship">Internship</option><option value="unspecified">Unspecified</option></select></div>
              <div className="sm:col-span-2"><label className={labelClass}>Job description *</label><textarea required minLength={10} maxLength={12000} rows={4} className={fieldClass} value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Describe the work, responsibilities and essential experience." /></div>
              <div><label className={labelClass}>Required skills / criteria</label><textarea rows={3} className={fieldClass} value={form.requirements} onChange={(e) => update("requirements", e.target.value)} placeholder={"One per line, e.g.\nFive years of experience\nCompanion animal care"} /></div>
              <div><label className={labelClass}>Required licences / credentials</label><textarea rows={3} className={fieldClass} value={form.required_licences} onChange={(e) => update("required_licences", e.target.value)} placeholder={"One per line, e.g.\nOntario veterinary licence"} /></div>
              <div className="sm:col-span-2 rounded-xl border border-slate-700 bg-slate-950/70 p-4">
                <label className="flex items-start gap-3 text-sm text-slate-200">
                  <input type="checkbox" className="mt-1 accent-cyan-400" checked={form.processing_authorized} onChange={(e) => update("processing_authorized", e.target.checked)} />
                  <span>I confirm our organization has documented authorization and a lawful basis to process candidate information for this recruitment activity.</span>
                </label>
                <div className="mt-3"><label className={labelClass}>Authorization reference</label><input maxLength={500} className={fieldClass} value={form.authorization_reference} onChange={(e) => update("authorization_reference", e.target.value)} placeholder="Internal policy, consent record, or approval reference" /></div>
                <p className="mt-2 text-xs leading-5 text-slate-500">Without authorization details, the role is saved as a draft and no candidate sourcing is initiated.</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button disabled={saving} type="submit" className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60">{saving ? <LoaderCircle className="animate-spin" size={16} /> : <Plus size={16} />}{saving ? "Saving…" : "Save vacancy"}</button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm hover:bg-slate-800">Cancel</button>
            </div>
          </form>
        )}

        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your vacancies</h2>
            <span className="text-xs text-slate-500">Organization workspace</span>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 rounded-2xl border border-slate-800 p-8 text-sm text-slate-400"><LoaderCircle className="animate-spin" size={18} /> Loading vacancies…</div>
          ) : vacancies.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-5 py-12 text-center">
              <BriefcaseBusiness className="mx-auto text-slate-500" size={30} />
              <h3 className="mt-3 font-medium">No vacancies yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">Create the first role. You can define any profession and search scope, including worldwide, when the authorized talent-source integrations are connected.</p>
              <button type="button" onClick={() => setShowForm(true)} className="mt-4 rounded-xl border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800">Create first vacancy</button>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {vacancies.map((vacancy) => (
                <article key={vacancy.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div><h3 className="font-semibold">{vacancy.title}</h3><p className="mt-1 text-sm text-slate-400">{vacancy.industry}</p></div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs ${vacancy.status === "open" ? "border-emerald-900 bg-emerald-950/50 text-emerald-300" : "border-slate-700 bg-slate-800 text-slate-300"}`}>{label(vacancy.status)}</span>
                  </div>
                  <p className="mt-3 flex items-center gap-2 text-sm text-slate-300"><MapPin size={15} />{vacancy.location_text} · {vacancy.jurisdiction}</p>
                  <p className="mt-1 flex items-center gap-2 text-sm text-slate-400"><Globe2 size={15} />{label(vacancy.location_mode)} · {label(vacancy.employment_type)}</p>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">{vacancy.description}</p>
                  <div className="mt-4 flex flex-wrap gap-2">{(vacancy.requirements ?? []).slice(0, 5).map((item) => <span key={item} className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">{item}</span>)}</div>
                  <div className="mt-4 border-t border-slate-800 pt-3 text-xs text-slate-500">{vacancy.processing_authorized ? "Authorization recorded" : "Draft — sourcing authorization not recorded"} · Created {new Date(vacancy.created_at).toLocaleDateString()}</div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
