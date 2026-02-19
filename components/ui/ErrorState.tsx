"use client";

import { Button } from "@/components/ui/button";

export function ErrorState({
  title,
  message,
  onRetry,
}: {
  title: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-200 bg-white p-6">
      <p className="text-sm font-semibold text-red-700">{title}</p>
      {message && <p className="mt-1 text-xs text-slate-500">{message}</p>}
      {onRetry && (
        <Button className="mt-4" variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
