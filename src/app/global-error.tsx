"use client";

/**
 * Root layout'ta fırlayan hatalar için fallback.
 *
 * `error.tsx` segment seviyesinde — root layout'taki bir hata için iş görmez.
 * `global-error.tsx` ise <html>/<body>'i kendi sarar. Bu yüzden tasarım
 * "minimal HTML doc" şeklinde olmak zorunda.
 */

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalRootError]", error);
  }, [error]);

  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#fff",
          color: "#111",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
            Uygulama açılırken bir hata oluştu
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#666", marginTop: "0.5rem" }}>
            Sayfayı yenilemeyi deneyebilirsiniz. Sorun devam ederse ekibimize
            iletin.
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: "0.75rem",
                color: "#888",
                marginTop: "0.75rem",
                fontFamily: "monospace",
              }}
            >
              Hata kodu: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              background: "#111",
              color: "#fff",
              border: 0,
              borderRadius: "0.375rem",
              cursor: "pointer",
            }}
          >
            Tekrar dene
          </button>
        </div>
      </body>
    </html>
  );
}
