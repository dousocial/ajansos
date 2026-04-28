import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Kullanım Şartları — DouCRM",
  description: "DouCRM hizmet kullanım şartları.",
};

export default function TermsPage() {
  const lastUpdated = "28 Nisan 2026";
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="text-sm text-primary hover:underline">
          ← Ana sayfa
        </Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">
          Kullanım Şartları
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Son güncelleme: {lastUpdated}
        </p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground">
          <section>
            <h2 className="text-lg font-semibold mb-2">1. Hizmet</h2>
            <p>
              DouCRM, sosyal medya ajanslarının müşteri yönetimi, içerik üretim
              ve yayın akışını dijitalleştiren bir platformdur. Hizmeti
              kullanarak bu şartları kabul etmiş sayılırsınız.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Hesap</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Hesap oluşturmak için 18 yaşını doldurmuş olmalısınız.</li>
              <li>
                Hesap bilgilerinizin gizliliğinden ve hesap üzerinden yapılan
                tüm işlemlerden siz sorumlusunuz.
              </li>
              <li>
                Yetkisiz erişim tespit ederseniz hemen{" "}
                <a
                  href="mailto:info@dousocial.com"
                  className="text-primary underline"
                >
                  info@dousocial.com
                </a>{" "}
                ile iletişime geçin.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">
              3. Sosyal Medya Hesap Bağlama
            </h2>
            <p>
              Bağladığınız sosyal medya hesaplarına yalnızca yetkilendirme
              kapsamında erişiriz. Ücretsiz olarak istediğiniz zaman hesap
              bağlantısını kaldırabilirsiniz. Token&apos;larınız şifreli olarak
              saklanır.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. İçerik Sahipliği</h2>
            <p>
              Yüklediğiniz tüm içerikler size aittir. Hizmeti sunabilmek için
              içeriklerinizi platformlara aktarma ve depolama lisansını bize
              verirsiniz; bu lisans hizmet kullanımıyla sınırlıdır.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Yasaklar</h2>
            <p className="mb-2">Aşağıdaki içerikleri yayınlayamazsınız:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Yasadışı içerik</li>
              <li>Telif hakkı ihlali</li>
              <li>Nefret söylemi, şiddet teşviki</li>
              <li>Spam, otomatik istenmeyen içerik</li>
              <li>Üçüncü taraflara zarar verecek içerik</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Ödeme</h2>
            <p>
              Faturalandırma müşteri ile ajans arasındadır. DouCRM, ajansların
              kendi müşterilerine fatura kesmesi için araçlar sunar; bu
              fatura/ödeme işlemleri kullanıcının kendi sorumluluğundadır.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Hizmet Kesintisi</h2>
            <p>
              Bakım, güncelleme veya beklenmedik teknik sorunlar nedeniyle
              hizmette kesinti yaşanabilir. Bu kesintilerden doğacak dolaylı
              zararlardan sorumlu değiliz.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. Sorumluluk Reddi</h2>
            <p>
              Hizmet &ldquo;olduğu gibi&rdquo; sunulur. AI tarafından üretilen
              içerik öneriler niteliğindedir; yayınlamadan önce gözden
              geçirilmesi sizin sorumluluğunuzdur.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">9. Hesap Sonlandırma</h2>
            <p>
              Bu şartların ihlali halinde hesabınızı önceden bildirimde
              bulunmaksızın askıya alma veya kapatma hakkını saklı tutarız. Siz
              de istediğiniz zaman hesabınızı silmeyi talep edebilirsiniz.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">10. Yasa ve Yetki</h2>
            <p>
              Bu şartlar Türkiye Cumhuriyeti yasalarına tabidir. İhtilaf
              durumunda İstanbul Mahkemeleri yetkilidir.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">11. İletişim</h2>
            <p>
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
          <Link href="/data-deletion" className="hover:text-foreground">
            Veri Silme
          </Link>
        </footer>
      </main>
    </div>
  );
}
