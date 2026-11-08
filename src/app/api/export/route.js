import { route } from "@/lib/server/api";
import { exportCsv } from "@/lib/server/services/export";

// Same filters as /api/search: from, to, q, type, categoryId, accountId, min, max.
export const GET = route(async ({ request, userId }) => {
  const csv = await exportCsv(userId, new URL(request.url).searchParams);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="money-manager-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
