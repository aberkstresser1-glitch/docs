import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createDocumentSchema = z
  .object({
    templateKey: z.literal("firearm_bill_of_sale"),
    role: z.enum(["BUYER", "SELLER"]),
    sellerState: z.string().length(2),
    buyerState: z.string().length(2),
    agreementDate: z.string().min(1),
    price: z.coerce.number().min(0),
    manufacturer: z.string().trim().max(100).optional(),
    model: z.string().trim().max(100).optional(),
    caliber: z.string().trim().max(60).optional(),
    firearmType: z.enum(["HANDGUN", "RIFLE", "SHOTGUN", "OTHER"]).optional(),
    serialNumber: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(4000).optional().default(""),
  })
  .superRefine((data, ctx) => {
    if (data.role !== "SELLER") return;

    const required: Array<
      ["manufacturer" | "model" | "caliber" | "firearmType" | "serialNumber", string | undefined]
    > = [
      ["manufacturer", data.manufacturer],
      ["model", data.model],
      ["caliber", data.caliber],
      ["firearmType", data.firearmType],
      ["serialNumber", data.serialNumber],
    ];

    for (const [field, value] of required) {
      if (!value?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: "Required for the Seller.",
        });
      }
    }
  });

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createDocumentSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        error: "Please check the required draft details and try again.",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const interstate = data.sellerState !== data.buyerState;
  const otherRole = data.role === "BUYER" ? "SELLER" : "BUYER";
  const sellerStarted = data.role === "SELLER";

  const firearm = sellerStarted
    ? {
        manufacturer: data.manufacturer,
        model: data.model,
        caliber: data.caliber,
        firearmType: data.firearmType,
        serialNumber: data.serialNumber,
        notes: data.notes,
      }
    : undefined;

  const title =
    sellerStarted && data.manufacturer && data.model
      ? `${data.manufacturer} ${data.model} Bill of Sale`
      : "Firearm Bill of Sale Draft";

  const payload = {
    templateKey: data.templateKey,
    templateVersion: 1,
    transaction: {
      agreementDate: data.agreementDate,
      price: data.price,
      sellerState: data.sellerState,
      buyerState: data.buyerState,
      interstate,
      externalFflRequired: interstate,
    },
    firearm,
    parties: {
      [data.role]: {
        fullName: session.user.name,
        state: data.role === "SELLER" ? data.sellerState : data.buyerState,
        email: session.user.email,
      },
    },
  };

  const document = await prisma.$transaction(async (tx) => {
    const created = await tx.document.create({
      data: {
        title,
        templateKey: data.templateKey,
        templateVersion: 1,
        creatorId: session.user.id,
        sellerJurisdiction: data.sellerState,
        buyerJurisdiction: data.buyerState,
        participants: {
          create: [
            {
              role: data.role,
              roleIndex: 0,
              userId: session.user.id,
              email: session.user.email,
              displayName: session.user.name,
              acceptedAt: new Date(),
            },
            {
              role: otherRole,
              roleIndex: 0,
            },
          ],
        },
      },
    });

    await tx.documentVersion.create({
      data: {
        documentId: created.id,
        version: 1,
        payload,
        createdById: session.user.id,
      },
    });

    await tx.auditEvent.create({
      data: {
        documentId: created.id,
        actorUserId: session.user.id,
        eventType: "DOCUMENT_CREATED",
        metadata: {
          templateKey: data.templateKey,
          role: data.role,
          interstate,
          firearmCompletedBySeller: sellerStarted,
        },
      },
    });

    return created;
  });

  return Response.json({ id: document.id }, { status: 201 });
}
