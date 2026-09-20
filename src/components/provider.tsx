"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { api, ApiError, post } from "@/lib/client";
import type { Bootstrap } from "@/lib/types";
type Context = {
  data: Bootstrap | null;
  refresh: () => Promise<Bootstrap | null>;
  version: number;
  now: number;
  toast: (message: string) => void;
  mutate: <T>(
    path: string,
    body?: unknown,
    message?: string,
  ) => Promise<T | undefined>;
  requireAuth: () => boolean;
  busy: boolean;
  error: string | null;
};
const directoryCache = new Map<
  string,
  { expires: number; promise: Promise<unknown> }
>();
const AppContext = createContext<Context | null>(null);
export function Provider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Bootstrap | null>(null),
    [version, setVersion] = useState(0),
    [now, setNow] = useState(Date.now),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter(),
    pathname = usePathname(),
    offset = useRef(0),
    refreshGeneration = useRef(0),
    noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refresh = useCallback(async (invalidate = true) => {
    if (invalidate) directoryCache.clear();
    const generation = ++refreshGeneration.current;
    try {
      const result = await api<Bootstrap>("bootstrap");
      if (generation !== refreshGeneration.current) return null;
      offset.current = result.serverTime - Date.now();
      setData(result);
      setNow(result.serverTime);
      setError(null);
      setVersion((v) => v + 1);
      return result;
    } catch (e) {
      if (generation === refreshGeneration.current)
        setError(e instanceof Error ? e.message : "Unable to connect.");
      return null;
    }
  }, []);
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh(false);
    }, 30000);
    const focus = () => {
      if (document.visibilityState === "visible") void refresh(false);
    };
    document.addEventListener("visibilitychange", focus);
    window.addEventListener("online", focus);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", focus);
      window.removeEventListener("online", focus);
    };
  }, [refresh]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + offset.current), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!data?.session) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible")
        void post("study/heartbeat").catch(() => {});
    }, 60000);
    return () => clearInterval(timer);
  }, [data?.session?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const toast = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 6000);
  }, []);
  const requireAuth = () => {
    if (data?.user) return true;
    router.push(
      `/login?next=${encodeURIComponent(pathname + window.location.search)}`,
    );
    return false;
  };
  async function mutate<T>(
    path: string,
    body: unknown = {},
    message?: string,
  ): Promise<T | undefined> {
    setBusy(true);
    try {
      const result = await post<T>(path, body);
      await refresh();
      if (message) toast(message);
      return result;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401)
        router.push(
          `/login?next=${encodeURIComponent(pathname + window.location.search)}`,
        );
      toast(e instanceof Error ? e.message : "Something went wrong.");
      if (e instanceof ApiError && e.status === 409) await refresh();
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  return (
    <AppContext.Provider
      value={{
        data,
        refresh,
        version,
        now,
        toast,
        mutate,
        requireAuth,
        busy,
        error,
      }}
    >
      {children}
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button
            className="icon-button"
            aria-label="Dismiss message"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}
    </AppContext.Provider>
  );
}
export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("Missing provider");
  return context;
}
export function useResource<T>(path: string | null) {
  const { version, data: app } = useApp();
  const userId = app?.user?.id || "guest";
  const [result, setResult] = useState<{
    path: string;
    data: T | null;
    error: string | null;
  } | null>(null);
  useEffect(() => {
    let valid = true;
    if (!path) return;
    const key = `${userId}:${path}`;
    const cached = directoryCache.get(key);
    const catalog = path === "spots" || path.startsWith("spots?");
    const request =
      catalog && cached && cached.expires > Date.now()
        ? (cached.promise as Promise<T>)
        : api<T>(path);
    if (catalog && request !== cached?.promise) {
      if (directoryCache.size >= 12) directoryCache.clear();
      directoryCache.set(key, {
        expires: Date.now() + 120000,
        promise: request,
      });
      void request.catch(() => {
        if (directoryCache.get(key)?.promise === request)
          directoryCache.delete(key);
      });
    }
    request
      .then((data) => {
        if (valid) setResult({ path, data, error: null });
      })
      .catch((e) => {
        if (valid) setResult({ path, data: null, error: e.message });
      });
    return () => {
      valid = false;
    };
  }, [path, version, userId]);
  return {
    data: path && result?.path === path ? result.data : null,
    error: path && result?.path === path ? result.error : null,
    loading: !!path && result?.path !== path,
  };
}
