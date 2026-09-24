import "dotenv/config";
import { z } from "zod";

const booleanValue = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z.string().url().optional().or(z.literal("")),
    /**
     * JWT imzalama açarı BÜTÜN mühitlərdə məcburidir.
     *
     * Əvvəl burada `.default("edurate-local-development-secret")` var idi və 32
     * simvol yoxlaması yalnız `NODE_ENV === "production"` üçün işləyirdi. Yəni
     * development, test, staging, Docker, self-host və fork mühitlərində tətbiq
     * səssizcə koda yazılmış, ictimai-məlum açarla imzalayırdı; onu bilən
     * istənilən şəxs saxta (forged) token düzəldib autentifikasiyanı keçə və
     * admin hesabını ələ keçirə bilərdi (CWE-798).
     *
     * İndi default YOXDUR: açar verilməyibsə və ya zəifdirsə server ümumiyyətlə
     * qalxmır (fail-fast) — mühitdən asılı olmayaraq.
     */
    JWT_SECRET: z
      .string({ error: "JWT_SECRET təyin edilməlidir. Güclü açar yarat: openssl rand -base64 48" })
      .min(32, { error: "JWT_SECRET ən az 32 simvol olmalıdır. Güclü açar yarat: openssl rand -base64 48" }),
    JWT_EXPIRES_IN: z.string().default("30d"),
    FRONTEND_URL: z
      .string()
      .default("http://localhost:3000,https://edu-rate-nu.vercel.app"),
    TRUST_PROXY: booleanValue,
    /**
     * Admin API-si üçün iki mərhələli giriş məcburidir. Verilməyibsə: test
     * mühitindən başqa hər yerdə `true`. `false` yalnız fövqəladə hal üçündür
     * (sahib həm telefonu, həm bərpa kodlarını itiribsə).
     */
    ADMIN_2FA_REQUIRED: z.enum(["true", "false"]).optional(),
    SEED_DEMO_DATA: booleanValue,
    RESEND_API_KEY: z.string().optional().or(z.literal("")),
    BREVO_API_KEY: z.string().optional().or(z.literal("")),
    EMAIL_FROM: z.string().default("EduRate <onboarding@resend.dev>"),
    PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
    SWAGGER_PUBLIC: booleanValue,
    CLOUDINARY_CLOUD_NAME: z.string().optional().or(z.literal("")),
    CLOUDINARY_API_KEY: z.string().optional().or(z.literal("")),
    CLOUDINARY_API_SECRET: z.string().optional().or(z.literal("")),
    CLOUDINARY_UPLOAD_PRESET: z.string().optional().or(z.literal("")),
    VAPID_PUBLIC_KEY: z.string().optional().or(z.literal("")),
    VAPID_PRIVATE_KEY: z.string().optional().or(z.literal("")),
    VAPID_SUBJECT: z.string().default("mailto:support@edurate.az"),
  })
  .superRefine((value, context) => {
    // Koddan silinmiş köhnə default və sənədlərdəki nümunə mətn ictimai-məlumdur.
    // Kimsə onları .env-ə köçürübsə uzunluq yoxlamasını keçə bilər, ona görə
    // açıq şəkildə rədd edirik.
    const publiclyKnownSecrets = new Set([
      "edurate-local-development-secret",
      "minimum-32-simvolluq-unikal-production-sirri",
    ]);
    if (publiclyKnownSecrets.has(value.JWT_SECRET.trim())) {
      context.addIssue({
        code: "custom",
        path: ["JWT_SECRET"],
        message:
          "JWT_SECRET ictimai-məlum nümunə dəyərdir. Öz açarını yarat: openssl rand -base64 48",
      });
    }

    if (value.NODE_ENV === "production" && !value.DATABASE_URL) {
      context.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message: "Production mühitində DATABASE_URL tələb olunur.",
      });
    }

    if (value.NODE_ENV === "production" && value.SEED_DEMO_DATA) {
      context.addIssue({
        code: "custom",
        path: ["SEED_DEMO_DATA"],
        message: "Production mühitində demo məlumat seed etmək qadağandır.",
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // `treeifyError` konsolda `[Array]` kimi kəsilirdi və developer əsl səbəbi
  // görmürdü. Hər problemi "SAHƏ: mesaj" şəklində açıq yazırıq ki, nəyi
  // düzəltmək lazım olduğu dərhal aydın olsun.
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(kök)"}: ${issue.message}`)
    .join("\n");
  console.error(`Environment dəyişənləri yanlışdır:\n${details}`);
  throw new Error("Server konfiqurasiyası yanlışdır.");
}

export const env = {
  ...parsed.data,
  DATABASE_URL: parsed.data.DATABASE_URL || undefined,
  ADMIN_2FA_REQUIRED: parsed.data.ADMIN_2FA_REQUIRED
    ? parsed.data.ADMIN_2FA_REQUIRED === "true"
    : parsed.data.NODE_ENV !== "test",
  ALLOWED_ORIGINS: parsed.data.FRONTEND_URL.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  RESEND_API_KEY: parsed.data.RESEND_API_KEY || undefined,
  BREVO_API_KEY: parsed.data.BREVO_API_KEY || undefined,
  CLOUDINARY_CLOUD_NAME: parsed.data.CLOUDINARY_CLOUD_NAME || undefined,
  CLOUDINARY_API_KEY: parsed.data.CLOUDINARY_API_KEY || undefined,
  CLOUDINARY_API_SECRET: parsed.data.CLOUDINARY_API_SECRET || undefined,
  CLOUDINARY_UPLOAD_PRESET: parsed.data.CLOUDINARY_UPLOAD_PRESET || undefined,
  VAPID_PUBLIC_KEY: parsed.data.VAPID_PUBLIC_KEY || undefined,
  VAPID_PRIVATE_KEY: parsed.data.VAPID_PRIVATE_KEY || undefined,
};
