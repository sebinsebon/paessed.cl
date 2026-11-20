import sharp from "sharp";
import { z } from "zod";
import { HttpError } from "../http-error.ts";

const detail = z.string().trim().min(1).max(2000);
const fields = z.strictObject({
  screen: detail.max(160), steps: detail, expected: detail, observed: detail,
  device: detail.max(200), contact: z.string().trim().max(254),
});

export function parseReport(data: FormData) {
  const names = [...data.keys()];
  if (names.length !== new Set(names).size) throw new HttpError(400, "Cada campo del reporte debe aparecer una sola vez.");
  const { screenshot, ...entries } = Object.fromEntries(data);
  const result = fields.safeParse(entries);
  if (!result.success) throw new HttpError(400, "Revisa los campos obligatorios y su extensión.");
  if (screenshot === undefined || (screenshot instanceof File && screenshot.size === 0 && screenshot.name === "")) {
    return { ...result.data, file: null };
  }
  if (!(screenshot instanceof File) || !["image/png", "image/jpeg"].includes(screenshot.type)) {
    throw new HttpError(400, "Elige una captura PNG o JPEG.");
  }
  if (screenshot.size > 512 * 1024) throw new HttpError(400, "Usa una captura de hasta 512 KB.");
  return { ...result.data, file: screenshot };
}

export async function readScreenshot(file: File | null): Promise<Buffer | null> {
  if (!file) return null;
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const image = sharp(bytes, { limitInputPixels: 16_000_000 });
    const { format } = await image.metadata();
    if (`image/${format}` !== file.type) throw new Error("Formato distinto al declarado");
    await image.stats();
    return bytes;
  } catch {
    throw new HttpError(400, "La captura está incompleta o supera las dimensiones admitidas. Usa otra imagen PNG o JPEG.");
  }
}
