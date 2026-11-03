import { z } from "zod";
// O SDK oficial não expõe uma opção de baseUrl — `AppConfig.BASE_URL` é um
// static mutável lido a cada request por `RestClient.fetch`
// (node_modules/mercadopago/dist/utils/restClient/index.js), então
// sobrescrever aqui redireciona toda chamada feita através do SDK para o
// fake local do harness sem precisar tocar em node_modules. Import profundo
// porque o pacote não exporta `AppConfig` publicamente.
import { AppConfig } from "mercadopago/dist/utils/config";

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
  // Só usado pelo harness E2E (harness/fake-mp) para redirecionar o SDK para o
  // fake local em vez da API real — nunca definido em produção.
  MP_API_BASE_URL: z.string().url().optional(),
  // Limites de taxa por IP (ver lib/rate-limit.ts). Configuráveis porque o
  // harness E2E roda muitas jornadas completas contra o MESMO app de
  // processo único a partir do MESMO IP (localhost) — sem isso, o próprio
  // teste de ponta a ponta tropeçaria no limite pensado para abuso real.
  PIX_CREATE_RATE_LIMIT: z.coerce.number().int().positive().default(10),
  MP_WEBHOOK_RATE_LIMIT: z.coerce.number().int().positive().default(60),
});

// Falha rápido na inicialização do processo se alguma env obrigatória estiver ausente/inválida —
// evita descobrir isso só quando um comprador tentar pagar.
export const env = envSchema.parse({
  MP_ACCESS_TOKEN: process.env.MP_ACCESS_TOKEN,
  MP_WEBHOOK_SECRET: process.env.MP_WEBHOOK_SECRET,
  MP_PIX_EXPIRATION: process.env.MP_PIX_EXPIRATION,
  DATABASE_URL: process.env.DATABASE_URL,
  APP_URL: process.env.APP_URL,
  MP_API_BASE_URL: process.env.MP_API_BASE_URL,
  PIX_CREATE_RATE_LIMIT: process.env.PIX_CREATE_RATE_LIMIT,
  MP_WEBHOOK_RATE_LIMIT: process.env.MP_WEBHOOK_RATE_LIMIT,
});

if (env.MP_API_BASE_URL) {
  // O `.d.ts` marca `BASE_URL` como readonly, mas é um campo estático comum em
  // JS puro — a leitura em runtime (RestClient.fetch) não distingue.
  (AppConfig as unknown as { BASE_URL: string }).BASE_URL = env.MP_API_BASE_URL;
}
