/**
 * Ajans (satıcı) bilgileri — fatura başlığında ve e-posta "from" alanında kullanılır.
 *
 * MVP'de env'den okuyoruz; UI üzerinden yönetilen bir Settings tablosu yok. İleride
 * /ayarlar sayfasına "Ajans Bilgileri" sekmesi eklenip DB'ye taşınabilir.
 */

export interface AgencyInfo {
  name: string;
  address: string | null;
  taxId: string | null; // VKN
  taxOffice: string | null; // Vergi dairesi
  email: string | null;
  iban: string | null; // Faturanın alt kısmında müşteriye gösterilir
}

export function getAgencyInfo(): AgencyInfo {
  return {
    name: process.env.AGENCY_NAME ?? "AjansOS",
    address: process.env.AGENCY_ADDRESS ?? null,
    taxId: process.env.AGENCY_TAX_ID ?? null,
    taxOffice: process.env.AGENCY_TAX_OFFICE ?? null,
    email: process.env.AGENCY_EMAIL ?? null,
    iban: process.env.AGENCY_IBAN ?? null,
  };
}
