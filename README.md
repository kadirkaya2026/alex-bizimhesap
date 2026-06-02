# alex-bizimhesap

WhatsApp asistanı (Alex 2) — eKatalox sipariş PDF'lerini okuyup onay sonrası [Bizimhesap](https://bizimhesap.com) `addinvoice` ile satış faturası açar.

Zyreos Alex ve eKatalox kod tabanından **bağımsızdır**.

## Özellikler

- Meta WhatsApp Cloud API webhook
- PDF dosyası veya eKatalox PDF linki (`/api/storefront/pdf/{uuid}`)
- OpenAI ile yapılandırılmış `OrderDraft` çıkarımı
- ONAYLA / İPTAL onay akışı
- Bizimhesap B2B `addinvoice` (satış, tip 3)
- PostgreSQL: tenant, allowlist, konuşma durumu, fiş işleri, audit log
- Sipariş numarası idempotency

## Hızlı başlangıç (yerel)

```bash
cp .env.example .env
# .env içinde DATABASE_URL, WEBHOOK_VERIFY_TOKEN, ALEX_ALLOWED_PHONES doldurun

docker compose up -d
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Health: http://localhost:3000/health

## Komutlar

| Komut | Açıklama |
|--------|----------|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | TypeScript derleme |
| `npm start` | Production |
| `npm run db:migrate` | Prisma migrate deploy |
| `npm run db:seed` | Pilot tenant + telefon allowlist |
| `npm run test:addinvoice` | Bizimhesap manuel smoke test |

## Dokümantasyon

- [Ön koşullar (Faz 0)](docs/PREREQUISITES.md)
- [Railway deploy](docs/DEPLOYMENT.md)
- [Pilot test checklist](docs/PILOT_CHECKLIST.md)

## Mimari

```
WhatsApp → /webhooks/whatsapp → allowlist → PDF/GPT → önizleme → ONAYLA → Bizimhesap
```

## Lisans

Private — asistanimalex
