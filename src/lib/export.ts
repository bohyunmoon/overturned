import { addDays } from "./deadlines";

/** Lay the letter out as a US Letter PDF, 1-inch margins, ready to print and sign. */
export async function downloadLetterPdf(letter: string, filename = "appeal-letter.pdf"): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 72;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const bottom = doc.internal.pageSize.getHeight() - margin;
  const lineHeight = 15;
  doc.setFont("times", "normal");
  doc.setFontSize(11.5);

  let y = margin;
  for (const raw of letter.split("\n")) {
    const heading = /^[A-Z][A-Z ]{8,}$/.test(raw.trim()) || raw.startsWith("RE:");
    doc.setFont("times", heading ? "bold" : "normal");
    const wrapped: string[] = raw.trim() === "" ? [""] : doc.splitTextToSize(raw, width);
    for (const line of wrapped) {
      if (y > bottom) {
        doc.addPage();
        y = margin;
      }
      if (line) doc.text(line, margin, y);
      y += line ? lineHeight : lineHeight * 0.7;
    }
  }

  const pages = doc.getNumberOfPages();
  if (pages > 1) {
    doc.setFont("times", "normal");
    doc.setFontSize(9);
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.text(`Page ${i} of ${pages}`, doc.internal.pageSize.getWidth() / 2, bottom + 36, { align: "center" });
    }
  }
  doc.save(filename);
}

const icsDate = (iso: string) => iso.replaceAll("-", "");
const icsEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

/** An all-day calendar event on the filing deadline, with reminders before it. */
export function buildDeadlineIcs(
  fileBy: string,
  text: { summary: string; description: string; alarm: (days: number) => string },
): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const alarm = (days: number) => ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsEscape(text.alarm(days))}`, `TRIGGER:-P${days}D`, "END:VALARM"];
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Overturned//Appeal deadline//EN",
    "BEGIN:VEVENT",
    `UID:${stamp}-${icsDate(fileBy)}@overturned`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${icsDate(fileBy)}`,
    `DTEND;VALUE=DATE:${icsDate(addDays(fileBy, 1))}`,
    `SUMMARY:${icsEscape(text.summary)}`,
    `DESCRIPTION:${icsEscape(text.description)}`,
    ...alarm(21),
    ...alarm(10),
    ...alarm(3),
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadText(content: string, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Shrink a phone photo so it uploads quickly and stays under request limits. */
export async function prepareImage(file: File, maxSide = 1800): Promise<{ mediaType: "image/jpeg"; base64: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process the photo on this device.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { mediaType: "image/jpeg", base64: dataUrl.slice(dataUrl.indexOf(",") + 1) };
}
