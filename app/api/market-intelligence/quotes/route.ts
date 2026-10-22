import { NextResponse } from "next/server";
import { getDemoQuoteEnvelope } from "@/lib/market-intelligence/market-data";

export const dynamic = "force-dynamic";

export function GET() {
  const payload = getDemoQuoteEnvelope();
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Market-Data-Mode": "simulation",
    },
  });
}
