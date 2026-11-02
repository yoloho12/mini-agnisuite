"use client";

import { createContext, useEffect, useMemo, useState } from "react";
import { fetchAccount } from "@/app/actions/settingsActions";
import type { UserRole } from "@/types";

export interface CurrentUserInfo {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  siteId: string | null;
  signature: string | null;
  assignedLocations: string[];
}

export interface CurrentUserState {
  user: CurrentUserInfo | null;
  loading: boolean;
}

export const CurrentUserContext = createContext<CurrentUserState | null>(null);

/**
 * Fetches the signed-in account once for the whole dashboard. Pages and the
 * sidebar consume this context so role checks stay consistent and only one
 * account request is made per navigation.
 */
export function CurrentUserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchAccount();
        if (!cancelled && res.ok) {
          setUser(res.data as CurrentUserInfo);
        }
      } catch {
        // Auth may not be configured in offline demo mode; treat as no user.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ user, loading }), [user, loading]);

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export default CurrentUserProvider;
