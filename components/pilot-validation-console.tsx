'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui'

type Pilot = {
  id: string
  name: string
  status: string
  objective_id?: string | null
  measurements?: Array<{ id: string; metric_name: string; metric_type: string; value: number | null; unit?: string | null; evidence_status: string }>
  roiEvidence?: Array<{ id: string; metric_name: string; baseline_value: number | null; after_value: number | null; delta_percent: number | null; verification_status: string }>
}

export default function PilotValidationConsole() {
  const [pilots, setPilots] = useState<Pilot[]>([])
  const [name, setName] = useState('')
  const [metric, setMetric] = useState('')
  const [value, setValue] = useState('')
  const [type, setType] = useState('baseline')
  const [selected, setSelected] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const response = await fetch('/api/business/pilot-validation')
    const json = await response.json()
    if (response.ok) {
      setPilots(json.pilots ?? [])
      if (!selected && json.pilots?.[0]?.id) setSelected(json.pilots[0].id)
    }
  }

  useEffect(() => { load() }, [])

  async function createPilot() {
    if (!name.trim()) return
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/business/pilot-validation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_pilot', name: name.trim() }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Unable to create pilot.')
      setName('')
      setSelected(json.pilot.id)
      await load()
      setMessage('Pilot created. Record the baseline before measuring the deployment.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create pilot.')
    } finally { setBusy(false) }
  }

  async function recordMeasurement() {
    if (!selected || !metric.trim() || !value.trim()) return
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/business/pilot-validation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record_measurement',
          pilotId: selected,
          metricName: metric.trim(),
          metricType: type,
          value: Number(value),
          evidenceStatus: type === 'baseline' || type === 'after' ? 'measured' : 'observed',
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Unable to record measurement.')
      setValue('')
      await load()
      setMessage('Measurement recorded.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to record measurement.')
    } finally { setBusy(false) }
  }

  const current = pilots.find((pilot) => pilot.id === selected)
  const baseline = current?.measurements?.find((item) => item.metric_name === metric && item.metric_type === 'baseline' && item.value != null)
  const after = current?.measurements?.find((item) => item.metric_name === metric && item.metric_type === 'after' && item.value != null)
  const canVerify = Boolean(baseline && after && baseline.evidence_status === 'measured' && after.evidence_status === 'measured')

  async function verify() {
    if (!current || !baseline || !after) return
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/business/pilot-validation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_roi',
          pilotId: current.id,
          baselineMeasurementId: baseline.id,
          afterMeasurementId: after.id,
          metricName: metric.trim(),
          methodology: 'Verified comparison of pilot baseline and after-period measurements.',
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Unable to verify evidence.')
      await load()
      setMessage('Before/after evidence verified.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to verify evidence.')
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Commercial Validation</h1>
        <p className="mt-1 text-sm text-muted-foreground">Measure real pilot outcomes before making ROI claims.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Start a pilot</h2>
          <div className="mt-4 flex gap-2">
            <input className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Pilot company / program name" />
            <button disabled={busy} onClick={createPilot} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Create</button>
          </div>
        </Card>
        <Card>
          <h2 className="font-semibold">Record measurement</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={selected} onChange={(e) => setSelected(e.target.value)}>
              {pilots.map((pilot) => <option key={pilot.id} value={pilot.id}>{pilot.name}</option>)}
            </select>
            <input className="rounded-md border bg-background px-3 py-2 text-sm" value={metric} onChange={(e) => setMetric(e.target.value)} placeholder="Metric e.g. processing time" />
            <input className="rounded-md border bg-background px-3 py-2 text-sm" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value" inputMode="decimal" />
          </div>
          <div className="mt-2 flex gap-2">
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="baseline">Baseline</option><option value="during">During</option><option value="after">After</option>
            </select>
            <button disabled={busy || !selected} onClick={recordMeasurement} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Record</button>
          </div>
        </Card>
      </div>
      <Card>
        <h2 className="font-semibold">Evidence verification</h2>
        <p className="mt-1 text-sm text-muted-foreground">Select a metric with both measured baseline and after values.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border px-3 py-1 text-xs">Baseline: {baseline?.value ?? '—'}</span>
          <span className="rounded-full border px-3 py-1 text-xs">After: {after?.value ?? '—'}</span>
          <button disabled={busy || !canVerify} onClick={verify} className="rounded-md border px-4 py-2 text-sm font-medium">Verify evidence</button>
        </div>
      </Card>
      {current?.roiEvidence?.map((evidence) => (
        <Card key={evidence.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><p className="font-medium">{evidence.metric_name}</p><p className="text-xs text-muted-foreground">Baseline {evidence.baseline_value} → After {evidence.after_value}</p></div>
            <span className="rounded-full border px-3 py-1 text-xs">{evidence.verification_status}</span>
          </div>
          <p className="mt-3 text-sm">Measured change: {evidence.delta_percent == null ? 'not calculated' : evidence.delta_percent.toFixed(1) + '%'}</p>
        </Card>
      ))}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  )
}
