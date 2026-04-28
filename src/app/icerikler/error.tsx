"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function IceriklerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[IceriklerError]", error);
  }, [error]);

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div className="space-y-2 flex-1">
          <h3 className="font-semibold text-sm">İçerik listesi yüklenemedi</h3>
          <p className="text-sm text-muted-foreground">
            {error.message || "Beklenmeyen bir hata oluştu."}
          </p>
          <button
            type="button"
            onClick={reset}
            className="text-sm font-medium text-primary hover:underline"
          >
            Tekrar dene →
          </button>
        </div>
      </div>
    </div>
  );
}
