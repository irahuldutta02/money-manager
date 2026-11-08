import { ApiError, readJson, route } from "@/lib/server/api";
import { restoreBackup } from "@/lib/server/services/backup";

// Restores from a backup file the user imported (`data`).
export const POST = route(async ({ request, userId }) => {
  const body = await readJson(request);
  if (body.data === null || typeof body.data !== "object") {
    throw new ApiError(400, "Not a Money Manager backup.");
  }
  return restoreBackup(userId, body.data, body.mode);
});
