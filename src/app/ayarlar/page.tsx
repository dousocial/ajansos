"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Save, Bell, User, Shield, Palette, CheckCircle2 } from "lucide-react";

export default function AyarlarPage() {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

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
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground font-bold text-xl">
                ?
              </div>
              <div>
                <p className="font-semibold text-muted-foreground">Ad Soyad</p>
                <p className="text-sm text-muted-foreground">—</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Ad Soyad</Label>
                <Input placeholder="Ad Soyad" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">E-posta</Label>
                <Input placeholder="ornek@email.com" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telefon</Label>
                <Input placeholder="+90 5__ ___ __ __" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Unvan</Label>
                <Input placeholder="Unvanınız" className="h-9" />
              </div>
            </div>

            <button
              onClick={handleSave}
              className={cn(
                buttonVariants(),
                "gap-2 bg-primary text-white hover:bg-primary/90"
              )}
            >
              {saved ? (
                <><CheckCircle2 className="h-4 w-4" /> Kaydedildi</>
              ) : (
                <><Save className="h-4 w-4" /> Kaydet</>
              )}
            </button>
          </Card>
        </TabsContent>

        {/* Bildirimler */}
        <TabsContent value="bildirimler" className="mt-4">
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-4">Bildirim Tercihleri</h3>
            <div className="space-y-3">
              {[
                { label: "Görev atandığında", desc: "Size yeni bir görev eklendiğinde" },
                { label: "Dosya yüklendiğinde", desc: "Bir içeriğe dosya eklendiğinde" },
                { label: "Müşteri onayladığında", desc: "Müşteri içeriği onayladığında" },
                { label: "Revizyon istediğinde", desc: "Müşteri revizyon talep ettiğinde" },
                { label: "Token sona ermeden", desc: "Sosyal medya token süresinden 3 gün önce" },
              ].map(({ label, desc }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-[11px] text-muted-foreground">{desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-9 h-5 bg-muted peer-checked:bg-primary rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                  </label>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Güvenlik */}
        <TabsContent value="guvenlik" className="mt-4">
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold">Şifre Değiştir</h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Mevcut Şifre</Label>
                <Input type="password" className="h-9" placeholder="••••••••" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Yeni Şifre</Label>
                <Input type="password" className="h-9" placeholder="••••••••" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Yeni Şifre (Tekrar)</Label>
                <Input type="password" className="h-9" placeholder="••••••••" />
              </div>
            </div>
            <button className={cn(buttonVariants(), "gap-2 bg-primary text-white hover:bg-primary/90")}>
              <Shield className="h-4 w-4" /> Şifreyi Güncelle
            </button>
          </Card>
        </TabsContent>

        {/* Görünüm */}
        <TabsContent value="gorunum" className="mt-4">
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-4">Tema</h3>
            <div className="grid grid-cols-3 gap-3">
              {["Sistem", "Açık", "Koyu"].map((theme) => (
                <button
                  key={theme}
                  className={cn(
                    "rounded-xl border-2 p-3 text-sm font-medium transition-all",
                    theme === "Sistem"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  {theme}
                </button>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
