import { route } from "@/lib/server/api";
import { getMeta } from "@/lib/server/services/setup";

export const GET = route(({ userId }) => getMeta(userId));
