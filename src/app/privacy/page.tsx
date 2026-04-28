import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Gizlilik Politikası — DouCRM",
  description: "DouCRM gizlilik politikası ve veri kullanım şartları.",
};

// Public sayfa — auth GEREKMEZ. Meta / OAuth platformları bu URL'i indirip
// inceleyecek (App Review için zorunlu).
export default function PrivacyPolicyPage() {
  const lastUpdated = "28 Nisan 2026";
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="text-sm text-primary hover:underline">
          ← Ana sayfa
        </Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">
          Gizlilik Politikası
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Son güncelleme: {lastUpdated}
        </p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground">
          <section>
            <h2 className="text-lg font-semibold mb-2">1. Genel</h2>
            <p>
              DouCRM (&ldquo;biz&rdquo;), Dou Social tarafından işletilen, sosyal
              medya ajanslarının müşteri ve içerik yönetimini kolaylaştıran bir
              platformdur. Bu politika, hizmetimizi kullanırken topladığımız
              kişisel verileri ve bunları nasıl işlediğimizi açıklar.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Topladığımız Veriler</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Hesap bilgileri: ad, e-posta, şifre (hash&apos;li)</li>
              <li>Müşteri bilgileri: marka adı, iletişim, fatura bilgileri</li>
              <li>
                Sosyal medya hesap erişim bilgileri: OAuth token&apos;ları
                (şifrelenmiş şekilde saklanır)
              </li>
              <li>İçerik medyası: yüklediğiniz görsel ve videolar</li>
              <li>Kullanım analitikleri: hangi özelliklerin kullanıldığı</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">
              3. Verileri Nasıl Kullanırız
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Hizmeti sunmak ve sürdürmek</li>
              <li>İçerikleri planladığınız platformlara yayınlamak</li>
              <li>Faturalama ve ödeme işlemleri</li>
              <li>
                Hizmet kalitesini iyileştirmek için anonim kullanım istatistikleri
              </li>
              <li>Yasal yükümlülüklere uyum</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">
              4. Üçüncü Taraf Servisler
            </h2>
            <p className="mb-2">
              Hizmetimiz aşağıdaki üçüncü taraf servisleri kullanır:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Meta (Facebook, Instagram):</strong> İçerik yayınlama,
                analitik (yalnızca sizin yetkilendirdiğiniz hesaplara erişim).
              </li>
              <li>
                <strong>Google (YouTube):</strong> Video yayınlama (yetki
                kapsamında).
              </li>
              <li>
                <strong>LinkedIn:</strong> Paylaşım yetkisi (yetki kapsamında).
              </li>
              <li>
                <strong>TikTok:</strong> İçerik yayınlama (yetki kapsamında).
              </li>
              <li>
                <strong>Vercel, Neon, Supabase:</strong> Altyapı sağlayıcıları.
              </li>
              <li>
                <strong>Resend:</strong> E-posta gönderimi.
              </li>
              <li>
                <strong>Groq, Google Gemini:</strong> AI ile içerik önerisi
                (görselleriniz analiz için bu servislere yollanır).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Veri Saklama</h2>
            <p>
              Hesabınızı silene kadar verileriniz saklanır. Hesap silindikten
              sonra 30 gün içinde sistemlerimizden kaldırılır
              (yedekleme/audit nedeniyle bazı kayıtlar yasal süre boyunca
              korunabilir).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Haklarınız</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Verilerinize erişim talep etme</li>
              <li>Yanlış verilerin düzeltilmesini isteme</li>
              <li>Verilerinizin silinmesini isteme (KVKK / GDPR)</li>
              <li>Veri taşınabilirliği hakkı</li>
              <li>İşlemeye itiraz etme hakkı</li>
            </ul>
            <p className="mt-3">
              Talep için:{" "}
              <a
                href="mailto:info@dousocial.com"
                className="text-primary underline"
              >
                info@dousocial.com
              </a>{" "}
              veya{" "}
              <Link href="/data-deletion" className="text-primary underline">
                Veri Silme talebi sayfası
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Güvenlik</h2>
            <p>
              Sosyal medya OAuth token&apos;ları AES-256 ile şifrelenir.
              Şifreler bcrypt ile hash&apos;lenir. HTTPS zorunludur.
              Veritabanına yalnızca yetkili personel erişir.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. Çocuk Gizliliği</h2>
            <p>
              Hizmet 13 yaş altı kullanıcılara yönelik değildir; bu yaş altı
              kullanıcılardan bilerek veri toplamayız.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">9. Politika Değişiklikleri</h2>
            <p>
              Politikada önemli değişiklik olduğunda kayıtlı e-postanıza bildirim
              göndereceğiz ve bu sayfada güncel tarihi yansıtacağız.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">10. İletişim</h2>
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
          <Link href="/terms" className="hover:text-foreground mr-4">
            Kullanım Şartları
          </Link>
          <Link href="/data-deletion" className="hover:text-foreground">
            Veri Silme
          </Link>
        </footer>
      </main>
    </div>
  );
}
