import { promises as fs } from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import type { FirearmPayload } from "@/lib/document-types";

type Completion = {
  dealerName?: string;
  dealerAddress?: string;
  dealerCity?: string;
  dealerState?: string;
  dealerZip?: string;
  dealerLicenseNumber?: string;
  transferDate?: string;
  notes?: string;
};

function money(value: unknown) {
  const number = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(number)
    ? number.toLocaleString("en-US", { style: "currency", currency: "USD" })
    : "—";
}

function signedAtLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
}

function signatureDataUrl(style: string) {
  try {
    const parsed = JSON.parse(style) as { kind?: string; dataUrl?: string };
    if (
      parsed.kind === "typed-cursive-png-v1" &&
      parsed.dataUrl?.startsWith("data:image/png;base64,")
    ) {
      return parsed.dataUrl;
    }
  } catch {
    // Older signatures stored a simple style label.
  }

  return null;
}

export async function generateStoredPdf(documentId: string) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      participants: true,
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        include: {
          signatures: {
            orderBy: { signedAt: "asc" },
          },
        },
      },
    },
  });

  if (!document) throw new Error("Document not found");
  const version = document.versions[0];
  if (!version) throw new Error("Document version not found");

  const payload = (version.payload ?? {}) as FirearmPayload;
  const transaction = payload.transaction ?? {};
  const firearm = payload.firearm ?? {};
  const parties = payload.parties ?? {};
  const completion = (document.externalCompletion ?? null) as Completion | null;

  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  let page = pdf.addPage([612, 792]);
  const margin = 54;
  const width = 612 - margin * 2;
  let y = 738;

  function newPage() {
    page = pdf.addPage([612, 792]);
    y = 738;
  }

  function ensure(height = 28) {
    if (y - height < 54) newPage();
  }

  function line(
    text: string,
    options?: { size?: number; font?: typeof regular; gap?: number },
  ) {
    const size = options?.size ?? 10.5;
    const font = options?.font ?? regular;
    const gap = options?.gap ?? 16;
    ensure(gap + 6);
    page.drawText(text || "—", {
      x: margin,
      y,
      size,
      font,
      color: rgb(0.08, 0.1, 0.14),
      maxWidth: width,
    });
    y -= gap;
  }

  function wrapped(text: string, font = regular, size = 10.5) {
    const words = (text || "—").split(/\s+/);
    let current = "";
    const lines: string[] = [];

    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) <= width) {
        current = test;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);

    for (const item of lines) line(item, { font, size, gap: 15 });
  }

  function heading(text: string) {
    ensure(36);
    y -= 5;
    line(text.toUpperCase(), { font: bold, size: 12, gap: 22 });
  }

  function field(label: string, value: unknown) {
    const rendered = value === null || value === undefined || value === "" ? "—" : String(value);
    ensure(18);
    page.drawText(`${label}:`, {
      x: margin,
      y,
      size: 9.5,
      font: bold,
      color: rgb(0.25, 0.29, 0.36),
    });
    page.drawText(rendered, {
      x: margin + 145,
      y,
      size: 10,
      font: regular,
      color: rgb(0.08, 0.1, 0.14),
      maxWidth: width - 145,
    });
    y -= 17;
  }

  line(
    transaction.interstate
      ? document.status === "FINALIZED"
        ? "INTERSTATE FIREARM BILL OF SALE"
        : "INTERSTATE FIREARM SALE AGREEMENT"
      : "FIREARM BILL OF SALE",
    { font: bold, size: 19, gap: 26 },
  );
  line(document.title, { font: bold, size: 13, gap: 22 });

  if (transaction.interstate && document.status !== "FINALIZED") {
    wrapped(
      "This signed agreement records the parties' transaction terms but does not itself complete an interstate firearm transfer. Completion is pending the required receiving-FFL process.",
      italic,
      9.5,
    );
    y -= 8;
  }

  heading("Sale");
  field("Agreement date", transaction.agreementDate);
  field("Price", money(transaction.price));
  field("Seller state", transaction.sellerState);
  field("Buyer state", transaction.buyerState);

  heading("Firearm");
  field("Manufacturer", firearm.manufacturer);
  field("Model", firearm.model);
  field("Caliber / gauge", firearm.caliber);
  field("Type", firearm.firearmType);
  field("Serial number", firearm.serialNumber);
  if (firearm.notes) {
    line("Condition / notes:", { font: bold, size: 9.5, gap: 15 });
    wrapped(firearm.notes, regular, 10);
  }

  for (const role of ["SELLER", "BUYER"] as const) {
    heading(role);
    const party = parties[role] ?? {};
    field("Full legal name", party.fullName);
    field("Street", party.street);
    field("City / State / ZIP", [party.city, party.state, party.zip].filter(Boolean).join(", "));
    field("Phone", party.phone);
    field("Email", party.email);
  }

  heading("Signatures");
  for (const signature of version.signatures) {
    const participant = document.participants.find(
      (item) => item.id === signature.participantId,
    );

    line(`${participant?.role ?? "PARTY"} signature`, {
      font: bold,
      size: 9.5,
      gap: 16,
    });

    const dataUrl = signatureDataUrl(signature.signatureStyle);

    if (dataUrl) {
      try {
        const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
        const image = await pdf.embedPng(new Uint8Array(Buffer.from(base64, "base64")));
        const natural = image.scale(1);
        const maxWidth = 250;
        const maxHeight = 68;
        const scale = Math.min(maxWidth / natural.width, maxHeight / natural.height, 1);
        const drawWidth = natural.width * scale;
        const drawHeight = natural.height * scale;

        ensure(drawHeight + 14);
        page.drawImage(image, {
          x: margin,
          y: y - drawHeight + 8,
          width: drawWidth,
          height: drawHeight,
        });
        y -= drawHeight + 8;
      } catch {
        line(signature.typedName, {
          font: italic,
          size: 16,
          gap: 22,
        });
      }
    } else {
      line(signature.typedName, {
        font: italic,
        size: 16,
        gap: 22,
      });
    }

    line(`Signed ${signedAtLabel(signature.signedAt)}`, {
      font: regular,
      size: 9,
      gap: 14,
    });
    wrapped(signature.consentText, regular, 7.8);
    y -= 8;
  }

  if (completion) {
    heading("FFL transfer completion record");
    field("Receiving FFL", completion.dealerName);
    field("Address", completion.dealerAddress);
    field(
      "City / State / ZIP",
      [completion.dealerCity, completion.dealerState, completion.dealerZip]
        .filter(Boolean)
        .join(", "),
    );
    field("FFL number", completion.dealerLicenseNumber);
    field("Transfer date", completion.transferDate);
    if (completion.notes) {
      line("Completion notes:", { font: bold, size: 9.5, gap: 15 });
      wrapped(completion.notes, regular, 10);
    }
  }

  const bytes = await pdf.save();
  const root = process.env.STORAGE_ROOT || "/data/documents";
  const directory = path.join(root, document.id);
  await fs.mkdir(directory, { recursive: true });

  const filename =
    document.status === "FINALIZED"
      ? `v${version.version}-final.pdf`
      : `v${version.version}-signed-agreement.pdf`;
  const outputPath = path.join(directory, filename);
  await fs.writeFile(outputPath, bytes);

  await prisma.documentVersion.update({
    where: { id: version.id },
    data: { pdfPath: outputPath },
  });

  return { path: outputPath, filename, bytes: Buffer.from(bytes) };
}
