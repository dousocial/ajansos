import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Veri Silme — DouCRM",
  description: "DouCRM hesabınızı ve verilerinizi silme talimatları.",
};

// Meta App Review için "Data Deletion Instructions URL" zorunlu.
// Public erişimli olmalı, kullanıcının nasıl veri silmesini talep edeceğini
// açıkça anlatmalı.
export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="text-sm text-primary hover:underline">
          ← Ana sayfa
        </Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">
          Veri Silme Talimatları
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          KVKK / GDPR uyumlu veri silme süreci.
        </p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground">
          <section>
            <h2 className="text-lg font-semibold mb-2">
              Hesabınızı ve Verilerinizi Nasıl Silersiniz?
            </h2>
            <p className="mb-2">
              DouCRM&apos;de saklanan tüm verilerinizi (hesap, müşteriler,
              içerikler, sosyal hesap token&apos;ları, faturalar, dosyalar) iki
              yoldan silebilirsiniz:
            </p>
          </section>

          <section className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-base font-semibold mb-2">
              Yöntem 1: Uygulama içinden
            </h3>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>
                <Link href="/login" className="text-primary underline">
                  Hesabınıza giriş yapın
                </Link>
              </li>
              <li>
                Sol alt menüden <strong>Ayarlar</strong> sekmesini açın
              </li>
              <li>
                <strong>Hesabı Sil</strong> bölümüne gidin
              </li>
              <li>
                Onaylayın — 30 gün içinde tüm verileriniz sistemlerimizden
                kaldırılır
              </li>
            </ol>
          </section>

          <section className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-base font-semibold mb-2">
              Yöntem 2: E-posta ile talep
            </h3>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>
                <a
                  href="mailto:info@dousocial.com?subject=Veri%20Silme%20Talebi"
                  className="text-primary underline"
                >
                  info@dousocial.com
                </a>{" "}
                adresine kayıtlı e-postanızdan mail atın
              </li>
              <li>
                Konu satırına: <code>Veri Silme Talebi</code>
              </li>
              <li>
                Mesajda: hesabınızla ilişkili e-posta + silinecek veri
                kapsamı (tüm hesap / sadece sosyal medya bağlantıları / belirli
                bir müşteri)
              </li>
              <li>30 gün içinde geri dönüş alırsınız</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Sosyal Medya Bağlantısı Kaldırma</h2>
            <p className="mb-2">
              Yalnızca bağladığınız bir sosyal hesabı (Instagram, Facebook, vb.)
              kaldırmak istiyorsanız:
            </p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>İlgili müşteri kartına gidin</li>
              <li>
                <strong>Sosyal Hesaplar</strong> sekmesini açın
              </li>
              <li>Hesap kartındaki çöp kutusu butonuna basın</li>
              <li>
                Onaylayın — token sistemden silinir, bu hesabın tüm
                ScheduledPost kayıtları da temizlenir
              </li>
            </ol>
            <p className="mt-3 text-xs text-muted-foreground">
              Ayrıca platformun kendi ayarlarından da DouCRM&apos;in erişimini
              iptal edebilirsiniz: Facebook Ayarlar &gt; Apps and Websites; Instagram
              Settings &gt; Apps and Websites; vb.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Hangi Veriler Silinir?</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Hesap bilgileri (ad, e-posta, hash&apos;li şifre)</li>
              <li>Tüm müşteri kayıtları</li>
              <li>İçerikler, projeler, dosyalar</li>
              <li>Sosyal medya OAuth token&apos;ları</li>
              <li>ScheduledPost ve yayın geçmişi</li>
              <li>Faturalar, abonelikler, ödeme kayıtları</li>
              <li>Aktivite logları</li>
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Yasal zorunluluk gereği bazı kayıtlar (ör. vergi mevzuatı için
              fatura) sınırlı süreyle anonim olarak korunabilir.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Veri Talebi (Erişim/İndirme)</h2>
            <p>
              KVKK ve GDPR kapsamında, hakkınızda tuttuğumuz tüm verileri JSON
              formatında talep edebilirsiniz. Aynı e-posta adresine{" "}
              <code>Veri Erişim Talebi</code> konusuyla mail atın.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">İletişim</h2>
            <p>
              <strong>Veri sorumlusu:</strong> Dou Social
              <br />
              <strong>E-posta:</strong>{" "}
              <a
                href="mailto:info@dousocial.com"
                className="text-primary underline"
              >
                info@dousocial.com
              </a>
            </p>
          </section>
        </div>

        <footer className="mt-16 pt-6 border-t border-border text-xs text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground mr-4">
            Gizlilik Politikası
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Kullanım Şartları
          </Link>
        </footer>
      </main>
    </div>
  );
}
