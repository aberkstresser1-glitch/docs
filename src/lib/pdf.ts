import { promises as fs } from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
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
    // Older signatures used a simple style label.
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

  const page = pdf.addPage([612, 792]);
  const margin = 36;
  const width = 612 - margin * 2;
  const colGap = 18;
  const colWidth = (width - colGap) / 2;
  let y = 752;

  function fitSize(
    text: string,
    font: PDFFont,
    maxWidth: number,
    preferred = 9,
    minimum = 6.6,
  ) {
    let size = preferred;
    while (size > minimum && font.widthOfTextAtSize(text, size) > maxWidth) {
      size -= 0.25;
    }
    return size;
  }

  function sectionTitle(text: string) {
    y -= 6;
    page.drawText(text.toUpperCase(), {
      x: margin,
      y,
      size: 9,
      font: bold,
      color: rgb(0.19, 0.23, 0.31),
    });
    page.drawLine({
      start: { x: margin, y: y - 4 },
      end: { x: margin + width, y: y - 4 },
      thickness: 0.7,
      color: rgb(0.82, 0.84, 0.88),
    });
    y -= 16;
  }

  function inlineField(
    x: number,
    top: number,
    label: string,
    value: unknown,
    maxWidth: number,
    options?: { labelWidth?: number; valueSize?: number },
  ) {
    const labelWidth = options?.labelWidth ?? 76;
    const renderedValue = String(
      value === null || value === undefined || value === "" ? "—" : value,
    );
    page.drawText(label, {
      x,
      y: top,
      size: 7.8,
      font: bold,
      color: rgb(0.38, 0.41, 0.47),
    });
    const available = Math.max(30, maxWidth - labelWidth);
    const size = fitSize(renderedValue, regular, available, options?.valueSize ?? 8.6);
    page.drawText(renderedValue, {
      x: x + labelWidth,
      y: top,
      size,
      font: regular,
      color: rgb(0.08, 0.1, 0.14),
    });
  }

  function wrapText(
    text: string,
    font: PDFFont,
    size: number,
    maxWidth: number,
    maxLines = 2,
  ) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = "";

    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = word;
        if (lines.length >= maxLines - 1) break;
      }
    }

    if (current && lines.length < maxLines) lines.push(current);

    if (lines.length === maxLines) {
      const consumed = lines.join(" ").split(/\s+/).length;
      if (consumed < words.length) {
        let last = lines[maxLines - 1];
        while (
          last.length > 0 &&
          font.widthOfTextAtSize(`${last}…`, size) > maxWidth
        ) {
          last = last.slice(0, -1);
        }
        lines[maxLines - 1] = `${last}…`;
      }
    }

    return lines;
  }

  function partyBlock(
    x: number,
    role: "SELLER" | "BUYER",
    top: number,
  ) {
    const party = parties[role] ?? {};

    page.drawText(role, {
      x,
      y: top,
      size: 8.5,
      font: bold,
      color: rgb(0.13, 0.17, 0.24),
    });

    const start = top - 15;
    inlineField(x, start, "Name", party.fullName, colWidth, { labelWidth: 46 });
    inlineField(x, start - 14, "Address", party.street, colWidth, { labelWidth: 46 });
    inlineField(
      x,
      start - 28,
      "City/State",
      [party.city, party.state, party.zip].filter(Boolean).join(", "),
      colWidth,
      { labelWidth: 46 },
    );
    inlineField(x, start - 42, "Phone", party.phone, colWidth, { labelWidth: 46 });
    inlineField(x, start - 56, "Email", party.email, colWidth, { labelWidth: 46 });
  }

  async function signatureBlock(
    x: number,
    role: "SELLER" | "BUYER",
    top: number,
  ) {
    const participant = document.participants.find(
      (item) => item.role === role,
    );
    const signature = version.signatures.find(
      (item) => item.participantId === participant?.id,
    );

    page.drawText(`${role} SIGNATURE`, {
      x,
      y: top,
      size: 8.2,
      font: bold,
      color: rgb(0.13, 0.17, 0.24),
    });

    if (!signature) {
      page.drawText("Not signed", {
        x,
        y: top - 24,
        size: 9,
        font: italic,
        color: rgb(0.45, 0.48, 0.54),
      });
      return;
    }

    const dataUrl = signatureDataUrl(signature.signatureStyle);
    let usedImage = false;

    if (dataUrl) {
      try {
        const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
        const image = await pdf.embedPng(
          new Uint8Array(Buffer.from(base64, "base64")),
        );
        const natural = image.scale(1);
        const maxWidth = colWidth - 8;
        const maxHeight = 44;
        const scale = Math.min(
          maxWidth / natural.width,
          maxHeight / natural.height,
          1,
        );
        const drawWidth = natural.width * scale;
        const drawHeight = natural.height * scale;

        page.drawImage(image, {
          x,
          y: top - 10 - drawHeight,
          width: drawWidth,
          height: drawHeight,
        });
        usedImage = true;
      } catch {
        usedImage = false;
      }
    }

    if (!usedImage) {
      page.drawText(signature.typedName, {
        x,
        y: top - 31,
        size: fitSize(signature.typedName, italic, colWidth - 8, 15, 10),
        font: italic,
        color: rgb(0.08, 0.1, 0.14),
      });
    }

    page.drawText(`Signed ${signedAtLabel(signature.signedAt)}`, {
      x,
      y: top - 58,
      size: 7.2,
      font: regular,
      color: rgb(0.36, 0.39, 0.45),
    });

    const consent =
      "Electronic signature adopted for this document; required transfer laws still apply.";
    const consentLines = wrapText(consent, regular, 6.6, colWidth - 4, 2);
    consentLines.forEach((line, index) => {
      page.drawText(line, {
        x,
        y: top - 70 - index * 8,
        size: 6.6,
        font: regular,
        color: rgb(0.45, 0.48, 0.54),
      });
    });
  }

  const title = transaction.interstate
    ? document.status === "FINALIZED"
      ? "INTERSTATE FIREARM BILL OF SALE"
      : "INTERSTATE FIREARM SALE AGREEMENT"
    : "FIREARM BILL OF SALE";

  page.drawText(title, {
    x: margin,
    y,
    size: 17,
    font: bold,
    color: rgb(0.06, 0.08, 0.12),
  });
  y -= 21;

  page.drawText(document.title, {
    x: margin,
    y,
    size: fitSize(document.title, bold, width, 10.5, 8),
    font: bold,
    color: rgb(0.29, 0.32, 0.38),
  });
  y -= 20;

  if (transaction.interstate && document.status !== "FINALIZED") {
    const notice =
      "Agreement only — interstate firearm transfer remains pending the required receiving-FFL process.";
    page.drawText(notice, {
      x: margin,
      y,
      size: fitSize(notice, italic, width, 7.4, 6.3),
      font: italic,
      color: rgb(0.55, 0.28, 0.07),
    });
    y -= 17;
  }

  sectionTitle("Sale");
  inlineField(margin, y, "Agreement date", transaction.agreementDate, colWidth, {
    labelWidth: 78,
  });
  inlineField(
    margin + colWidth + colGap,
    y,
    "Sale price",
    money(transaction.price),
    colWidth,
    { labelWidth: 58 },
  );
  y -= 15;
  inlineField(margin, y, "Seller state", transaction.sellerState, colWidth, {
    labelWidth: 78,
  });
  inlineField(
    margin + colWidth + colGap,
    y,
    "Buyer state",
    transaction.buyerState,
    colWidth,
    { labelWidth: 58 },
  );
  y -= 12;

  sectionTitle("Firearm");
  inlineField(margin, y, "Manufacturer", firearm.manufacturer, colWidth, {
    labelWidth: 74,
  });
  inlineField(
    margin + colWidth + colGap,
    y,
    "Model",
    firearm.model,
    colWidth,
    { labelWidth: 44 },
  );
  y -= 15;
  inlineField(margin, y, "Caliber / gauge", firearm.caliber, colWidth, {
    labelWidth: 74,
  });
  inlineField(
    margin + colWidth + colGap,
    y,
    "Type",
    firearm.firearmType,
    colWidth,
    { labelWidth: 44 },
  );
  y -= 15;
  inlineField(margin, y, "Serial number", firearm.serialNumber, width, {
    labelWidth: 74,
    valueSize: 8.8,
  });
  y -= 14;

  if (firearm.notes) {
    page.drawText("Condition / notes", {
      x: margin,
      y,
      size: 7.8,
      font: bold,
      color: rgb(0.38, 0.41, 0.47),
    });
    const notes = wrapText(firearm.notes, regular, 7.7, width - 90, 2);
    notes.forEach((line, index) => {
      page.drawText(line, {
        x: margin + 90,
        y: y - index * 9,
        size: 7.7,
        font: regular,
        color: rgb(0.08, 0.1, 0.14),
      });
    });
    y -= Math.max(14, notes.length * 9 + 4);
  }

  sectionTitle("Parties");
  const partyTop = y;
  partyBlock(margin, "SELLER", partyTop);
  partyBlock(margin + colWidth + colGap, "BUYER", partyTop);
  y = partyTop - 76;

  if (completion) {
    sectionTitle("FFL Transfer Completion");
    inlineField(margin, y, "Receiving FFL", completion.dealerName, colWidth, {
      labelWidth: 72,
    });
    inlineField(
      margin + colWidth + colGap,
      y,
      "Transfer date",
      completion.transferDate,
      colWidth,
      { labelWidth: 66 },
    );
    y -= 15;
    inlineField(
      margin,
      y,
      "Location",
      [
        completion.dealerAddress,
        completion.dealerCity,
        completion.dealerState,
        completion.dealerZip,
      ]
        .filter(Boolean)
        .join(", "),
      width,
      { labelWidth: 72, valueSize: 7.8 },
    );
    y -= 15;
    if (completion.dealerLicenseNumber) {
      inlineField(
        margin,
        y,
        "FFL number",
        completion.dealerLicenseNumber,
        colWidth,
        { labelWidth: 72 },
      );
      y -= 13;
    }
  }

  sectionTitle("Signatures");
  const signatureTop = y;
  await signatureBlock(margin, "SELLER", signatureTop);
  await signatureBlock(
    margin + colWidth + colGap,
    "BUYER",
    signatureTop,
  );
  y = signatureTop - 88;

  page.drawLine({
    start: { x: margin, y: 42 },
    end: { x: margin + width, y: 42 },
    thickness: 0.6,
    color: rgb(0.87, 0.88, 0.9),
  });
  page.drawText(
    transaction.interstate
      ? "This record documents the parties' agreement and, when shown above, the reported receiving-FFL completion."
      : "This record documents the private sale information and electronic signatures shown above.",
    {
      x: margin,
      y: 29,
      size: 6.5,
      font: regular,
      color: rgb(0.48, 0.5, 0.55),
      maxWidth: width,
    },
  );

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
