import { route } from "@/lib/server/api";
import { stats } from "@/lib/server/services/stats";

// ?kind=categories&from&to[&type]
export const GET = route(({ request, userId }) =>
  stats(userId, new URL(request.url).searchParams),
);
