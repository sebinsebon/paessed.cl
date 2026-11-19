"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { database } from "@/lib/server/db";
import { HttpError, sameOrigin } from "@/lib/server/http";
import { consume, ipKey } from "@/lib/server/limits";

const detail = z.string().trim().min(1).max(2000);
const fields = z.object({
  screen: detail.max(160), steps: detail, expected: detail, observed: detail,
  device: detail.max(200), contact: z.string().trim().max(254),
});

export async function submitReport(data: FormData) {
  try {
    const request = new Request(process.env.APP_ORIGIN ?? "http://localhost", { headers: await headers() });
    sameOrigin(request);
    const result = fields.safeParse(Object.fromEntries(data));
    if (!result.success) return { error: "Revisa los campos obligatorios y su extensión." };
    const file = data.get("screenshot");
    let screenshot: Buffer | null = null;
    if (file instanceof File && file.size > 0) {
      if (file.size > 524288) return { error: "Usa una captura de hasta 512 KB." };
      screenshot = Buffer.from(await file.arrayBuffer());
      const png = screenshot.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
      const jpeg = screenshot.subarray(0, 3).toString("hex") === "ffd8ff";
      if (!png && !jpeg) return { error: "Elige una captura PNG o JPEG." };
    }
    const hash = ipKey(request);
    const { screen, steps, expected, observed, device, contact } = result.data;
    await database().transaction(async query => {
      await consume(query, "report:" + hash, 5, 3600);
      await consume(query, "reports:daily", 100, 86400);
      await query(`insert into paessed.problem_reports
        (screen, steps, expected, observed, device, contact, screenshot)
        values ($1,$2,$3,$4,$5,$6,$7)`, [screen, steps, expected, observed, device, contact || null, screenshot]);
    });
    return { success: true };
  } catch (error) {
    if (error instanceof HttpError && error.status === 429) return { error: "Se alcanzó el límite de reportes. Inténtalo más tarde." };
    return { error: "No pudimos guardar el reporte. Vuelve a intentarlo." };
  }
}
