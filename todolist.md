# AjansOS — Eksikler & Yapılacaklar Listesi

Son güncelleme: 2026-04-23

---

## KRİTİK (Uygulama çalışmıyor)

### K-1 — Middleware: Gerçek auth koruması yok ✅
**Dosya:** `src/proxy.ts` (eski `src/middleware.ts` silindi)
- Next.js 16'da `middleware` → `proxy` olarak yeniden adlandırıldı
- NextAuth `auth()` wrapper'ı proxy olarak kullanılıyor
- `auth.config.ts` içindeki `authorized` callback tüm rol bazlı mantığı yönetiyor
- [x] `auth()` proxy'e geçildi (`src/proxy.ts`)
- [x] Rol bazlı rota koruması eklendi (ADMIN/TEAM → app, CLIENT → /portal)
- [x] `/portal` rotası sadece CLIENT rolüne açık
- [x] Giriş yapmamış kullanıcı `/login`'e yönlendiriliyor
- [x] Giriş yapmış kullanıcı `/login`'e gelirse rol bazlı ana sayfasına yönlendiriliyor
- [x] Kök `/` rotası role göre `/dashboard` veya `/portal`'a yönlendiriyor

---

### K-2 — Yeni Müşteri formu kaydetmiyor ✅
**Dosya:** `src/app/musteriler/yeni/page.tsx:488`
- "Kaydet" butonu gerçek `POST /api/clients` çağrısı yapıyor
- [x] `handleSubmit` içinde `fetch('/api/clients', { method: 'POST', ... })` çağrısı eklendi
- [x] Başarı sonrası `/musteriler` sayfasına yönlendirme + `router.refresh()`
- [x] Sonner toast ile success/error bildirimi, submitting state + Loader2 spinner

---

### K-3 — Yeni İçerik formu kaydetmiyor ✅
**Dosyalar:** `src/app/icerikler/yeni/page.tsx:139`, `src/app/api/projects/route.ts`
- "Pipeline'a Ekle" ve "Taslak Kaydet" butonları gerçek `POST /api/projects` çağrısı yapıyor
- Müşteri listesi `GET /api/clients?limit=100` ile gerçek DB'den yükleniyor
- [x] `submitProject()` fonksiyonu ile `fetch('/api/projects', { method: 'POST', ... })` çağrısı eklendi
- [x] `useEffect` ile `GET /api/clients` çağrısı → `<select>` gerçek veriyle doluyor
- [x] `publishAt` + platform başına `ScheduledPost` API route içinde oluşturuluyor (client'ın `SocialAccount`'larına göre)
- [x] Bağlı hesabı olmayan platformlar `missingAccounts` olarak dönüyor ve kullanıcıya toast ile bildiriliyor
- [x] `shootDate` ve `publishAt` `new Date(...).toISOString()` ile ISO formatta gönderiliyor
- [x] Sonner toast + submitting state + Loader2 spinner

---

### K-4 — Dashboard tamamen demo veri ✅
**Dosya:** `src/app/dashboard/page.tsx`
- Sayfa async server component'e çevrildi; veri `prisma` ile direkt çekiliyor (ayrı `/api/dashboard` endpoint'e gerek kalmadı)
- [x] `clientCount`, `totalProjects` → `prisma.count()` (deletedAt=null)
- [x] Pipeline sayıları → `prisma.project.groupBy({ by: ['status'] })`
- [x] `pendingApprovals` = INTERNAL_REVIEW + CLIENT_REVIEW; `urgentCount` = CLIENT_REVIEW; `liveCount` = LIVE
- [x] Son 6 içerik → `prisma.project.findMany` (orderBy updatedAt desc, client.name include)
- [x] Kullanıcı adı `auth()` session'dan
- [x] AI Insight kartı sadece `urgentCount > 0` ise gösteriliyor
- [x] İçerik yoksa "İlk içeriği oluştur" empty state kartı
- [x] `export const dynamic = "force-dynamic"` — her istekte fresh veri

---

### K-5 — Müşteriler listesi boş (DB bağlantısı yok) ✅
**Dosyalar:** `src/app/musteriler/page.tsx`, `src/app/api/clients/route.ts`
- [x] `useEffect` + `fetch('/api/clients?limit=100')` ile gerçek veri çekiliyor
- [x] `loading`, `error`, empty state, Loader2 spinner
- [x] Client-side arama (name / industry / contactName)
- [x] Gerçek `healthScore`, `_count.projects`, `updatedAt` gösteriliyor
- [x] Platform ikonları için API GET'e `socialAccounts: { select: { platform: true } }` eklendi

---

### K-6 — Müşteri detay sayfası demo veri ✅
**Dosya:** `src/app/musteriler/[id]/page.tsx`
- [x] `GET /api/clients/{id}` ile müşteri + `socialAccounts` + son 10 proje tek çağrıda çekiliyor
- [x] Loading spinner, not-found state, error state
- [x] Aktif/tamamlanan projeler `projects` dizisinden filtreleniyor
- [x] Pipeline sayıları gerçek proje statülerinden hesaplanıyor
- [x] Sosyal hesap kartlarında gerçek `accountName` ve `tokenExpiresAt` gösteriliyor
- [x] Null alanlar için "—" fallback
- [x] STATUS_COLORS tailwind class string kullanımına geçirildi (inline hex olmadan)

---

### K-7 — İçerikler listesi boş (DB bağlantısı yok) ✅
**Dosya:** `src/app/icerikler/page.tsx`
- [x] `useEffect` + `fetch('/api/projects?limit=100')` ile gerçek veri çekiliyor
- [x] Loading, error, empty state eklendi
- [x] Pipeline status filter gerçek statü sayılarını gösteriyor
- [x] Arama title + client.name üzerinde çalışıyor
- [x] Platform ikonu artık `platforms[0]`'dan alınıyor, `formatDate` ile tarih gösterimi

---

### K-8 — İçerik detay sayfası demo veri ✅
**Dosya:** `src/app/icerikler/[id]/page.tsx`
- [x] `GET /api/projects/{id}` ile gerçek veri çekiliyor (client + scheduledPosts dahil)
- [x] Loading / not-found / error state
- [x] Caption editable + değişiklik varsa "Kaydet" butonu çıkıyor, `PATCH /api/projects/[id]` ile persist
- [x] "İç Onaya Gönder" → `PATCH status=INTERNAL_REVIEW`; "Revizyon İste" → `PATCH status=EDITING`
- [x] Hashtag'ler gerçek veriden render
- [x] AI asistan brief/brand voice/platform/postType bilgilerini gerçek veriden alıyor
- [x] Planlanmış yayınlar paneli eklendi (scheduledPosts listesi)

---

### K-9 — Portal onay sistemi DB'ye yazmıyor ✅
**Dosyalar:** `src/app/portal/page.tsx`, `src/app/api/portal/projects/route.ts`, `src/app/api/portal/projects/[id]/approval/route.ts`
- [x] `GET /api/portal/projects` — session'daki CLIENT user'ı `contactEmail` ile client'a bağlıyor ve projeleri dönüyor
- [x] `POST /api/portal/projects/[id]/approval` — decision=APPROVED/REVISION kabul ediyor
  - Projenin gerçekten bu client'a ait olduğunu doğruluyor
  - Sadece `CLIENT_REVIEW` durumundaki projeler onaylanabilir
  - `prisma.$transaction` ile status update + Approval kaydı atomic
  - `ActivityLog` yazılıyor
- [x] Portal sayfası `contents` state'ini API'den yüklüyor, client adı gerçek veriden
- [x] Onay → status=APPROVED, Revizyon → status=EDITING + note Approval.note'a yazılıyor
- [x] Her butonda loading spinner, toast success/error
- Not: Portal token doğrulaması Y-8'de tamamlandı — ADMIN/TEAM için imzalı JWT preview modu eklendi, CLIENT akışı session-based kaldı.

---

### K-10 — Görevlerim sayfası DB'ye bağlı değil ✅
**Dosyalar:** `src/app/gorevlerim/page.tsx`, `src/app/api/tasks/route.ts`
- [x] `GET /api/tasks?mine=true&limit=100` ile session kullanıcısının görevleri yükleniyor (`mine=true` flag eklendi)
- [x] Toggle `PATCH /api/tasks/[id] { completed: true/false }` ile persist + optimistic update + rollback
- [x] Acil tanımı: 48 saat içinde biten görevler
- [x] Loading, error, empty state, toast bildirimleri

---

### K-11 — Takvim sayfası DB'ye bağlı değil ✅
**Dosyalar:** `src/app/takvim/page.tsx`, `src/app/api/scheduled-posts/route.ts`
- Takvim artık `scheduledPost` tablosundan gerçek veriyi çekiyor
- [x] `GET /api/scheduled-posts` endpoint'i oluşturuldu (from/to/clientId/status filtreleri)
- [x] CLIENT rolü yalnızca kendi müşterisinin kayıtlarını görebiliyor (`contactEmail` üzerinden)
- [x] Takvim sayfası ay değiştikçe from/to aralığıyla yeniden yükleniyor
- [x] scheduledPost verileri gün hücrelerinde platform rengiyle, sağ panelde detay (saat + proje durumu) ile görünüyor
- [x] Bu ay sayacı (toplam / onay bekliyor / onaylandı) ve yaklaşan içerikler gerçek veriden

---

## YÜKSEK ÖNCELİKLİ

### Y-1 — Müşteri düzenleme sayfası mevcut değil ✅
**Dosya:** `src/app/musteriler/[id]/duzenle/page.tsx`
- Müşteri detay sayfasındaki "Düzenle" linki artık çalışan bir sayfaya gidiyor
- [x] `src/app/musteriler/[id]/duzenle/page.tsx` oluşturuldu (tek-sayfa form, stepper yok)
- [x] `GET /api/clients/[id]` ile mevcut değerler yükleniyor
- [x] `PATCH /api/clients/[id]` ile kayıt (name, industry, contact*, brandVoice, bannedWords, emojiPolicy, revisionQuota, healthScore)
- [x] Loading / not-found / load-error / validation-error durumları
- [x] Soft delete (Tehlikeli Bölge) — `DELETE /api/clients/[id]`

---

### Y-2 — İçerik durumu güncelleme API'si eksik (workflow) ✅
- `PATCH /api/projects/[id]` zaten `status` alanını destekliyor — K-8 kapsamında doğrudan bu endpoint kullanıldı
- [x] "İç Onaya Gönder" butonu `PATCH /api/projects/[id] { status: "INTERNAL_REVIEW" }` çağırıyor
- [x] "Revizyon İste" butonu `PATCH /api/projects/[id] { status: "EDITING" }` çağırıyor
- [x] Ayrı `/status` endpoint'ine gerek kalmadı (over-engineering kaçınıldı)

---

### Y-3 — Ayarlar sayfası hiçbir şeyi kaydetmiyor ✅
**Dosyalar:** `src/app/ayarlar/page.tsx`, `src/app/api/users/me/{route,password,notifications}.ts`
- Profil / bildirim / şifre üç sekmesi gerçek endpoint'lere yazıyor
- [x] `GET & PATCH /api/users/me` (name, image; email güvenlik için kilitli)
- [x] `PATCH /api/users/me/password` (bcrypt verify + yeni şifre min 8 karakter + confirm)
- [x] `GET & PATCH /api/users/me/notifications` (8 NotificationType için email/push/inApp upsert)
- [x] Ayarlar UI: avatar önizleme, rol rozeti, per-tip 3 kanal toggle, optimistic + rollback, şifre confirm/validation

---

### Y-4 — Bildirimler sayfası DB'ye bağlı değil ✅
**Dosyalar:** `src/app/bildirimler/page.tsx`, `src/app/api/notifications/{route,[id]/read/route}.ts`
- Sayfa artık `notification` tablosundan kullanıcıya özel kayıt çekiyor
- [x] `GET /api/notifications` (query: `unread=true`, `limit`) — meta.unreadCount döner
- [x] `PATCH /api/notifications/[id]/read` — sadece sahibi işaretleyebilir
- [x] `PATCH /api/notifications` — toplu okundu işaretleme
- [x] UI: görece zaman (az önce / N dk / saat / gün), entity tipine göre hedef link, optimistic işaretleme + rollback

---

### Y-5 — Raporlar sayfası sıfır veri gösteriyor ✅
**Dosyalar:** `src/app/raporlar/page.tsx`, `src/app/api/reports/route.ts`
- [x] `GET /api/reports` — KPI, aylık, platform, müşteri agregasyonu (CLIENT rolüne 403)
- [x] KPI: toplam/yayınlanan içerik + geçen aya göre değişim, ortalama onay süresi, aktif müşteri
- [x] Son 12 ay bar chart (`publishedAt` bazlı)
- [x] Platform tablosu: total / published / on-time ratio (publishedAt ↔ scheduledAt farkı ≤ 1 saat)
- [x] Müşteri tablosu: healthScore, published, CLIENT_REVIEW pending, on-time% — satır linkli
- [x] AI Insight yazısı gerçek verilere göre dinamik

---

### Y-6 — Instagram Reels yayınlama çalışmıyor ✅
**Dosya:** `src/app/api/meta/post/route.ts`
- Publish route'u artık proje postType'ına göre dallanıyor (IMAGE / VIDEO / REEL / CAROUSEL)
- [x] `createIgContainer()` helper — tüm container tiplerini tek yerden yönetiyor
- [x] `waitForContainerReady()` — `status_code=FINISHED` gelene kadar 2 sn aralıklarla poll (Reels için zorunlu)
- [x] REEL → `media_type=REELS` + `video_url`; VIDEO → `media_type=VIDEO` + `video_url`
- [x] CAROUSEL: child container'lar + `media_type=CAROUSEL` + `children`
- [x] Facebook tarafı: REEL/VIDEO için `/videos` endpoint (`file_url` + `description`)
- [x] Hata mesajı kullanıcıya dönüyor (önceden generic "İşlem başarısız" idi)

---

### Y-7 — Sosyal hesap bağlama butonu çalışmıyor ✅
**Dosya:** `src/app/musteriler/[id]/page.tsx`
- [x] Sosyal Hesaplar tabındaki "Meta Hesabı Bağla" kartı `<a href="/api/meta/oauth/start?clientId={id}">` ile Facebook OAuth'a yönlendiriyor
- [x] Label güncellendi: "Meta Hesabı Bağla" + açıklama ("Instagram & Facebook için Meta OAuth")

---

### Y-8 — Portal token güvenliği yok ✅
**Dosyalar:** `src/lib/portal-token.ts` (yeni), `src/app/api/portal/preview/route.ts` (yeni), `src/app/api/portal/projects/route.ts`, `src/auth.config.ts`, `src/app/portal/page.tsx`, `src/app/musteriler/[id]/page.tsx`
- [x] `jose` tabanlı imzalı JWT helper (`signPortalToken` / `verifyPortalToken`) — HS256, `kind: "portal-preview"`, 24 saat varsayılan geçerlilik, `AUTH_SECRET` ile imzalama
- [x] Yeni endpoint `GET /api/portal/preview?clientId=...` — yalnızca ADMIN/TEAM, müşteriyi doğrular, JWT üretir, `ActivityLog` "portal.preview_created" kaydı atar, `/portal?preview=<token>` adresine 302 yönlendirir
- [x] `/api/portal/projects` iki mod destekler: CLIENT oturumu (e-posta eşleşmesi) **veya** `?preview=<jwt>` + ADMIN/TEAM oturumu (salt-okunur). Dönen JSON `mode: "client" | "preview"` alanı içerir
- [x] `auth.config.ts` middleware'i — ADMIN/TEAM `/portal` adresine sadece `?preview=` query varsa girebilir; yoksa `/dashboard`a yönlendirilir
- [x] Portal sayfası — `?preview=` varsa API'ye token'ı aktarır, sarı "Önizleme modu" bandı gösterir, bekleyen kartlardaki Onayla/Revizyon butonlarını **gizler** (salt-okunur). Onay endpoint'i (`/api/portal/projects/[id]/approval`) hâlâ CLIENT oturumu ister, yani token bypass'ı mümkün değil.
- [x] Admin müşteri detayı — "Müşteri Portalı" butonu `/portal?token=demo_${id}` yerine `/api/portal/preview?clientId=${id}` API redirect'ine işaret ediyor (server-side imzalı JWT)
- Not: Onay/revizyon aksiyonları salt-okunur modda API tarafından da CLIENT rolü zorunlu — UI'da gizlemek ek kat güvenlik.

---

### Y-9 — Env değişkenleri dokümante edilmemiş ✅
**Dosya:** `.env.example`
- [x] `.env.example` oluşturuldu — tüm canlı kodda kullanılan değişkenler yorumlu örneklerle:
  - `DATABASE_URL`, `DIRECT_URL` (Supabase pooler + direct)
  - `AUTH_SECRET`, `NEXTAUTH_URL` (NextAuth v5)
  - `GEMINI_API_KEY`
  - `META_APP_ID`, `META_APP_SECRET`
  - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_BUCKET`
  - `TOKEN_ENCRYPTION_KEY` (64-hex char AES-256-GCM)
  - `RESEND_API_KEY`
  - `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`
  - `ENCRYPTION_KEY`

---

## ORTA ÖNCELİKLİ

### O-1 — TikTok yayınlama desteklenmiyor ✅ (geçici çözüm)
**Dosyalar:** `src/lib/constants.ts`, `src/app/icerikler/yeni/page.tsx`, `src/app/api/projects/route.ts`
- TikTok ayrı OAuth ve Content Posting API akışı gerektiriyor — tam entegrasyon ayrı bir task'a bırakıldı.
- [x] `SUPPORTED_PUBLISH_PLATFORMS = ["INSTAGRAM", "FACEBOOK"]` tek bir kaynaktan referans alınır, `isPlatformSupported()` helper eklendi
- [x] Yeni içerik formunda desteklenmeyen platform butonları disabled + "Yakında" rozetli — tıklama `toast.info` gösteriyor
- [x] `POST /api/projects` desteklenmeyen platformu 422 ile reddediyor — doğrudan API çağrısı için ek bir güvenlik katmanı
- Not: TikTok Display + Content Posting API entegrasyonu gelecekte ayrı bir backlog item'ı.

---

### O-2 — LinkedIn yayınlama desteklenmiyor ✅ (geçici çözüm)
**Dosyalar:** `src/lib/constants.ts`, `src/app/icerikler/yeni/page.tsx`, `src/app/api/projects/route.ts`
- O-1 ile aynı çözüm — LinkedIn UGC Posts API entegrasyonu gelecekte eklenecek.
- [x] LinkedIn için UI + API tarafında aynı gating mekanizması geçerli (`SUPPORTED_PUBLISH_PLATFORMS` tek noktadan yönetilir)

---

### O-3 — Cron job hata yönetimi eksik ✅
**Dosya:** `src/app/api/cron/publish/route.ts`
- [x] Exponential backoff retry: `delay = 5 dk * 2^retryCount`, `MAX_RETRIES = 5`
- [x] Cron hem `pending` hem `failed` (retryCount < MAX) post'ları tek sorguda toplar, backoff süresi dolmamış olanları `skipped: "backoff"` sonucuyla atlar
- [x] Internal fetch hatası durumunda manuel olarak `retryCount` arttırılır — sonsuz döngü riski kapatıldı
- [x] Response artık `attempted`, `succeeded`, `skipped` alanlarıyla ne olduğu hakkında daha fazla bilgi veriyor
- [x] `CRON_SECRET` `.env.example` içinde Y-9 kapsamında dokümante edildi
- Not: Token yenileme cron'u ayrı bir iş; gelecekte `/api/cron/refresh-tokens` olarak eklenebilir.

---

### O-4 — AI caption fallback hardcoded ✅
**Dosya:** `src/app/api/ai/caption/stream/route.ts`, `src/app/icerikler/[id]/page.tsx`
- [x] `DEMO_CAPTIONS` sabit tablosu komple kaldırıldı — hiçbir senaryoda uydurma caption dönmüyor
- [x] Gemini client lazy init — `GEMINI_API_KEY` yoksa modül yüklenirken patlamıyor, ilk isteğe temiz `error` event'i dönüyor
- [x] Tek ton başarısız olursa `{type: "tone_error", tone, message}` stream edilir, diğer tonlarla devam eder
- [x] Hiç öneri üretilemediyse `{type: "error", message}` + stream kapanır
- [x] Client `tone_error` → `toast.warning`, `error` → `toast.error` gösteriyor

---

### O-5 — auth.config.ts içinde gereksiz dummy provider ✅
**Dosya:** `src/auth.config.ts`
- [x] `loginSchema`, ölü `Credentials` provider ve gereksiz `zod`/`Credentials` import'ları kaldırıldı
- [x] Edge runtime için `providers: []` olarak bırakıldı (gerçek provider `auth.ts` içinde override ediyor)
- [x] Yoruma açıklama eklendi: neden edge'de Prisma/bcryptjs yok, gerçek credentials nerede

---

## TAMAMLANDI

- **K-1** — Middleware → Proxy geçişi + rol bazlı auth koruması (2026-04-23)
- **K-2** — Yeni Müşteri formu → `POST /api/clients` (2026-04-24)
- **K-3** — Yeni İçerik formu → `POST /api/projects` + `publishAt` bazlı `ScheduledPost` oluşturma (2026-04-24)
- **K-4** — Dashboard → async server component + Prisma (2026-04-24)
- **K-5** — Müşteriler listesi → `GET /api/clients` (2026-04-24)
- **K-6** — Müşteri detay → `GET /api/clients/[id]` (2026-04-24)
- **K-7** — İçerikler listesi → `GET /api/projects` (2026-04-24)
- **K-8** — İçerik detay → `GET/PATCH /api/projects/[id]` (caption & status) (2026-04-24)
- **K-9** — Portal CLIENT → `GET /api/portal/projects` + `POST /api/portal/projects/[id]/approval` (2026-04-24)
- **K-10** — Görevlerim → `GET /api/tasks?mine=true` + `PATCH /api/tasks/[id]` (optimistik) (2026-04-24)
- **K-11** — Takvim → `GET /api/scheduled-posts` (tarih aralığı, CLIENT scope) (2026-04-24)
- **Y-1** — Müşteri düzenleme sayfası → `PATCH/DELETE /api/clients/[id]` (2026-04-24)
- **Y-2** — İçerik durumu güncelleme workflow (K-8 kapsamında) (2026-04-24)
- **Y-3** — Ayarlar: profil/şifre/bildirim tercihleri endpoints (2026-04-24)
- **Y-4** — Bildirimler → `GET/PATCH /api/notifications` + `/[id]/read` (2026-04-24)
- **Y-5** — Raporlar → `GET /api/reports` (KPI + aylık + platform + müşteri) (2026-04-24)
- **Y-6** — Instagram Reels yayınlama (container polling + REELS media_type) (2026-04-24)
- **Y-7** — Sosyal hesap bağlama butonu Meta OAuth akışına yönlendiriyor (2026-04-24)
- **Y-8** — Portal preview JWT (imzalı token, salt-okunur mod, audit log) (2026-04-24)
- **Y-9** — `.env.example` — tüm env değişkenleri dokümante edildi (2026-04-24)
- **O-1** — TikTok platformu UI + API'de gated (SUPPORTED_PUBLISH_PLATFORMS) (2026-04-24)
- **O-2** — LinkedIn platformu UI + API'de gated (aynı mekanizma) (2026-04-24)
- **O-3** — Cron publish exponential backoff retry (5 dk * 2^retryCount, max 5) (2026-04-24)
- **O-4** — AI caption fallback kaldırıldı, stream üzerinden `error`/`tone_error` (2026-04-24)
- **O-5** — `auth.config.ts` edge temizliği (duplicate Credentials kaldırıldı) (2026-04-24)

---

## İlerleme

- Kritik: 11/11 ✅
- Yüksek: 9/9 ✅ (Y-1..Y-9 tamamlandı)
- Orta: 5/5 ✅ (O-1..O-5 tamamlandı)
- **Toplam: 25/25 ✅**
