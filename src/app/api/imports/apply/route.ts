import { isSameOrigin } from "@/lib/request-origin";
import { createClient } from "@/lib/supabase/server";
import { validateImport, type ImportItem } from "@/lib/imports/types";
export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  const raw = await request.text();
  if (raw.length > 250000)
    return Response.json(
      { error: "Import up to 50 items at a time." },
      { status: 413 },
    );
  let body: { items: ImportItem[] };
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid import" }, { status: 400 });
  }
  if (
    !Array.isArray(body?.items) ||
    !body.items.length ||
    body.items.length > 50
  )
    return Response.json({ error: "Select 1–50 items." }, { status: 400 });
  for (const item of body.items) {
    const issue = validateImport(item);
    if (issue) return Response.json({ error: issue }, { status: 400 });
  }
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return Response.json({ error: "Sign in again" }, { status: 401 });
  const results = [];
  for (const item of body.items) {
    const { data, error } = await db.rpc("apply_import_item", { p_item: item });
    if (error)
      results.push({
        sourceKey: item.sourceKey,
        kind: item.kind,
        error: "Could not import this item. Check the destination and retry.",
      });
    else results.push({ sourceKey: item.sourceKey, kind: item.kind, ...data });
  }
  return Response.json(
    { results },
    { headers: { "Cache-Control": "no-store" } },
  );
}
