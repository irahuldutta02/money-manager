import { route } from "@/lib/server/api";
import { buildBackup } from "@/lib/server/services/backup";

// Backup data for a manual file export; the browser encrypts/saves it.
export const GET = route(async ({ userId }) => buildBackup(userId));
