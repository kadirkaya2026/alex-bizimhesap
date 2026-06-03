# Bizimhesap API bağlama (Alex 2)

Kod tarafı hazır: WhatsApp'ta **ONAYLA** → `POST /api/b2b/addinvoice`.

## 1. Bizimhesap'tan alınacaklar

Pilot firma için Bizimhesap destek / panelden:

| Değişken | Açıklama |
|----------|----------|
| `BIZIMHESAP_FIRM_ID` | FirmID (tekil firma kimliği) |
| `BIZIMHESAP_API_KEY` | B2B API token (Bearer) |
| `BIZIMHESAP_DEFAULT_WAREHOUSE_ID` | Stok uyarısı için depo ID (opsiyonel) |

Dokümantasyon: https://apidocs.bizimhesap.com/addinvoice

Varsayılan endpoint: `https://bizimhesap.com/api/b2b` (`BIZIMHESAP_BASE_URL`).

## API uçları (kodda)

| Metot | URL | Kod |
|-------|-----|-----|
| AddInvoice | `POST /addinvoice` | `postAddInvoice` — WhatsApp ONAYLA akışı |
| CancelInvoice | `POST /cancelinvoice` | `postCancelInvoice` |
| AddCustomer | `POST /addcustomer` | `postAddCustomer` |
| AddProduct | `POST /addproduct` | `postAddProduct` |
| Products | `GET /products` | `listProducts` — `Key` + `token` header |
| Warehouses | `GET /warehouses` | `listWarehouses` |
| Inventory | `GET /inventory/{depo-id}` | `getWarehouseInventory` |
| Customers | `GET /customers` | `listCustomers` |
| Abstract | `GET /abstract/{musteri-id}` | `getCustomerAbstract` |

POST fatura uçları `firmId` ile body'de gider; GET uçları `BIZIMHESAP_FIRM_ID` → `Key` ve `BIZIMHESAP_API_KEY` → `token` header'ında kullanılır.

## 2. Railway (production)

**Secret'ları Meta webhook'un bağlı olduğu projeye yazın** (şu an: **accurate-analysis**, domain `...-c144...`).

`npm run railway:import-secrets` varsayılan olarak accurate-analysis projesine gider. Health kontrolü de **aynı domain** üzerinden yapın:

```bash
curl https://alex-bizimhesap-production-c144.up.railway.app/health
```

**accurate-analysis** → **alex-bizimhesap** → **Variables**:

```
BIZIMHESAP_FIRM_ID=<FirmID>
BIZIMHESAP_API_KEY=<API token>
BIZIMHESAP_DEFAULT_WAREHOUSE_ID=<depo-id>
```

Kaydet → **Redeploy** (container seed ile tenant kaydına da yazar).

CLI (`.env.railway.secrets` dosyasına iki satır ekleyip):

```bash
npm run railway:import-secrets
```

Veya tek komut:

```bash
npm run railway:bizimhesap -- <FirmID> <API_KEY>
```

## 3. Yerel smoke test (önerilir)

```bash
# .env içine FirmID ve API key yazın
npm run test:addinvoice
```

Başarılı yanıt: `{ "error": "", "guid": "...", "url": "..." }`

## 4. WhatsApp uçtan uç test

1. eKatalox PDF linki veya PDF → önizleme gelir (cari/ürün eşleşme satırları ile)
2. **ONAYLA** → Bizimhesap satış faturası (`invoiceType: 3`)
3. WhatsApp cevabı: `Fişlendi.` + guid + link

Hata varsa mesajda `Bizimhesap hatası: ...` görünür; Railway log: `addinvoice failed`.

## 5. Cari / ürün eşleştirmesi (hibrit)

Alex ONAYLA öncesi **hibrit eşleştirme** yapar:

1. PostgreSQL `customer_mappings` / `product_mappings` tabloları
2. Bulunamazsa Bizimhesap kataloğu (`GET /customers`, `GET /products`) — vergi no, barkod/SKU, isim
3. Katalog eşleşmesi tabloya **otomatik kaydedilir** (auto-learn)
4. Eşleşmeyen cari veya ürün varsa **ONAYLA engellenir** — yeni kayıt oluşturulmaz

Stok uyarısı (engelleme yok):

- Depo: `BIZIMHESAP_DEFAULT_WAREHOUSE_ID` (Railway Variables) veya tenant `default_warehouse_id`
- Ayar yoksa ilk depo otomatik seçilir (log uyarısı)
- Yetersiz stok → önizlemede ⚠ gösterilir; ONAYLA ile devam edilebilir

### İlk kurulum — kataloğu tabloya aktar

Production'da catalog sync **her deploy'da otomatik** çalışır (`scripts/sync-catalog-production.mjs`).

Yerel geliştirme için:

```bash
npm run sync:catalog-mappings
```

**Önemli:** `railway run npm run sync:catalog-mappings` komutu **Mac'inizde** çalışır; `postgres.railway.internal` hostname'i yerel makineden çözülmez. Production DB'ye sync için redeploy yapın veya `railway ssh` ile container içinde çalıştırın.

Bu komut Bizimhesap'taki tüm cari/ürünleri mapping tablolarına yazar. PDF'deki isimler farklıysa manuel düzeltme gerekebilir.

Tablolar:

- `customer_mappings` — `local_name` → `bizimhesap_customer_id`
- `product_mappings` — `local_sku` / `local_name` → `bizimhesap_product_id`

Önizleme mesajında her satır için ✓/✗ ve stok durumu görünür.

## 6. Kontrol listesi

- [ ] `BIZIMHESAP_FIRM_ID` Railway'de SET
- [ ] `BIZIMHESAP_API_KEY` Railway'de SET
- [ ] `BIZIMHESAP_DEFAULT_WAREHOUSE_ID` (opsiyonel, stok uyarısı için)
- [ ] `npm run sync:catalog-mappings` (ilk kurulum)
- [ ] `npm run test:addinvoice` başarılı (yerel)
- [ ] WhatsApp önizleme → eşleşme satırları görünür → ONAYLA → fişlendi
