import snapshot from "@/data/colorado.json";
export function GET() {
  return Response.json(snapshot, {
    headers: {
      "Content-Disposition": 'attachment; filename="deskhop-colorado-osm.json"',
      "Cache-Control": "public, max-age=86400",
    },
  });
}
