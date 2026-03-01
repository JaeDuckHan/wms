"use client";

import { ErrorState } from "@/components/ui/ErrorState";

export default function InboundsError({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorState title="Failed to load inbound orders." message={error.message} onRetry={reset} />;
}
