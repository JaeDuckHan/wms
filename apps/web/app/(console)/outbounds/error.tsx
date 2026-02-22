"use client";

import { ErrorState } from "@/components/ui/ErrorState";

export default function OutboundsError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return <ErrorState title="Failed to load outbound orders." message={error.message} onRetry={reset} />;
}
