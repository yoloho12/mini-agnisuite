"use client";

import { useContext, useEffect, useState } from "react";
import { fetchAccount } from "@/app/actions/settingsActions";
import {
  CurrentUserContext,
  type CurrentUserInfo,
} from "@/components/providers/CurrentUserProvider";

export type CurrentUser = CurrentUserInfo;

/**
 * Client hook to resolve the signed-in user's role. Used for UI-level
 * role-based visibility (buttons, tabs, routes). Server actions remain the
 * source of truth for write authorization.
 *
 * Inside the dashboard this reads the shared provider so every page uses the
 * same account request. Outside a provider it falls back to fetching alone.
 */
export function useCurrentUser(): { user: CurrentUser | null; loading: boolean } {
  const context = useContext(CurrentUserContext);
  const [fallbackUser, setFallbackUser] = useState<CurrentUser | null>(null);
  const [fallbackLoading, setFallbackLoading] = useState(context === null);

  useEffect(() => {
    if (context) return;
    let cancelled = false;
    setFallbackLoading(true);
    (async () => {
      try {
        const res = await fetchAccount();
        if (!cancelled && res.ok) {
          setFallbackUser(res.data as CurrentUser);
        }
      } catch {
        // Auth may not be configured in offline demo mode; treat as no user.
      } finally {
        if (!cancelled) setFallbackLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [context]);

  return context ?? { user: fallbackUser, loading: fallbackLoading };
}
