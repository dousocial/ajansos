"use client";

/**
 * ClientDocuments — Müşteri dökümanlarını (sözleşme/fatura PDF) listeleyen + upload eden bileşen.
 *
 * Kullanım:
 *   <ClientDocuments clientId={clientId} invoiceId={invoiceId} />
 *
 * - clientId verildiyse o müşterinin tüm dökümanları listelenir
 * - invoiceId verildiyse sadece o faturaya bağlı olanlar (CONTRACT/INVOICE_DOC/OTHER ayrımıyla)
 */

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import {
  FileText, Upload, Loader2, Trash2, ExternalLink, Paperclip, FileSignature,
} from "lucide-react";

type DocKind = "CONTRACT" | "INVOICE_DOC" | "OTHER";

interface DocRow {
  id: string;
  kind: DocKind;
  name: string;
  label: string | null;
  mimeType: string;
  sizeBytes: number;
  publicUrl: string;
  invoiceId: string | null;
  createdAt: string;
}

const KIND_META: Record<DocKind, { label: string; icon: React.ElementType; className: string }> = {
  CONTRACT: { label: "Sözleşme", icon: FileSignature, className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  INVOICE_DOC: { label: "Fatura", icon: FileText, className: "bg-blue-500/10 text-blue-700 border-blue-500/20" },
  OTHER: { label: "Diğer", icon: Paperclip, className: "bg-muted text-muted-foreground border" },
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ClientDocuments({
  clientId,
  invoiceId,
  defaultKind = "INVOICE_DOC",
}: {
  clientId: string;
  invoiceId?: string;
  defaultKind?: DocKind;
}) {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [kind, setKind] = useState<DocKind>(defaultKind);
  const [label, setLabel] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL(`/api/clients/${clientId}/documents`, window.location.origin);
      if (invoiceId) url.searchParams.set("invoiceId", invoiceId);
      const res = await fetch(url.pathname + url.search, { cache: "no-store" });
      if (!res.ok) throw new Error("Dökümanlar yüklenemedi");
      const json = (await res.json()) as { data: DocRow[] };
      setDocs(json.data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  }, [clientId, invoiceId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleFileSelected(file: File) {
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Dosya çok büyük (max 25 MB)");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      if (label.trim()) fd.append("label", label.trim());
      if (invoiceId) fd.append("invoiceId", invoiceId);

      const res = await fetch(`/api/clients/${clientId}/documents`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Yükleme başarısız");
      toast.success(`${file.name} yüklendi`);
      setLabel("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Yükleme hatası");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm("Bu dökümanı silmek istediğinizden emin misiniz?")) return;
    setDeletingId(docId);
    try {
      const res = await fetch(`/api/clients/${clientId}/documents/${docId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "Silinemedi");
      }
      setDocs((d) => d.filter((x) => x.id !== docId));
      toast.success("Döküman silindi");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Silme hatası");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Paperclip className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Dökümanlar</h2>
        <span className="text-xs text-muted-foreground">
          (Sözleşme &amp; Fatura PDF&apos;leri — max 25 MB)
        </span>
      </div>

      {/* Upload formu */}
      <div className="grid gap-3 sm:grid-cols-[160px_1fr_auto] sm:items-end">
        <div>
          <Label htmlFor="doc-kind" className="text-xs">Tür</Label>
          <select
            id="doc-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as DocKind)}
            className="w-full h-9 rounded-md border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="CONTRACT">Sözleşme</option>
            <option value="INVOICE_DOC">Fatura</option>
            <option value="OTHER">Diğer</option>
          </select>
        </div>
        <div>
          <Label htmlFor="doc-label" className="text-xs">Etiket (opsiyonel)</Label>
          <Input
            id="doc-label"
            placeholder="Örn: 2026 Yıllık Sözleşme"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
        <label
          className={cn(
            buttonVariants(),
            "gap-2 cursor-pointer",
            uploading && "opacity-60 pointer-events-none"
          )}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? "Yükleniyor…" : "Dosya Seç"}
          <input
            type="file"
            accept="application/pdf,image/*"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelected(f);
              // Aynı dosyayı tekrar seçebilmek için input'u resetle.
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor…
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          <FileText className="mx-auto h-6 w-6 opacity-40 mb-1" />
          Henüz döküman yok.
        </div>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => {
            const meta = KIND_META[d.kind];
            const Icon = meta.icon;
            return (
              <li
                key={d.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5 hover:bg-muted/30 transition-colors"
              >
                <div className={cn("h-9 w-9 rounded-lg border flex items-center justify-center shrink-0", meta.className)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {d.label || d.name}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Badge variant="outline" className="text-[10px] h-4 px-1">
                      {meta.label}
                    </Badge>
                    <span>{formatSize(d.sizeBytes)}</span>
                    <span>·</span>
                    <span>{formatDate(new Date(d.createdAt))}</span>
                  </div>
                </div>
                <a
                  href={d.publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 gap-1 text-xs")}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Aç
                </a>
                <button
                  type="button"
                  onClick={() => handleDelete(d.id)}
                  disabled={deletingId === d.id}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "h-8 text-rose-600 hover:bg-rose-50"
                  )}
                  aria-label="Sil"
                >
                  {deletingId === d.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
