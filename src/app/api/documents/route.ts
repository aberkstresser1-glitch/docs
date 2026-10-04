import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createDocumentSchema = z.object({
  templateKey: z.literal("firearm_bill_of_sale"),
  role: z.enum(["BUYER", "SELLER"]),
  sellerState: z.string().length(2),
  buyerState: z.string().length(2),
  agreementDate: z.string().min(1),
  price: z.coerce.number().min(0),
  manufacturer: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(100),
  caliber: z.string().trim().min(1).max(60),
  firearmType: z.enum(["HANDGUN", "RIFLE", "SHOTGUN", "OTHER"]),
  serialNumber: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(4000).optional().default(""),
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
        error: "Please check the required sale details and try again.",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const interstate = data.sellerState !== data.buyerState;
  const otherRole = data.role === "BUYER" ? "SELLER" : "BUYER";
  const title = `${data.manufacturer} ${data.model} Bill of Sale`;

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
    firearm: {
      manufacturer: data.manufacturer,
      model: data.model,
      caliber: data.caliber,
      firearmType: data.firearmType,
      serialNumber: data.serialNumber,
      notes: data.notes,
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
        },
      },
    });

    return created;
  });

  return Response.json({ id: document.id }, { status: 201 });
}
