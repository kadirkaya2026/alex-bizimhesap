# Bizimhesap API bağlama (Alex 2)

Kod tarafı hazır: WhatsApp’ta **ONAYLA** → `POST /api/b2b/addinvoice`.

## 1. Bizimhesap’tan alınacaklar

Pilot firma için Bizimhesap destek / panelden:

| Değişken | Açıklama |
|----------|----------|
| `BIZIMHESAP_FIRM_ID` | FirmID (tekil firma kimliği) |
| `BIZIMHESAP_API_KEY` | B2B API token (Bearer) |

Dokümantasyon: https://apidocs.bizimhesap.com/addinvoice

Varsayılan endpoint: `https://bizimhesap.com/api/b2b` (`BIZIMHESAP_BASE_URL`).

## API uçları (kodda)

| Metot | URL | Kod |
|-------|-----|-----|
| AddInvoice | `POST /addinvoice` | `postAddInvoice` — WhatsApp ONAYLA akışı |
| CancelInvoice | `POST /cancelinvoice` | `postCancelInvoice` |
| AddCustomer | `POST /addcustomer` | `postAddCustomer` |
| AddProduct | `POST /addproduct` | `postAddProduct` |
| Products | `GET /products` | `listProducts` — `token` header |
| Warehouses | `GET /warehouses` | `listWarehouses` |
| Inventory | `GET /inventory/{depo-id}` | `getWarehouseInventory` |
| Customers | `GET /customers` | `listCustomers` |
| Abstract | `GET /abstract/{musteri-id}` | `getCustomerAbstract` |

POST fatura uçları `firmId` ile body'de gider; GET uçları `BIZIMHESAP_API_KEY` değerini `token` header'ında kullanır.

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

1. eKatalox PDF linki veya PDF → önizleme gelir
2. **ONAYLA** → Bizimhesap satış faturası (`invoiceType: 3`)
3. WhatsApp cevabı: `Fişlendi.` + guid + link

Hata varsa mesajda `Bizimhesap hatası: ...` görünür; Railway log: `addinvoice failed`.

## 5. Cari / ürün eşlemesi (opsiyonel)

İlk kurulumda sadece **ünvan** (`customer.title`) ve **ürün adı** gider; Bizimhesap yeni cari/ürün oluşturabilir veya hata dönebilir (firma ayarına bağlı).

Kalıcı eşleme için PostgreSQL tabloları:

- `customer_mappings` — `local_name` → `bizimhesap_customer_id`
- `product_mappings` — `local_sku` / `local_name` → `bizimhesap_product_id`

Pilot için önce tek test faturası (`test:addinvoice`) ile API’nin açık olduğunu doğrulayın.

## 6. Kontrol listesi

- [ ] `BIZIMHESAP_FIRM_ID` Railway’de SET
- [ ] `BIZIMHESAP_API_KEY` Railway’de SET
- [ ] `npm run test:addinvoice` başarılı (yerel)
- [ ] WhatsApp önizleme → ONAYLA → fişlendi
