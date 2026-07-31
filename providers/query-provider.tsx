"use client";

import { useEffect, useRef, useState } from "react";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useOrganization } from "@clerk/nextjs";
import { makeQueryClient } from "@/lib/query-client";

/**
 * Clears the whole query cache when the user's active Clerk organization
 * changes. All admin query keys are unscoped by orgId (the API resolves org
 * from the session server-side), so without this a switch would keep
 * showing the previous org's cached workers/courses/teams until each query
 * happened to refetch on its own.
 */
function OrgCacheReset() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();
  const previousOrgId = useRef<string | undefined>(undefined);

  useEffect(() => {
    const currentOrgId = organization?.id;
    if (previousOrgId.current !== undefined && previousOrgId.current !== currentOrgId) {
      queryClient.clear();
    }
    previousOrgId.current = currentOrgId;
  }, [organization?.id, queryClient]);

  return null;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={client}>
      <OrgCacheReset />
      {children}
      {process.env.NODE_ENV === "development" && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
