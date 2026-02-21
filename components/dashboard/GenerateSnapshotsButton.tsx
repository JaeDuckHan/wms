"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { generateStorageSnapshots } from "@/features/dashboard/api";
import { useToast } from "@/components/ui/toast";

function dateText(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function GenerateSnapshotsButton({
  warehouseId,
  clientId,
}: {
  warehouseId?: number;
  clientId?: number;
}) {
  const { pushToast } = useToast();
  const [pending, setPending] = useState(false);

  if (process.env.NODE_ENV === "production") return null;

  const run = async () => {
    setPending(true);
    try {
      for (let i = 0; i < 7; i += 1) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        await generateStorageSnapshots({
          date: dateText(date),
          warehouseId,
          clientId,
        });
      }
      pushToast({ title: "Generated snapshots for last 7 days", variant: "success" });
    } catch (error) {
      pushToast({
        title: error instanceof Error ? error.message : "Failed to generate snapshots",
        variant: "error",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <Button size="sm" variant="secondary" onClick={() => void run()} disabled={pending}>
      {pending ? "Generating..." : "Generate last 7 days snapshots (DEV)"}
    </Button>
  );
}
