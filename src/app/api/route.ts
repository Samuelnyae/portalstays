import { NextResponse } from "next/server";
import { getAppState, handle } from "@/lib/server/router";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const state = await getAppState();
  const result = await handle(state, request);
  return NextResponse.json(result.body, { status: result.status });
}
