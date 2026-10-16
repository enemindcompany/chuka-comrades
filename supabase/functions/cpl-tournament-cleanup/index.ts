import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const secret = Deno.env.get("CPL_CLEANUP_SECRET");
  if (!secret || req.headers.get("x-cpl-cleanup-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return new Response("Missing server configuration", { status: 500 });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: queue, error: queueError } = await admin
    .from("cpl_tournament_image_cleanup_queue").select("id,image_path").order("id").limit(100);
  if (queueError) return Response.json({ error: queueError.message }, { status: 500 });

  const removed: number[] = [];
  const failures: Array<{ id: number; message: string }> = [];
  for (const item of queue ?? []) {
    const { error: removeError } = await admin.storage.from("cpl-tournament-images").remove([item.image_path]);
    if (removeError) {
      failures.push({ id: item.id, message: removeError.message });
      continue;
    }
    const { error: deleteQueueError } = await admin.from("cpl_tournament_image_cleanup_queue").delete().eq("id", item.id);
    if (deleteQueueError) failures.push({ id: item.id, message: deleteQueueError.message });
    else removed.push(item.id);
  }

  // Expired records without images are deleted directly. Rows with images are first queued,
  // then deleted by the database cleanup function; Storage cleanup retries from the queue.
  const { data: expired, error: expiredError } = await admin.from("cpl_tournaments")
    .select("id,image_path").lte("expires_at", new Date().toISOString()).limit(100);
  if (expiredError) return Response.json({ removedImages: removed.length, failures, error: expiredError.message }, { status: 500 });
  const { error: cleanupError } = await admin.rpc("cpl_cleanup_expired_tournaments");
  if (cleanupError) return Response.json({ removedImages: removed.length, failures, error: cleanupError.message }, { status: 500 });
  return Response.json({ removedImages: removed.length, queuedImages: (queue ?? []).length - removed.length, expiredRecordsProcessed: (expired ?? []).length, failures });
});
