import { QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Factory (not a module-level singleton) so each request/mount gets its own
 * client — a shared instance would leak query cache across users during SSR.
 * staleTime is 30s: admin data (workers/courses/teams) only changes via user
 * actions that go through mutation invalidation, not concurrent external
 * actors, so short-lived staleness is fine and avoids refetching on every
 * window refocus / component remount.
 *
 * useQuery no longer takes an onError in v5, so fetch-failure toasts are
 * centralized here via QueryCache. Individual queries opt in with
 * `meta: { errorMessage: "..." }` to keep their original wording; queries
 * without it fall back to the raw error message. Background polling queries
 * (e.g. course generation-status) set `meta: { silent: true }` to suppress
 * the toast entirely — a single missed poll isn't worth surfacing, the next
 * interval tick retries automatically.
 */
export function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.meta?.silent) return;
        const message = (query.meta?.errorMessage as string | undefined) ?? error.message;
        toast.error(message);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
    },
  });
}
