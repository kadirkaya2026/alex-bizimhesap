# Meta webhook — cevap gelmiyor / Bizimhesap hatası

## Hangi Railway projesi?

Meta webhook ve secret'lar **aynı projede** olmalı.

| Proje | Public domain | Meta webhook |
|-------|---------------|--------------|
| **accurate-analysis** | `alex-bizimhesap-production-c144.up.railway.app` | **Kullanın (mevcut)** |
| outstanding-quietude | `alex-bizimhesap-production.up.railway.app` | Sadece CLI test için; webhook buraya gitmemeli |

Project ID (accurate-analysis): `a3b3d0fa-b151-4ca9-a6d2-327ad9d4a5b1`

**Önemli:** `npm run railway:import-secrets` varsayılan olarak **accurate-analysis** projesine yazar. Başka projeye yazmak için `RAILWAY_PROJECT_ID=...` kullanın.

## Belirti: cevap gelmiyor

Railway loglarında `alex-bizimhesap started` var ama mesaj sonrası şunlar **yok**:

- `POST /webhooks/whatsapp`
- `Invalid WhatsApp signature`
- `Inbound message processing failed`

→ Meta webhook URL yanlış veya abonelik/test numarası eksik.

## Belirti: Bizimhesap "Hatalı firma kodu"

Webhook **accurate-analysis**'te, `BIZIMHESAP_FIRM_ID` başka projede (outstanding-quietude) ise bu hata oluşur.

Doğrulama:

```bash
curl https://alex-bizimhesap-production-c144.up.railway.app/health
```

Beklenen: `"firmIdSuffix":"90C5"`, `"firmIdLength":32`, `"invalidPlaceholder":false`

## Callback URL

```
https://alex-bizimhesap-production-c144.up.railway.app/webhooks/whatsapp
```

## Meta panel kontrol listesi

1. [developers.facebook.com](https://developers.facebook.com) → **Alex-Bizimhesap** uygulaması
2. WhatsApp → **Configuration** → Webhook
3. **Callback URL** = yukarıdaki adres
4. **Verify token** = Railway → **accurate-analysis** → alex-bizimhesap → `WEBHOOK_VERIFY_TOKEN` (birebir aynı)
5. **Webhook fields** → `messages` işaretli
6. Development mod: test numarası `+905368592017` ekli
7. Mesaj **Phone Number ID** `1210963775429516` olan hatta

## Secret senkronizasyonu (accurate-analysis)

```bash
cd /Users/kadirkaya/Desktop/alex-bizimhesap
npm run railway:fix-db
npm run railway:import-secrets
railway redeploy -p a3b3d0fa-b151-4ca9-a6d2-327ad9d4a5b1 -e production -s alex-bizimhesap -y
```

## Doğrulama

```bash
railway logs -p a3b3d0fa-b151-4ca9-a6d2-327ad9d4a5b1 -e production -s alex-bizimhesap
```

Mesaj sonrası `POST /webhooks/whatsapp` veya işleme logları görünmeli.

## İmza geçtikten sonra cevap yoksa

Log: `WhatsApp send failed` + `401` → yeni `WHATSAPP_ACCESS_TOKEN` → `npm run railway:import-secrets` → redeploy.
