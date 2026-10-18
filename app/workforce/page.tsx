"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { BriefcaseBusiness, ExternalLink, Globe2, LoaderCircle, MapPin, Plus, RefreshCw, ShieldCheck, Users } from "lucide-react";

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

type RecruitmentEvent = {
  id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  reason: string | null;
  occurred_at: string;
  actor_id: string | null;
  candidate_lead_id: string | null;
};

type SourcingStatus = {
  ingestionConfigured: boolean;
  ingestionEndpoint: string;
  liveSearchConnected: boolean;
  approvedSourceCount: number;
  message: string;
};

type CandidateLead = {
  id: string;
  source_id: string;
  display_name: string | null;
  profile_url: string | null;
  location_text: string | null;
  job_relevant_summary: string | null;
  job_relevant_skills: string[];
  evidence_status: string;
  review_status: string;
  retrieved_at: string;
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
  const [selectedVacancy, setSelectedVacancy] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CandidateLead[]>([]);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidateMessage, setCandidateMessage] = useState("");
  const [sourcingStatus, setSourcingStatus] = useState<SourcingStatus | null>(null);
  const [auditEvents, setAuditEvents] = useState<RecruitmentEvent[]>([]);
  const [auditAvailable, setAuditAvailable] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

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

  async function openCandidates(vacancy: Vacancy) {
    setSelectedVacancy(vacancy.id);
    setCandidateLoading(true);
    setCandidateMessage("");
    setError("");
    try {
      const response = await fetch(`/api/workforce/candidates?vacancy_id=${encodeURIComponent(vacancy.id)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load candidate leads.");
      setCandidates(result.candidates ?? []);
      setAuditEvents(result.auditEvents ?? []);
      setAuditAvailable(result.auditAvailable !== false);
      setSourcingStatus(result.sourcing ?? null);
      setCandidateMessage(result.sourcing?.message ?? "");
    } catch (cause) {
      setCandidates([]);
      setAuditEvents([]);
      setAuditAvailable(false);
      setSourcingStatus(null);
      setError(cause instanceof Error ? cause.message : "Could not load candidate leads.");
    } finally {
      setCandidateLoading(false);
    }
  }

  async function updateCandidateReview(candidate: CandidateLead, reviewStatus: string) {
    let reason = "";
    if (reviewStatus === "not_progressing" || reviewStatus === "withdrawn") {
      const entered = window.prompt("Enter a brief, job-related reason for the audit record.");
      if (!entered || entered.trim().length < 3) return;
      reason = entered.trim().slice(0, 1000);
    }
    setReviewingId(candidate.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/workforce/candidates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate_id: candidate.id, review_status: reviewStatus, reason }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update candidate review.");
      setCandidates((current) => current.map((item) => item.id === candidate.id ? { ...item, review_status: result.candidate.review_status } : item));
      setNotice("Candidate review updated. This is a human review workflow, not an automated hiring decision.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update candidate review.");
    } finally {
      setReviewingId(null);
    }
  }

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
      setNotice("Vacancy saved. Live candidate sourcing remains inactive until an authorized provider is configured.");
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
                  <button type="button" onClick={() => void openCandidates(vacancy)} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-cyan-900 bg-cyan-950/40 px-3 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-950">
                    <Users size={16} /> {selectedVacancy === vacancy.id ? "Refresh candidate leads" : "View candidate leads"}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        {selectedVacancy && (
          <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Candidate pipeline</p><h2 className="mt-1 text-xl font-semibold">{vacancies.find((item) => item.id === selectedVacancy)?.title ?? "Selected vacancy"}</h2><p className="mt-1 text-sm text-slate-400">Review source provenance and job-related evidence. All progression remains human-controlled.</p></div>
              <button type="button" onClick={() => { setSelectedVacancy(null); setCandidates([]); setAuditEvents([]); setSourcingStatus(null); }} className="rounded-xl border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800">Close pipeline</button>
            </div>
            <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">Recruitment audit history</h3>
                <span className="text-xs text-slate-500">{auditAvailable ? auditEvents.length + " recent event(s)" : "Audit history temporarily unavailable"}</span>
              </div>
              {!auditAvailable ? (
                <p className="mt-2 text-sm text-amber-200">The audit history could not be loaded. Do not treat the timeline as complete until the database and permissions are checked.</p>
              ) : auditEvents.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">No recruitment events recorded for this vacancy yet.</p>
              ) : (
                <ol className="mt-3 space-y-3">
                  {auditEvents.map((event) => (
                    <li key={event.id} className="border-l-2 border-slate-700 pl-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-200">{label(event.event_type)}</span>
                        <time className="text-xs text-slate-500">{new Date(event.occurred_at).toLocaleString()}</time>
                      </div>
                      {(event.from_status || event.to_status) && <p className="mt-1 text-xs text-slate-400">{event.from_status ? label(event.from_status) : "Start"} → {event.to_status ? label(event.to_status) : "Recorded"}</p>}
                      {event.reason && <p className="mt-1 text-sm text-slate-400">Reason: {event.reason}</p>}
                    </li>
                  ))}
                </ol>
              )}
              <p className="mt-3 text-xs leading-5 text-slate-500">Events are scoped to this organization and vacancy. This view shows the latest 100 records.</p>
            </div>
            {sourcingStatus && (
              <div className={"mt-5 rounded-xl border p-4 " + (sourcingStatus.liveSearchConnected ? "border-emerald-900 bg-emerald-950/30" : "border-amber-900 bg-amber-950/30")}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + (sourcingStatus.liveSearchConnected ? "bg-emerald-900/60 text-emerald-200" : "bg-amber-900/60 text-amber-200")}>
                    {sourcingStatus.liveSearchConnected ? "Live search connected" : "Live search not connected"}
                  </span>
                  <span className="text-xs text-slate-400">{sourcingStatus.approvedSourceCount} approved source ID(s) configured</span>
                  <span className="text-xs text-slate-500">Ingestion endpoint: {sourcingStatus.ingestionEndpoint}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-300">{sourcingStatus.message}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">A configured ingestion endpoint is not the same as a connected search provider. Candidate leads remain unverified until independently checked.</p>
              </div>
            )}
            {candidateLoading ? <div className="mt-5 flex items-center gap-2 text-sm text-slate-400"><LoaderCircle size={17} className="animate-spin" /> Loading candidate leads…</div> : candidates.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-slate-700 p-5">
                <p className="font-medium">No candidate leads recorded</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{candidateMessage || "No leads have been saved for this vacancy."} The workspace will not fabricate candidate profiles. Once an approved source integration is configured, sourced leads can appear here with provenance and review controls.</p>
              </div>
            ) : (
              <div className="mt-5 grid gap-3">
                {candidates.map((candidate) => (
                  <article key={candidate.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><h3 className="font-semibold">{candidate.display_name || "Name not provided by source"}</h3><p className="mt-1 text-xs text-slate-500">Source: {candidate.source_id} · Retrieved {new Date(candidate.retrieved_at).toLocaleDateString()}</p></div>
                      <div className="flex flex-wrap gap-2"><span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">{label(candidate.review_status)}</span><span className="rounded-full border border-amber-900 bg-amber-950/40 px-2.5 py-1 text-xs text-amber-200">Evidence: {label(candidate.evidence_status)}</span></div>
                    </div>
                    {candidate.location_text && <p className="mt-2 flex items-center gap-2 text-sm text-slate-300"><MapPin size={14} />{candidate.location_text}</p>}
                    {candidate.job_relevant_summary && <p className="mt-3 text-sm leading-6 text-slate-400">{candidate.job_relevant_summary}</p>}
                    {(candidate.job_relevant_skills ?? []).length > 0 && <div className="mt-3 flex flex-wrap gap-2">{candidate.job_relevant_skills.map((skill) => <span key={skill} className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">{skill}</span>)}</div>}
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
                      {candidate.profile_url && <a href={candidate.profile_url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">Open source profile <ExternalLink size={13} /></a>}
                      <label className="sr-only" htmlFor={`review-${candidate.id}`}>Update candidate review status</label>
                      <select id={`review-${candidate.id}`} disabled={reviewingId === candidate.id} value={candidate.review_status} onChange={(event) => void updateCandidateReview(candidate, event.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 disabled:opacity-50">
                        <option value="new">New</option><option value="reviewing">Reviewing</option><option value="shortlisted">Shortlisted for human review</option><option value="not_progressing">Not progressing</option><option value="withdrawn">Withdrawn</option>
                      </select>
                      {reviewingId === candidate.id && <LoaderCircle size={15} className="animate-spin text-cyan-300" />}
                    </div>
                  </article>
                ))}
              </div>
            )}
            <p className="mt-4 text-xs leading-5 text-slate-500">Do not treat a source profile as credential verification. Verify required licences and qualifications independently; do not use protected characteristics to assess candidates.</p>
          </section>
        )}
      </div>
    </main>
  );
}
