import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { prisma } from "@/lib/prisma";

const baseURL =
  process.env.BETTER_AUTH_URL ??
  process.env.APP_URL ??
  "http://localhost:3000";

const trustedOrigins = [
  baseURL,
  "http://127.0.0.1:3002",
  "http://localhost:3002",
];

export const auth = betterAuth({
  baseURL,
  trustedOrigins,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  advanced: {
    database: {
      joins: true,
    },
    ipAddress: {
      ipAddressHeaders: ["cf-connecting-ip"],
    },
  },
});
