import { z } from "zod";

const envSchema = z.object({
  MP_ACCESS_TOKEN: z.string().min(1, "MP_ACCESS_TOKEN é obrigatório"),
  MP_WEBHOOK_SECRET: z.string().min(1, "MP_WEBHOOK_SECRET é obrigatório"),
  // Duração ISO 8601 (ex.: PT30M = 30 minutos). Janela aceita pela Mercado Pago: 30min–30dias.
  MP_PIX_EXPIRATION: z
    .string()
    .regex(
      /^P(?!$)(\d+D)?(T(?!$)(\d+H)?(\d+M)?(\d+S)?)?$/,
      "MP_PIX_EXPIRATION deve ser uma duração ISO 8601 (ex.: PT30M)"
    )
    .default("PT30M"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatório"),
  APP_URL: z.string().optional(),
});

// Falha rápido na inicialização do processo se alguma env obrigatória estiver ausente/inválida —
// evita descobrir isso só quando um comprador tentar pagar.
export const env = envSchema.parse({
  MP_ACCESS_TOKEN: process.env.MP_ACCESS_TOKEN,
  MP_WEBHOOK_SECRET: process.env.MP_WEBHOOK_SECRET,
  MP_PIX_EXPIRATION: process.env.MP_PIX_EXPIRATION,
  DATABASE_URL: process.env.DATABASE_URL,
  APP_URL: process.env.APP_URL,
});
