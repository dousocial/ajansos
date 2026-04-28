"use client";

/**
 * Global hata sınırı (App Router convention).
 *
 * Tüm `app/` segment'leri için fallback. Render path'inde fırlayan
 * unhandled exception'lar bu component'e düşer; aksi halde Next.js
 * "Application error: a client-side exception has occurred" beyaz
 * ekranı gösterir → kullanıcı ne olduğunu anlamaz.
 *
 * Her segment kendi `error.tsx`'ini ekleyerek daha lokal bir fallback
 * gösterebilir (örn. /icerikler altında sadece içerik listesi
 * dökülür, sidebar yaşar).
 */

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sentry/structured logger devreye girince buraya raporlama eklenecek.
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Bir şeyler ters gitti</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Beklenmeyen bir hata oluştu. Tekrar denemek isterseniz aşağıdaki
            butona tıklayabilirsiniz.
          </p>
        </div>
        {error.digest && (
          <p className="text-xs text-muted-foreground font-mono">
            Hata kodu: {error.digest}
          </p>
        )}
        <div className="flex gap-2 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
          >
            Tekrar dene
          </button>
          <a
            href="/"
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Ana sayfa
          </a>
        </div>
      </div>
    </div>
  );
}
