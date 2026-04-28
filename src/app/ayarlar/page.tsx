"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Save, Bell, User, Shield, Palette, Loader2,
} from "lucide-react";

interface Me {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
}

interface NotificationPref {
  type: string;
  email: boolean;
  push: boolean;
  inApp: boolean;
}

const NOTIFICATION_LABELS: Record<string, { label: string; desc: string }> = {
  TASK_ASSIGNED: { label: "Görev atandığında", desc: "Size yeni bir görev eklendiğinde" },
  FILE_UPLOADED: { label: "Dosya yüklendiğinde", desc: "Bir içeriğe dosya eklendiğinde" },
  INTERNAL_APPROVED: { label: "İç onay tamamlandığında", desc: "İçerik iç onaydan geçtiğinde" },
  CLIENT_APPROVED: { label: "Müşteri onayladığında", desc: "Müşteri içeriği onayladığında" },
  CLIENT_REVISION: { label: "Revizyon istediğinde", desc: "Müşteri revizyon talep ettiğinde" },
  POST_FAILED: { label: "Yayın başarısız", desc: "Zamanlanan bir yayın başarısız olduğunda" },
  TOKEN_EXPIRING: { label: "Token sona ermeden", desc: "Sosyal medya token süresinden önce" },
  REMINDER: { label: "Hatırlatıcılar", desc: "Zaman odaklı hatırlatma bildirimleri" },
};

export default function AyarlarPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [meLoading, setMeLoading] = useState(true);
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  const [prefs, setPrefs] = useState<NotificationPref[]>([]);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsSaving, setPrefsSaving] = useState(false);

  const [current, setCurrent] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  const loadMe = useCallback(async () => {
    try {
      const res = await fetch("/api/users/me", { cache: "no-store" });
      if (!res.ok) throw new Error("Profil yüklenemedi");
      const json = (await res.json()) as { data: Me };
      setMe(json.data);
      setName(json.data.name);
      setImage(json.data.image ?? "");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setMeLoading(false);
    }
  }, []);

  const loadPrefs = useCallback(async () => {
    try {
      const res = await fetch("/api/users/me/notifications", { cache: "no-store" });
      if (!res.ok) throw new Error("Tercihler yüklenemedi");
      const json = (await res.json()) as { data: NotificationPref[] };
      setPrefs(json.data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setPrefsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
    loadPrefs();
  }, [loadMe, loadPrefs]);

  async function saveProfile() {
    if (!name.trim()) {
      toast.error("Ad boş olamaz");
      return;
    }
    setProfileSaving(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          image: image.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Kaydedilemedi");
      }
      toast.success("Profil güncellendi");
      await loadMe();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setProfileSaving(false);
    }
  }

  async function savePrefs() {
    setPrefsSaving(true);
    // Optimistic feedback: saat etkili değişim zaten local state'te
    try {
      const res = await fetch("/api/users/me/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefs }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Kaydedilemedi");
      }
      toast.success("Bildirim tercihleri kaydedildi");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bilinmeyen hata");
      await loadPrefs(); // rollback
    } finally {
      setPrefsSaving(false);
    }
  }

  function togglePref(type: string, channel: "email" | "push" | "inApp") {
    setPrefs((prev) =>
      prev.map((p) => (p.type === type ? { ...p, [channel]: !p[channel] } : p))
    );
  }

  async function changePassword() {
    if (newPass.length < 8) {
      toast.error("Yeni şifre en az 8 karakter olmalı");
      return;
    }
    if (newPass !== confirmPass) {
      toast.error("Yeni şifre ile tekrarı eşleşmiyor");
      return;
    }
    setPwSaving(true);
    try {
      const res = await fetch("/api/users/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: current,
          newPassword: newPass,
          confirmPassword: confirmPass,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Şifre güncellenemedi");
      }
      toast.success("Şifre güncellendi");
      setCurrent("");
      setNewPass("");
      setConfirmPass("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Ayarlar</h1>
        <p className="text-sm text-muted-foreground">Hesap ve uygulama ayarlarınızı yönetin</p>
      </div>

      <Tabs defaultValue="profil">
        <TabsList>
          <TabsTrigger value="profil" className="gap-1.5">
            <User className="h-3.5 w-3.5" /> Profil
          </TabsTrigger>
          <TabsTrigger value="bildirimler" className="gap-1.5">
            <Bell className="h-3.5 w-3.5" /> Bildirimler
          </TabsTrigger>
          <TabsTrigger value="guvenlik" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Güvenlik
          </TabsTrigger>
          <TabsTrigger value="gorunum" className="gap-1.5">
            <Palette className="h-3.5 w-3.5" /> Görünüm
          </TabsTrigger>
        </TabsList>

        {/* Profil */}
        <TabsContent value="profil" className="mt-4">
          <Card className="p-5 space-y-4">
            {meLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Yükleniyor…
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center text-foreground font-bold text-xl overflow-hidden">
                    {me?.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={me.image} alt={me.name} className="h-full w-full object-cover" />
                    ) : (
                      (me?.name ?? "?").charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">{me?.name}</p>
                    <p className="text-sm text-muted-foreground">{me?.email}</p>
                    <p className="text-[11px] text-muted-foreground">Rol: {me?.role}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Ad Soyad</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">E-posta</Label>
                    <Input
                      value={me?.email ?? ""}
                      className="h-9"
                      disabled
                    />
                    <p className="text-[10px] text-muted-foreground">E-posta değiştirmek için destekle iletişime geçin.</p>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">Profil Fotoğrafı URL</Label>
                    <Input
                      placeholder="https://..."
                      value={image}
                      onChange={(e) => setImage(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>

                <button
                  onClick={saveProfile}
                  disabled={profileSaving}
                  className={cn(
                    buttonVariants(),
                    "gap-2 bg-primary text-white hover:bg-primary/90"
                  )}
                >
                  {profileSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {profileSaving ? "Kaydediliyor…" : "Kaydet"}
                </button>
              </>
            )}
          </Card>
        </TabsContent>

        {/* Bildirimler */}
        <TabsContent value="bildirimler" className="mt-4">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Bildirim Tercihleri</h3>
              <button
                onClick={savePrefs}
                disabled={prefsSaving || prefsLoading}
                className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
              >
                {prefsSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {prefsSaving ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>

            {prefsLoading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Yükleniyor…
              </div>
            ) : (
              <div className="space-y-1">
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                  <span />
                  <span className="text-center w-12">E-posta</span>
                  <span className="text-center w-12">Push</span>
                  <span className="text-center w-12">Uygulama</span>
                </div>
                {prefs.map((p) => {
                  const meta = NOTIFICATION_LABELS[p.type] ?? { label: p.type, desc: "" };
                  return (
                    <div
                      key={p.type}
                      className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center py-2 border-b border-border/50 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium">{meta.label}</p>
                        <p className="text-[11px] text-muted-foreground">{meta.desc}</p>
                      </div>
                      <Toggle checked={p.email} onChange={() => togglePref(p.type, "email")} />
                      <Toggle checked={p.push} onChange={() => togglePref(p.type, "push")} />
                      <Toggle checked={p.inApp} onChange={() => togglePref(p.type, "inApp")} />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Güvenlik */}
        <TabsContent value="guvenlik" className="mt-4">
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold">Şifre Değiştir</h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Mevcut Şifre</Label>
                <Input
                  type="password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  className="h-9"
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Yeni Şifre</Label>
                <Input
                  type="password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  className="h-9"
                  placeholder="En az 8 karakter"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Yeni Şifre (Tekrar)</Label>
                <Input
                  type="password"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  className="h-9"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <button
              onClick={changePassword}
              disabled={pwSaving || !current || !newPass || !confirmPass}
              className={cn(
                buttonVariants(),
                "gap-2 bg-primary text-white hover:bg-primary/90"
              )}
            >
              {pwSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Shield className="h-4 w-4" />
              )}
              {pwSaving ? "Güncelleniyor…" : "Şifreyi Güncelle"}
            </button>
          </Card>
        </TabsContent>

        {/* Görünüm */}
        <TabsContent value="gorunum" className="mt-4">
          <Card className="p-5 space-y-3">
            <h3 className="text-sm font-semibold">Tema</h3>
            <p className="text-xs text-muted-foreground">
              Tema değiştirme yakında gelecek. Şu an sistem ayarınız kullanılıyor.
            </p>
            <div className="grid grid-cols-3 gap-3 opacity-60 pointer-events-none">
              {["Sistem", "Açık", "Koyu"].map((theme) => (
                <div
                  key={theme}
                  className={cn(
                    "rounded-xl border-2 p-3 text-sm font-medium text-center",
                    theme === "Sistem"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border"
                  )}
                >
                  {theme}
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer justify-self-center">
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
      <div className="w-9 h-5 bg-muted peer-checked:bg-primary rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
    </label>
  );
}
