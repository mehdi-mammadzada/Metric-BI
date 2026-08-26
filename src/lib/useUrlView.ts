import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Modul daxilindəki alt-görünüş (sub-view) vəziyyətini URL query parametrində
 * saxlayır. Bu sayədə səhifə refresh edildikdə istifadəçi olduğu bölmədə qalır.
 */
export function useUrlView<T extends string>(
  paramName: string,
  allowed: readonly T[],
): [T | null, (next: T | null) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const read = useCallback((): T | null => {
    const raw = searchParams.get(paramName);
    return raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, paramName]);

  const [view, setViewState] = useState<T | null>(read);

  // URL geri/irəli naviqasiyası ilə sinxron qalır.
  useEffect(() => {
    const fromUrl = read();
    setViewState(prev => (prev === fromUrl ? prev : fromUrl));
  }, [read]);

  const setView = useCallback((next: T | null) => {
    setViewState(next);
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      if (next) params.set(paramName, next);
      else params.delete(paramName);
      return params;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramName, setSearchParams]);

  return [view, setView];
}

/** Rəqəm indeksli alt-görünüşlər üçün (məs. Sazlamalar kartları). */
export function useUrlIndexView(
  paramName: string,
  count: number,
): [number | null, (next: number | null) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const read = useCallback((): number | null => {
    const raw = searchParams.get(paramName);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 && n < count ? n : null;
  }, [searchParams, paramName, count]);

  const [view, setViewState] = useState<number | null>(read);

  useEffect(() => {
    const fromUrl = read();
    setViewState(prev => (prev === fromUrl ? prev : fromUrl));
  }, [read]);

  const setView = useCallback((next: number | null) => {
    setViewState(next);
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      if (next === null) params.delete(paramName);
      else params.set(paramName, String(next));
      return params;
    }, { replace: true });
  }, [paramName, setSearchParams]);

  return [view, setView];
}
