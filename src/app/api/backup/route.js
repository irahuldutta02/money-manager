import { created, route } from "@/lib/server/api";
import {
  isDriveConnected,
  listBackups,
  pruneBackups,
  uploadBackup,
} from "@/lib/server/drive";
import { buildBackup } from "@/lib/server/services/backup";

// On demand only: nothing here runs unless the user taps the button.
export const GET = route(async ({ request }) => {
  if (!(await isDriveConnected(request.headers))) {
    return { connected: false, backups: [] };
  }
  return { connected: true, backups: await listBackups(request.headers) };
});

export const POST = route(async ({ request, userId }) => {
  const data = await buildBackup(userId);
  const name = `money-manager-backup-${data.exportedAt.replace(/[:.]/g, "-")}.json`;
  const file = await uploadBackup(request.headers, name, data);
  const backups = await pruneBackups(request.headers);
  return created({
    file,
    backups,
    counts: {
      accounts: data.accounts.length,
      categories: data.categories.length,
      transactions: data.transactions.length,
      budgets: data.budgets.length,
    },
  });
});
