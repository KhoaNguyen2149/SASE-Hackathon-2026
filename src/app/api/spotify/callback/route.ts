import { NextRequest, NextResponse } from "next/server";
import { appOrigin, completeConnect, spotifyEnabled } from "@/server/spotify";
import { AppError } from "@/server/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Spotify sends the person back here, so this answers with a redirect rather
// than the JSON the rest of the API returns.
export async function GET(req: NextRequest) {
  // The same origin that was registered with Spotify, not the request's.
  const origin = appOrigin();
  const back = (path: string, note?: string) =>
    NextResponse.redirect(
      origin + path + (note ? "?spotify=" + encodeURIComponent(note) : ""),
    );
  if (!spotifyEnabled()) return back("/profile", "unavailable");
  const code = req.nextUrl.searchParams.get("code"),
    state = req.nextUrl.searchParams.get("state"),
    denied = req.nextUrl.searchParams.get("error");
  if (denied || !code || !state) return back("/profile", "cancelled");
  try {
    const result = await completeConnect(code, state);
    return back(result.next, "connected");
  } catch (e) {
    console.error("Spotify connection failed", {
      errorType: e instanceof Error ? e.name : "unknown",
      code: e instanceof AppError ? e.code : undefined,
    });
    return back("/profile", "failed");
  }
}
