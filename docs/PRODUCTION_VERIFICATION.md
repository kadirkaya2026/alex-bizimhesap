# Production doğrulama (2026-06-03)

`npm run verify:prod` ile tekrarlanabilir.

## Otomatik kontroller

| Kontrol | Sonuç |
|---------|--------|
| `GET /health` | 200, `ok: true`, `db: up` |
| Webhook GET (yanlış token) | 403 |
| Webhook POST (imza yok) | 401 |
| Railway servis | Online |
| Log: `Allowlist: +905368592017` | Var |
| Log: `alex-bizimhesap started` | Var |

## Railway Variables (`railway run` — CLI inject)

| Değişken | Durum |
|----------|--------|
| `WEBHOOK_VERIFY_TOKEN` | SET |
| `ALEX_ALLOWED_PHONES` | SET (`+905368592017`) |
| `WHATSAPP_ACCESS_TOKEN` | MISSING |
| `WHATSAPP_PHONE_NUMBER_ID` | MISSING |
| `WHATSAPP_APP_SECRET` | MISSING (CLI); canlıda POST 401 → imza kontrolü aktif |
| `OPENAI_API_KEY` | MISSING |
| `BIZIMHESAP_FIRM_ID` | MISSING |
| `BIZIMHESAP_API_KEY` | MISSING |

**ONAYLA ve PDF önizleme için** Railway → alex-bizimhesap → Variables üzerinden yukarıdaki MISSING alanları doldurun, ardından redeploy.

## Manuel WhatsApp smoke

- [ ] `merhaba` → yardım metni (yetkili değil **değil**)
- [ ] eKatalox PDF linki / PDF dosyası → önizleme
- [ ] `ONAYLA` → Bizimhesap fatura (BH env dolu olmalı)

Log’da başarılı inbound sonrası işleme satırları görülmeli; `Invalid WhatsApp signature` yalnızca imzasız test isteklerinde normaldir.
