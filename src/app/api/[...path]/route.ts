import { NextResponse } from "next/server";
import { getAppState, handle } from "@/lib/server/router";

export const dynamic = "force-dynamic";

async function run(request: Request): Promise<Response> {
  const state = await getAppState();
  const result = await handle(state, request);
  return NextResponse.json(result.body, { status: result.status });
}

export async function GET(request: Request): Promise<Response> {
  return run(request);
}

export async function POST(request: Request): Promise<Response> {
  return run(request);
}

export async function PUT(request: Request): Promise<Response> {
  return run(request);
}

export async function PATCH(request: Request): Promise<Response> {
  return run(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return run(request);
}
