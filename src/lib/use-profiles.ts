// React hook wrapper around the profile store with reactive updates.
import { useEffect, useState, useCallback } from "react";
import {
  listProfiles,
  getActiveProfile,
  type Profile,
} from "./profiles";

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [active, setActive] = useState<Profile | null>(null);

  const refresh = useCallback(() => {
    setProfiles(listProfiles());
    setActive(getActiveProfile());
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener("playlearn:profiles", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("playlearn:profiles", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  return { profiles, active, refresh };
}
