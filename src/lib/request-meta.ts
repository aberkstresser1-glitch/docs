import { headers } from "next/headers";

export async function requestMetadata() {
  const h = await headers();

  return {
    ipAddress:
      h.get("cf-connecting-ip") ??
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      null,
    userAgent: h.get("user-agent"),
  };
}
