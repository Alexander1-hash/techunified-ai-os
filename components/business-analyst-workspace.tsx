"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Lightbulb,
  RefreshCw,
} from "lucide-react";

const areas = [
  "Finance",
  "Sales",
  "Marketing",
  "Customers",
  "Operations",
  "Product",
  "Workforce",
  "Risk",
];

type DecisionType =
  | "opportunity"
  | "attention"
  | "signal";

type Decision = {
  id: string;
  type: DecisionType;
  title: string;
  message: string;
  priority: "high" | "medium" | "low";
  action: string;
  evidence?: Record<string, string | number>;
};

type AnalysisData = {
  kpis: Array<{
    id: string;
    name: string;
    value: number | string;
    previous_value?: number | string | null;
    unit?: string | null;
    period?: string | null;
    trend?: string | null;
    status?: string | null;
    source?: string | null;
  }>;
  mappings: unknown[];
  sources: unknown[];
  health: number | null;
  areas: string[];
  quality: number;
  recommendations: Array<{
    title: string;
    problem: string;
    recommended_action: string;
    confidence: number;
  }>;
  nextAction: string;
  relationshipIntelligence?: {
    coverage: {
      explicit: number;
      verified: number;
      estimated: number;
      inferred: number;
    };
    relationships: Array<{
      source_type: string;
      source_id: string;
      relationship_type: string;
      target_type: string;
      target_id: string;
      evidence_status: string;
      confidence: number | null;
    }>;
    methodology: string;
  };
  relationshipQuestions?: {
    customerServiceRelationships?: {
      answerable: boolean;
      multiServiceCustomers?: Array<{
        customer: { id: string; name: string } | null;
        services: Array<{ id: string; name: string }>;
        serviceCount: number;
        recordedRevenue: number;
      }>;
      limitation?: string;
    };
    servicePerformance?: {
      answerable: boolean;
      services?: Array<{
        service: { id: string; name: string } | null;
        wonSales: number;
        recordedRevenue: number;
        unitsSold: number;
        department: { id: string; name: string } | null;
      }>;
      limitation?: string;
    };
    leadLossLocation?: {
      leadCustomers: number;
      convertedLeads: number;
      leadCustomersWithLostSales: number;
      conversionRate: number | null;
      lostRevenue: number;
      limitation?: string;
    };
  };
};

type DecisionsData = {
  ok: boolean;
  generatedAt?: string;
  summary?: {
    customers: number;
    leads: number;
    activeCustomers: number;
    services: number;
    servicesWithWonSales: number;
    servicesWithoutSales: number;
    sales: number;
    wonSales: number;
    pendingSales: number;
    lostSales: number;
    unpaidSales: number;
    customersWithWonSales: number;
    customersWithoutSales: number;
    revenue: number;
    currency: string;
  };
  decisions: Decision[];
};

type ForecastItem = {
  name: string;
  unit?: string | null;
  source?: string | null;
  period?: string | null;
  current: number;
  previous: number;
  changePercent: number;
  projected: number;
  direction: "up" | "down" | "flat";
  confidence: string;
  evidencePeriods: number;
};

type ForecastData = {
  forecasts: ForecastItem[];
  recommendations: Array<{
    title: string;
    message: string;
    action: string;
  }>;
  hasEnoughData: boolean;
  message: string;
};

function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-border/70 bg-card p-5 shadow-sm ${className}`}
    >
      <h2 className="font-semibold tracking-tight text-foreground">
        {title}
      </h2>

      <div className="mt-3 text-sm leading-6 text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function DecisionIcon({
  type,
}: {
  type: DecisionType;
}) {
  if (type === "attention") {
    return <AlertCircle size={18} />;
  }

  if (type === "opportunity") {
    return <Lightbulb size={18} />;
  }

  return <Activity size={18} />;
}

function DecisionCard({
  decision,
}: {
  decision: Decision;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
          <DecisionIcon type={decision.type} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="font-medium text-foreground">
              {decision.title}
            </p>

            <span className="rounded-full border border-border/70 px-2.5 py-1 text-[11px] font-medium capitalize text-muted-foreground">
              {decision.priority} priority
            </span>
          </div>

          <p className="mt-1">
            {decision.message}
          </p>

          <div className="mt-3 rounded-lg bg-muted/40 p-3">
            <p className="text-xs font-medium text-foreground">
              Recommended action
            </p>

            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {decision.action}
            </p>
          </div>

          {decision.evidence &&
          Object.keys(decision.evidence).length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(
                decision.evidence,
              ).map(([key, value]) => (
                <span
                  key={key}
                  className="rounded-full border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground"
                >
                  {key.replace(
                    /([A-Z])/g,
                    " $1",
                  )}{" "}
                  {String(value)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string | number;
  description: string;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </p>

      <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
        {value}
      </p>

      <p className="mt-1 text-sm text-muted-foreground">
        {description}
      </p>
    </section>
  );
}

function LoadingState({
  title = "Loading analysis",
  message = "Checking verified business evidence…",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <main className="min-h-screen bg-background px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <Panel title={title}>
          <div className="flex items-center gap-2">
            <RefreshCw
              size={15}
              className="animate-spin"
            />
            <span>{message}</span>
          </div>
        </Panel>
      </div>
    </main>
  );
}

function ErrorState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="min-h-screen bg-background px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <AlertCircle size={18} />
            </div>

            <div>
              <h2 className="font-semibold text-foreground">
                {title}
              </h2>

              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {message}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export function BusinessAnalystWorkspace({
  mode = "dashboard",
}: {
  mode?: string;
}) {
  const [data, setData] =
    useState<AnalysisData | null>(null);

  const [decisions, setDecisions] =
    useState<DecisionsData | null>(null);

  const [forecast, setForecast] =
    useState<ForecastData | null>(null);

  const [error, setError] = useState("");
  const [decisionError, setDecisionError] =
    useState("");

  const [refreshing, setRefreshing] =
    useState(false);

  async function loadData() {
    setError("");
    setDecisionError("");

    try {
      setRefreshing(true);

      if (mode === "forecast") {
        const response = await fetch(
          "/api/business/forecast",
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const json =
          await response.json();

        if (!response.ok) {
          throw new Error(
            json.error ||
              "Unable to load forecast.",
          );
        }

        setForecast(json);
        return;
      }

      if (mode !== "dashboard") {
        return;
      }

      const [
        analysisResponse,
        decisionsResponse,
        relationshipResponse,
      ] = await Promise.all([
        fetch("/api/business/analysis", {
          method: "GET",
          cache: "no-store",
        }),
        fetch("/api/business/decisions", {
          method: "GET",
          cache: "no-store",
        }),
        fetch("/api/business/relationships/insights", {
          method: "GET",
          cache: "no-store",
        }),
      ]);

      const analysisJson =
        await analysisResponse.json();

      const decisionsJson =
        await decisionsResponse.json();

      const relationshipJson =
        await relationshipResponse.json();

      if (!analysisResponse.ok) {
        throw new Error(
          analysisJson.error ||
            "Unable to load business analysis.",
        );
      }

      if (!decisionsResponse.ok) {
        setDecisionError(
          decisionsJson.error ||
            "Unable to load business decisions.",
        );
      }

      if (!relationshipResponse.ok) {
        setError(
          relationshipJson.error ||
            "Unable to load relationship intelligence.",
        );
      }

      setData({
        ...analysisJson,
        relationshipIntelligence:
          analysisJson.relationshipIntelligence,
        relationshipQuestions:
          relationshipResponse.ok
            ? relationshipJson.questions
            : undefined,
      });
      setDecisions(
        decisionsResponse.ok
          ? decisionsJson
          : null,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load business intelligence.",
      );
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [mode]);

  if (mode === "forecast") {
    return (
      <ForecastWorkspace
        data={forecast}
        error={error}
        refreshing={refreshing}
        onRefresh={loadData}
      />
    );
  }

  if (mode !== "dashboard") {
    return (
      <main className="min-h-screen bg-background px-5 py-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Business Analyst
            </p>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
              Evidence before conclusions.
            </h1>

            <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
              This view remains grounded in
              verified organization data.
            </p>
          </header>

          <Panel title="Insufficient data">
            Connect and confirm a source mapping to
            begin analysis.
          </Panel>
        </div>
      </main>
    );
  }

  if (error && !data) {
    return (
      <ErrorState
        title="Unable to load analysis"
        message={error}
      />
    );
  }

  if (!data) {
    return <LoadingState />;
  }

  const hasData = data.kpis.length > 0;

  const coveredAreas = Array.isArray(
    data.areas,
  )
    ? data.areas
    : [];

  const decisionList =
    decisions?.decisions ?? [];

  const decisionSummary =
    decisions?.summary ?? null;

  return (
    <main className="min-h-screen bg-background px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Business Analyst
                </p>

                <span className="rounded-full border border-border/70 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Live data
                </span>
              </div>

              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
                Understand what is happening in your business.
              </h1>

              <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
                TechUnified analyzes confirmed organization
                data across KPIs, customers, services and
                sales. Missing values are not invented.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadData()}
              disabled={refreshing}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                className={
                  refreshing
                    ? "animate-spin"
                    : ""
                }
              />

              {refreshing
                ? "Refreshing…"
                : "Refresh analysis"}
            </button>
          </div>
        </header>

        {!hasData ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Insufficient business data">
              Connect a source and confirm at least one
              KPI mapping before calculating a business
              health signal.
            </Panel>

            <Panel title="Next best action">
              <Link
                href="/brain/data-sources"
                className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
              >
                Connect your first source
                <ArrowRight size={15} />
              </Link>
            </Panel>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                title="Business health"
                value={
                  data.health !== null
                    ? data.health
                    : "—"
                }
                description="Calculated from verified KPI trends."
              />

              <MetricCard
                title="Data coverage"
                value={`${data.quality}%`}
                description={`${coveredAreas.length} business areas represented.`}
              />

              <MetricCard
                title="Verified KPIs"
                value={data.kpis.length}
                description="Confirmed KPI records available."
              />

              <MetricCard
                title="Decision signals"
                value={decisionList.length}
                description="Signals derived from operational evidence."
              />
            </div>

            <div className="mt-4 rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Lightbulb size={18} />
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Next best action
                  </p>

                  <p className="mt-1 text-sm font-medium text-foreground">
                    {data.nextAction}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                      Decision Engine
                    </p>

                    <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                      What should the business pay attention to?
                    </h2>

                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                      Signals are derived from actual
                      organization Customers, Services and
                      Sales records.
                    </p>
                  </div>

                  {decisionSummary ? (
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-border/70 px-3 py-1.5 text-xs text-muted-foreground">
                        {decisionSummary.customers} customers
                      </span>

                      <span className="rounded-full border border-border/70 px-3 py-1.5 text-xs text-muted-foreground">
                        {decisionSummary.services} services
                      </span>

                      <span className="rounded-full border border-border/70 px-3 py-1.5 text-xs text-muted-foreground">
                        {decisionSummary.sales} sales
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="mt-5">
                  {decisionError ? (
                    <div className="rounded-xl border border-border/60 p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle
                          size={17}
                          className="mt-0.5 shrink-0"
                        />

                        <p className="text-sm">
                          {decisionError}
                        </p>
                      </div>
                    </div>
                  ) : !decisions ? (
                    <div className="rounded-xl border border-border/60 p-4">
                      <div className="flex items-center gap-2 text-sm">
                        <RefreshCw
                          size={15}
                          className="animate-spin"
                        />
                        Analyzing confirmed business activity…
                      </div>
                    </div>
                  ) : decisionList.length ? (
                    <div className="space-y-3">
                      {decisionList.map(
                        (decision) => (
                          <DecisionCard
                            key={decision.id}
                            decision={decision}
                          />
                        ),
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border/60 p-4 text-sm">
                      No decision signals are currently
                      available.
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="mt-4">
              <Panel title="Business relationship intelligence">
                {data.relationshipIntelligence ? (
                  <div className="space-y-3">
                    <p>
                      TechUnified is now exposing the Phase 5 relationship layer inside Business Analyst.
                      It uses recorded organization relationships and does not invent missing links.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-xl border border-border/60 bg-background p-3">
                        <p className="text-xs text-muted-foreground">Explicit relationships</p>
                        <p className="mt-1 text-xl font-semibold text-foreground">
                          {data.relationshipIntelligence.coverage.explicit}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-background p-3">
                        <p className="text-xs text-muted-foreground">Verified</p>
                        <p className="mt-1 text-xl font-semibold text-foreground">
                          {data.relationshipIntelligence.coverage.verified}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-background p-3">
                        <p className="text-xs text-muted-foreground">Estimated</p>
                        <p className="mt-1 text-xl font-semibold text-foreground">
                          {data.relationshipIntelligence.coverage.estimated}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-background p-3">
                        <p className="text-xs text-muted-foreground">Inferred</p>
                        <p className="mt-1 text-xl font-semibold text-foreground">
                          {data.relationshipIntelligence.coverage.inferred}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {data.relationshipIntelligence.methodology}
                    </p>
                  </div>
                ) : (
                  <p>Relationship intelligence is not currently available.</p>
                )}
              </Panel>
            </div>

            <RelationshipTracePanel />

            {data.relationshipQuestions ? (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <Panel title="Customer–service relationships">
                  {data.relationshipQuestions.customerServiceRelationships?.multiServiceCustomers?.length ? (
                    <div className="space-y-2">
                      {data.relationshipQuestions.customerServiceRelationships.multiServiceCustomers.map((item, index) => (
                        <div key={item.customer?.id ?? index} className="rounded-xl border border-border/60 bg-background p-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-foreground">{item.customer?.name ?? "Unknown customer"}</span>
                            <strong className="text-foreground">{item.recordedRevenue.toLocaleString()}</strong>
                          </div>
                          <p className="mt-1 text-xs">{item.services.map((service) => service.name).join(" · ")}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No multi-service customer relationships are currently recorded.</p>
                  )}
                  <p className="mt-3 text-xs">{data.relationshipQuestions.customerServiceRelationships?.limitation}</p>
                </Panel>

                <Panel title="Recorded service performance">
                  {data.relationshipQuestions.servicePerformance?.services?.length ? (
                    <div className="space-y-2">
                      {data.relationshipQuestions.servicePerformance.services.map((item, index) => (
                        <div key={item.service?.id ?? index} className="rounded-xl border border-border/60 bg-background p-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-foreground">{item.service?.name ?? "Unknown service"}</span>
                            <strong className="text-foreground">{item.recordedRevenue.toLocaleString()}</strong>
                          </div>
                          <p className="mt-1 text-xs">
                            {item.wonSales} won sales · {item.unitsSold} units{item.department ? ` · ${item.department.name}` : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No won-sale service performance evidence is currently recorded.</p>
                  )}
                  <p className="mt-3 text-xs">{data.relationshipQuestions.servicePerformance?.limitation}</p>
                </Panel>
              </div>
            ) : null}

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Panel title="Verified KPI overview">
                <div className="space-y-3">
                  {data.kpis.map((kpi) => (
                    <div
                      key={kpi.id}
                      className="flex flex-col gap-2 border-b border-border/60 pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium text-foreground">
                          {kpi.name}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          {kpi.source ||
                            "Verified source"}{" "}
                          ·{" "}
                          {kpi.period ||
                            "Recorded period"}{" "}
                          ·{" "}
                          {kpi.status ||
                            "verified"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {kpi.trend ===
                        "up" ? (
                          <ArrowUpRight
                            size={15}
                          />
                        ) : kpi.trend ===
                          "down" ? (
                          <ArrowDownRight
                            size={15}
                          />
                        ) : null}

                        <strong className="text-foreground">
                          {kpi.value}{" "}
                          {kpi.unit || ""}
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Evidence-based recommendations">
                {data.recommendations.length ? (
                  <div className="space-y-4">
                    {data.recommendations.map(
                      (recommendation) => (
                        <div
                          key={`${recommendation.title}-${recommendation.problem}`}
                          className="rounded-xl border border-border/60 p-4"
                        >
                          <p className="font-medium text-foreground">
                            {recommendation.title}
                          </p>

                          <p className="mt-1">
                            {recommendation.problem}
                          </p>

                          <p className="mt-2 text-foreground">
                            {recommendation.recommended_action}
                          </p>

                          <div className="mt-3 flex items-center gap-2 text-xs">
                            <CheckCircle2
                              size={14}
                            />

                            Confidence{" "}
                            {Math.round(
                              recommendation.confidence *
                                100,
                            )}
                            %
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <p>
                    Recommendations appear only when
                    supported by comparable KPI evidence.
                  </p>
                )}
              </Panel>

              <Panel title="Data quality">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full border border-border">
                    {data.quality}%
                  </div>

                  <div>
                    <p className="font-medium text-foreground">
                      Verified KPI coverage
                    </p>

                    <p className="text-xs text-muted-foreground">
                      Freshness and completeness warnings
                      remain attached to affected sources.
                    </p>
                  </div>
                </div>
              </Panel>

              <Panel title="Business areas covered">
                {coveredAreas.length ? (
                  <div className="flex flex-wrap gap-2">
                    {coveredAreas.map(
                      (area) => (
                        <span
                          key={area}
                          className="rounded-full border border-border/70 px-3 py-1.5 text-xs text-muted-foreground"
                        >
                          {area}
                        </span>
                      ),
                    )}
                  </div>
                ) : (
                  <p>
                    No business areas have been confirmed
                    yet.
                  </p>
                )}
              </Panel>
            </div>
          </>
        )}
      </div>
    </main>
  );
}


function RelationshipTracePanel() {
  const [type, setType] = useState<"customer" | "service" | "workflow">("customer");
  const [id, setId] = useState("");
  const [result, setResult] = useState<{
    nodes?: Array<{ id: string; type: string; label: string; depth: number; evidence: string }>;
    edges?: Array<{ source: string; target: string; relationship: string; evidence: string; evidenceStatus?: string }>;
    evidenceGaps?: Array<{ type: string; message: string }>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function trace() {
    if (!id.trim()) {
      setError("Enter an entity ID to trace its evidence chain.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        "/api/business/relationships/trace?source_type=" + encodeURIComponent(type) + "&source_id=" + encodeURIComponent(id.trim()),
        { cache: "no-store" },
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Unable to trace this relationship.");
      setResult(json);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Unable to trace this relationship.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4">
      <Panel title="Evidence trace">
        <p>Follow recorded relationships and explicit evidence from a business entity.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <select value={type} onChange={(event) => setType(event.target.value as typeof type)} className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground">
            <option value="customer">Customer</option>
            <option value="service">Service</option>
            <option value="workflow">Workflow</option>
          </select>
          <input value={id} onChange={(event) => setId(event.target.value)} placeholder="Entity ID" className="min-h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground" />
          <button type="button" onClick={() => void trace()} disabled={loading} className="min-h-10 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60">
            {loading ? "Tracing…" : "Trace evidence"}
          </button>
        </div>
        {error ? <p className="mt-3 text-xs text-muted-foreground">{error}</p> : null}
        {result ? (
          <div className="mt-4 space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-border/60 p-3"><p className="text-xs">Trace nodes</p><strong className="text-xl text-foreground">{result.nodes?.length ?? 0}</strong></div>
              <div className="rounded-xl border border-border/60 p-3"><p className="text-xs">Evidence links</p><strong className="text-xl text-foreground">{result.edges?.length ?? 0}</strong></div>
            </div>
            {result.nodes?.length ? <div className="space-y-2">{result.nodes.map((node) => <div key={node.type + node.id} className="rounded-xl border border-border/60 p-3"><div className="flex items-center justify-between gap-3"><span className="font-medium text-foreground">{node.label}</span><span className="text-xs">depth {node.depth}</span></div><p className="mt-1 text-xs">{node.type} · {node.evidence} evidence</p></div>)}</div> : null}
            {result.evidenceGaps?.length ? <div className="rounded-xl border border-border/60 p-3"><p className="font-medium text-foreground">Evidence gaps</p>{result.evidenceGaps.map((gap) => <p key={gap.type} className="mt-1 text-xs">{gap.message}</p>)}</div> : null}
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

function ForecastWorkspace({
  data,
  error,
  refreshing,
  onRefresh,
}: {
  data: ForecastData | null;
  error: string;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
}) {
  if (error && !data) {
    return (
      <ErrorState
        title="Unable to load forecast"
        message={error}
      />
    );
  }

  if (!data) {
    return (
      <LoadingState
        title="Loading forecast"
        message="Checking verified KPI history…"
      />
    );
  }

  const forecasts = data.forecasts ?? [];
  const recommendations =
    data.recommendations ?? [];

  const upward = forecasts.filter(
    (item) => item.direction === "up",
  ).length;

  const downward = forecasts.filter(
    (item) => item.direction === "down",
  ).length;

  return (
    <main className="min-h-screen bg-background px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Business Analyst · Forecast
              </p>

              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
                See where your business is heading.
              </h1>

              <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
                Forecast signals are calculated from
                verified organization KPI records.
                TechUnified does not invent missing
                business data.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void onRefresh()}
              disabled={refreshing}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                className={
                  refreshing
                    ? "animate-spin"
                    : ""
                }
              />

              {refreshing
                ? "Refreshing…"
                : "Refresh forecast"}
            </button>
          </div>
        </header>

        {!forecasts.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="More data required">
              {data.message ||
                "More verified historical KPI data is required before TechUnified can produce a forecast."}
            </Panel>

            <Panel title="Next best action">
              <Link
                href="/brain/data-sources"
                className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
              >
                Connect a verified data source
                <ArrowRight size={15} />
              </Link>
            </Panel>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                title="Forecast signals"
                value={forecasts.length}
                description="Verified KPI forecast signals."
              />

              <MetricCard
                title="Upward signals"
                value={upward}
                description="KPIs currently trending upward."
              />

              <MetricCard
                title="Downward signals"
                value={downward}
                description="KPIs requiring closer review."
              />

              <MetricCard
                title="Evidence status"
                value="Verified"
                description="Based on organization-scoped KPI records."
              />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Panel title="Forecast overview">
                <div className="space-y-4">
                  {forecasts.map((item) => (
                    <div
                      key={item.name}
                      className="rounded-xl border border-border/60 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-foreground">
                            {item.name}
                          </p>

                          <p className="text-xs text-muted-foreground">
                            {item.source ||
                              "Verified KPI"}{" "}
                            ·{" "}
                            {item.period ||
                              "Recorded period"}
                          </p>
                        </div>

                        <span className="rounded-full border border-border/70 px-2.5 py-1 text-xs capitalize">
                          {item.direction}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Current
                          </p>

                          <strong className="text-foreground">
                            {item.current}{" "}
                            {item.unit || ""}
                          </strong>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">
                            Previous
                          </p>

                          <strong className="text-foreground">
                            {item.previous}{" "}
                            {item.unit || ""}
                          </strong>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">
                            Change
                          </p>

                          <strong className="text-foreground">
                            {item.changePercent}%
                          </strong>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">
                            Projected
                          </p>

                          <strong className="text-foreground">
                            {item.projected}{" "}
                            {item.unit || ""}
                          </strong>
                        </div>
                      </div>

                      <p className="mt-3 text-xs text-muted-foreground">
                        Confidence:{" "}
                        {item.confidence} · Evidence
                        periods:{" "}
                        {item.evidencePeriods}
                      </p>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Forecast recommendations">
                {recommendations.length ? (
                  <div className="space-y-4">
                    {recommendations.map(
                      (item) => (
                        <div
                          key={`${item.title}-${item.action}`}
                          className="rounded-xl border border-border/60 p-4"
                        >
                          <p className="font-medium text-foreground">
                            {item.title}
                          </p>

                          <p className="mt-1">
                            {item.message}
                          </p>

                          <p className="mt-2 text-foreground">
                            Suggested next step:{" "}
                            {item.action}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <p>
                    No directional recommendation is
                    currently supported by the verified KPI
                    evidence.
                  </p>
                )}
              </Panel>

              <Panel title="Forecast methodology">
                <p>
                  TechUnified compares the latest recorded
                  KPI value with its previous recorded value
                  and projects the observed change forward.
                </p>

                <p className="mt-2">
                  Forecast confidence reflects the available
                  evidence periods. It is not a guarantee of
                  future results.
                </p>
              </Panel>

              <Panel title="Data areas">
                <div className="flex flex-wrap gap-2">
                  {areas.map((area) => (
                    <span
                      key={area}
                      className="rounded-full border border-border/70 px-3 py-1.5 text-xs text-muted-foreground"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </Panel>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export function BusinessAnalystNav() {
  return (
    <nav
      aria-label="Business intelligence"
      className="flex flex-wrap gap-2"
    >
      <Link
        href="/brain"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        Company Brain
      </Link>

      <Link
        href="/business-analyst"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        Analyst
      </Link>

      <Link
        href="/brain/data-sources"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        Data Sources
      </Link>

      <Link
        href="/business-analyst/forecast"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        Forecast
      </Link>

      <Link
        href="/reports"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        Reports
      </Link>
    </nav>
  );
}
