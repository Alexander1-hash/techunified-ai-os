export type MarketDataSource = "scripted-demo" | "provider";
export type MarketDataStatus = "simulated" | "live" | "delayed" | "unavailable";

export type NormalizedQuote = {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  price: number;
  changePercent24h: number | null;
  observedAt: string;
  receivedAt: string;
  source: MarketDataSource;
  status: MarketDataStatus;
  isTradable: false;
};

export type QuoteEnvelope = {
  schemaVersion: 1;
  generatedAt: string;
  dataMode: "simulation";
  quotes: NormalizedQuote[];
  warnings: string[];
};

export type ProviderQuoteInput = {
  symbol: string;
  price: number;
  changePercent24h?: number | null;
  observedAt: string;
};

const SYMBOL_PATTERN = /^[A-Z0-9]{2,15}-[A-Z0-9]{2,15}$/;

export function validateProviderQuote(input: ProviderQuoteInput): string[] {
  const errors: string[] = [];
  if (!SYMBOL_PATTERN.test(input.symbol)) errors.push("Symbol must use BASE-QUOTE format.");
  if (!Number.isFinite(input.price) || input.price <= 0) errors.push("Price must be a finite positive number.");
  if (input.changePercent24h != null && !Number.isFinite(input.changePercent24h)) {
    errors.push("24-hour change must be finite or null.");
  }
  const observed = Date.parse(input.observedAt);
  if (!Number.isFinite(observed)) errors.push("observedAt must be a valid ISO-compatible timestamp.");
  if (Number.isFinite(observed) && observed > Date.now() + 60_000) errors.push("observedAt cannot be more than one minute in the future.");
  return errors;
}

export function normalizeProviderQuote(input: ProviderQuoteInput, receivedAt = new Date()): NormalizedQuote {
  const errors = validateProviderQuote(input);
  if (errors.length) throw new Error(`Invalid quote: ${errors.join(" ")}`);
  const [baseAsset, quoteAsset] = input.symbol.split("-");
  const ageMs = receivedAt.getTime() - Date.parse(input.observedAt);
  return {
    symbol: input.symbol,
    baseAsset,
    quoteAsset,
    price: input.price,
    changePercent24h: input.changePercent24h ?? null,
    observedAt: new Date(input.observedAt).toISOString(),
    receivedAt: receivedAt.toISOString(),
    source: "provider",
    status: ageMs > 5 * 60_000 ? "delayed" : "live",
    isTradable: false,
  };
}

export function getDemoQuoteEnvelope(now = new Date()): QuoteEnvelope {
  const generatedAt = now.toISOString();
  const demoInputs: ProviderQuoteInput[] = [
    { symbol: "BTC-USD", price: 67420, changePercent24h: 1.24, observedAt: generatedAt },
    { symbol: "ETH-USD", price: 3520.5, changePercent24h: -0.38, observedAt: generatedAt },
    { symbol: "SOL-USD", price: 148.72, changePercent24h: 2.07, observedAt: generatedAt },
  ];
  return {
    schemaVersion: 1,
    generatedAt,
    dataMode: "simulation",
    quotes: demoInputs.map((input) => {
      const [baseAsset, quoteAsset] = input.symbol.split("-");
      return {
        symbol: input.symbol,
        baseAsset,
        quoteAsset,
        price: input.price,
        changePercent24h: input.changePercent24h ?? null,
        observedAt: generatedAt,
        receivedAt: generatedAt,
        source: "scripted-demo",
        status: "simulated",
        isTradable: false,
      };
    }),
    warnings: [
      "All values are scripted demonstration data, not live market prices.",
      "Quotes are non-tradable and must not be used to trigger orders.",
      "No external market-data provider is configured by this endpoint.",
    ],
  };
}
