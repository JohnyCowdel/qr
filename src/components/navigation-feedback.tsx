"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function toInternalPath(href: string): string | null {
  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

function shouldIgnoreAnchor(anchor: HTMLAnchorElement, event?: MouseEvent): boolean {
  if (!anchor.href) return true;
  if (anchor.target && anchor.target !== "_self") return true;
  if (anchor.hasAttribute("download")) return true;
  if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)) {
    return true;
  }

  const internalPath = toInternalPath(anchor.href);
  if (!internalPath) return true;

  return false;
}

export function NavigationFeedback() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPath = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  const [isNavigating, setIsNavigating] = useState(false);
  const startedAtRef = useRef(0);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchedRef = useRef(new Set<string>());

  useEffect(() => {
    if (!isNavigating) return;

    const elapsed = Date.now() - startedAtRef.current;
    const minVisibleMs = 220;
    const waitMs = Math.max(0, minVisibleMs - elapsed);

    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
    }

    stopTimerRef.current = setTimeout(() => {
      setIsNavigating(false);
    }, waitMs);

    return () => {
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
      }
    };
  }, [currentPath, isNavigating]);

  useEffect(() => {
    function markNavigating() {
      startedAtRef.current = Date.now();
      setIsNavigating(true);
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a") as HTMLAnchorElement | null;
      if (!anchor || shouldIgnoreAnchor(anchor)) return;
      const targetPath = toInternalPath(anchor.href);
      if (!targetPath || targetPath === currentPath) return;
      markNavigating();
    }

    function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a") as HTMLAnchorElement | null;
      if (!anchor || shouldIgnoreAnchor(anchor, event)) return;
      const targetPath = toInternalPath(anchor.href);
      if (!targetPath || targetPath === currentPath) return;
      markNavigating();
    }

    function onHoverPrefetch(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a") as HTMLAnchorElement | null;
      if (!anchor || shouldIgnoreAnchor(anchor)) return;
      const targetPath = toInternalPath(anchor.href);
      if (!targetPath || prefetchedRef.current.has(targetPath)) return;
      prefetchedRef.current.add(targetPath);
      router.prefetch(targetPath);
    }

    function onPopState() {
      markNavigating();
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("mouseover", onHoverPrefetch, true);
    window.addEventListener("popstate", onPopState);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("mouseover", onHoverPrefetch, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [currentPath, router]);

  useEffect(() => {
    document.body.classList.toggle("is-navigating", isNavigating);
    return () => {
      document.body.classList.remove("is-navigating");
    };
  }, [isNavigating]);

  return (
    <div
      aria-hidden="true"
      className={`nav-feedback ${isNavigating ? "nav-feedback--active" : ""}`}
    />
  );
}
