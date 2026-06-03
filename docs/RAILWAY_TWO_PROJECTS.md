# İki Railway projesi — hangisini kullanmalı?

## Sorun

Hesabınızda iki proje var:

| Proje | Durum | Sorun |
|-------|--------|--------|
| **accurate-analysis** | Build failed / Failed | `DATABASE_URL` yanlışlıkla `localhost` (`.env.example` kopyası) |
| **outstanding-quietude** | Online | Doğru kurulum, canlı URL |

## Canlı: accurate-analysis (Meta webhook burada)

1. Railway → **accurate-analysis** → **alex-bizimhesap**
2. Meta webhook: `https://alex-bizimhesap-production-c144.up.railway.app/webhooks/whatsapp`
3. Variables: `WHATSAPP_*`, `OPENAI_*`, `BIZIMHESAP_*`, `ALEX_ALLOWED_PHONES`, `DATABASE_URL=${{Postgres.DATABASE_URL}}`

CLI (secret import varsayılan projesi):

```bash
npm run railway:import-secrets   # accurate-analysis (a3b3d0fa-...)
curl https://alex-bizimhesap-production-c144.up.railway.app/health
```

## outstanding-quietude (yedek / eski deploy)

1. Railway → **outstanding-quietude** → **alex-bizimhesap**
2. Domain: `https://alex-bizimhesap-production.up.railway.app`
3. Meta webhook **buraya bağlanmamalı** (secret'lar iki projede karışmasın)

CLI:

```bash
RAILWAY_PROJECT_ID=62242262-362c-4bd9-a63d-1359a7cb401f npm run railway:import-secrets
```

## accurate-analysis kullanacaksanız

1. Panel → **+ New** → **Database** → **PostgreSQL** (projede Postgres yoktu)
2. `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (script: `bash scripts/railway-fix-database.sh`)
3. `npm run railway:import-secrets`
4. **Redeploy**
5. Meta webhook’u bu projenin **public domain**’ine güncelleyin (outstanding-quietude URL’si değilse)

## Log hatası açıklaması

```
Can't reach database server at `localhost:5432`
```

Container yerel `.env` Postgres’ine bağlanmaya çalışıyor; Railway’de çalışmaz.
