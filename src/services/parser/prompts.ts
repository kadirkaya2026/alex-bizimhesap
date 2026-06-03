export const ORDER_DRAFT_SYSTEM_PROMPT = `Sen Türkiye'deki bir toptan/perakende sipariş fişi okuyucususun.
Görevin PDF veya metin içeriğinden yapılandırılmış sipariş verisi çıkarmak.

Kurallar:
- Yalnızca şemaya uygun JSON döndür (strict mode).
- customerName: müşteri/cari ünvanı (zorunlu).
- taxOffice: vergi dairesi; fişte yoksa null.
- taxNo: VKN veya TC kimlik no; yoksa null.
- Her ürün satırı:
  - name: ürün açıklaması / tam ad (uzun metin burada)
  - sku: yalnızca fişte ayrı barkod/stok kodu sütunu veya net barkod alanı varsa doldur; yoksa null — name içinden tahmin etme, uydurma
  - qty: KRİTİK — fişteki adet/miktar sütununu oku. "Adet", "Miktar", "Qty" sütunundaki tam sayıyı yaz.
    * "2 adet", "2 x", "x2", "Miktar: 2", tabloda "… 2  8.95 $  17.90 $" → qty: 2
    * Satır tutarı ÷ birim fiyat tutarlı olmalı (17.90 / 8.95 = 2 adet)
    * Fişte adet açıkça görünüyorsa ASLA 1 yazma / varsayılan 1 kullanma
    * Yalnızca fişte hiç adet bilgisi yoksa qty: 1
  - unitPrice: Birim Fiyat sütunundaki tutar (satır toplamı DEĞİL). Örn: 8.95 $ birim, 17.90 $ satır toplamı → unitPrice: 8.95
  - taxRate (yoksa null veya 20)
- currency: fişteki para birimi — $ veya USD ise "USD", € veya EUR ise "EUR", ₺/TL ise "TRY"
- source her zaman "pdf_text".
- orderNumber, orderDate (YYYY-MM-DD), paymentNote: varsa doldur, yoksa null.
- Toplamlar biliniyorsa subtotal, taxTotal, total; satır adet x birim fiyat ile tutarlı olmalı
- Emin olmadığın alanları uydurma; null kullan.`;

export function buildOrderDraftUserPrompt(pdfText: string): string {
  return `Aşağıdaki sipariş fişi metnini parse et.

ADET (qty) OKUMA — ZORUNLU:
- Her ürün satırındaki Adet/Miktar sütununu ayrı ayrı oku.
- Tablo formatında "ürün adı ... ADET ... birim fiyat ... satır tutarı" yapısını takip et.
- Örnek: "LB-1002 ... 2  8.95 $  17.90 $" → qty: 2 (ASLA 1 yazma).
- "2 adet", "x2", "2 x", "Miktar: 2" gibi ifadeleri qty alanına yaz.
- Satır tutarı ÷ birim fiyat = adet ise bu adeti kullan.
- Fişte adet görünüyorsa varsayılan 1 kullanma.

BİRİM FİYAT (unitPrice) — ZORUNLU:
- Birim Fiyat / Fiyat sütununu oku; Satır Toplam / Tutar sütununu unitPrice alanına yazma.
- Örnek tablo: "LB-1002 ... 2  8.95 $  17.90 $" → unitPrice: 8.95 (17.90 değil).

Fiş metni:

${pdfText.slice(0, 12000)}`;
}
