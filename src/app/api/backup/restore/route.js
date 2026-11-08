import { ApiError, readJson, route } from "@/lib/server/api";
import { downloadBackup } from "@/lib/server/drive";
import { restoreBackup } from "@/lib/server/services/backup";
import { str } from "@/lib/server/validate";

// Restores from a Drive file (`fileId`) or a manually imported file (`data`).
export const POST = route(async ({ request, userId }) => {
  const body = await readJson(request);
  let data;
  if (body.data !== undefined) {
    if (body.data === null || typeof body.data !== "object") {
      throw new ApiError(400, "Not a Money Manager backup.");
    }
    data = body.data;
  } else {
    const fileId = str(body.fileId, "fileId", { max: 200 });
    data = await downloadBackup(request.headers, fileId);
  }
  return restoreBackup(userId, data, body.mode);
});
