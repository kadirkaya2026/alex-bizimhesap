# Railway — Agent / CLI ile kurulum

Cursor terminalinde Railway’e **sizin adınıza** bağlanmak için tek seferlik giriş gerekir.

## 1. Giriş (bir kez)

Terminalde (Cursor veya iTerm):

```bash
railway login
```

Tarayıcı açılır → Railway hesabınızla onaylayın.

Alternatif (tarayıcısız sunucu):

1. https://railway.app/account/tokens → **Create Token**
2. `export RAILWAY_TOKEN=...`

## 2. Projeyi bağla

```bash
cd /Users/kadirkaya/Desktop/alex-bizimhesap
railway link
```

Listeden **alex-bizimhesap** deploy ettiğiniz projeyi seçin.

Proje ID biliyorsanız:

```bash
export RAILWAY_PROJECT_ID=<project-id>
```

## 3. Otomatik kurulum scripti

```bash
npm run railway:setup
```

Script:

- Postgres eklemeyi dener
- `WEBHOOK_VERIFY_TOKEN` üretir
- `DATABASE_URL` → Postgres referansı
- Placeholder env’ler
- `.env` içindeki dolu secret’ları (varsa) Railway’e yazar
- Public domain oluşturmayı dener

## 4. Secret’ları tamamlayın

Railway panel → Service → **Variables**:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_APP_SECRET`
- `OPENAI_API_KEY`
- `BIZIMHESAP_FIRM_ID`
- `BIZIMHESAP_API_KEY`
- `ALEX_ALLOWED_PHONES` (gerçek numaralar)

## 5. Pilot numara (allowlist)

```bash
railway login   # bir kez
npm run railway:allow-phone
# veya: bash scripts/railway-allow-phone.sh +905368592017
```

Bu komut `ALEX_ALLOWED_PHONES` günceller ve redeploy tetikler. Container açılışında `scripts/seed-production.mjs` çalışır (`railway run db:seed` yerel makineden internal DB'ye erişemez).

Deploy için (Dockerfile değiştiyse): `railway up -d`

## 6. Seed + test

Deploy yeşil olduktan sonra:

```bash
railway run npm run db:seed
curl https://<domain>/health
```

## 7. Sorun

| Hata | Çözüm |
|------|--------|
| Unauthorized | `railway login` |
| Not linked | `railway link` |
| Invalid environment | `WEBHOOK_VERIFY_TOKEN` ve `DATABASE_URL` panelde var mı |
| Crash loop | Deploy logs → `prisma migrate` |
