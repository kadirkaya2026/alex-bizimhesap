import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  WEBHOOK_VERIFY_TOKEN: z.string().min(8),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  BIZIMHESAP_FIRM_ID: z.string().optional(),
  BIZIMHESAP_API_KEY: z.string().optional(),
  BIZIMHESAP_BASE_URL: z.string().url().default("https://bizimhesap.com/api/b2b"),
  TENANT_NAME: z.string().default("Pilot Firma"),
  ALEX_ALLOWED_PHONES: z.string().default(""),
  DEFAULT_TAX_RATE: z.coerce.number().default(20),
  DEFAULT_DUE_DAYS: z.coerce.number().default(30),
  DEFAULT_CURRENCY: z.string().default("TL"),
  SKIP_WHATSAPP_SIGNATURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (!cached) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      console.error("Invalid environment:", parsed.error.flatten().fieldErrors);
      throw new Error("Invalid environment configuration");
    }
    cached = parsed.data;
  }
  return cached;
}

export function getAllowedPhonesFromEnv(): string[] {
  const raw = getEnv().ALEX_ALLOWED_PHONES;
  return raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

export function isWhatsAppConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);
}

export function isOpenAiConfigured(): boolean {
  return Boolean(getEnv().OPENAI_API_KEY);
}

export function isBizimhesapConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.BIZIMHESAP_FIRM_ID && env.BIZIMHESAP_API_KEY);
}
