"use server";

import { headers } from "next/headers";
import { database } from "@/lib/server/db";
import { HttpError, sameOrigin } from "@/lib/server/http";
import { consume, ipKey } from "@/lib/server/limits";
import { parseReport, readScreenshot } from "@/lib/server/report-input";

export async function submitReport(data: FormData) {
  try {
    const request = new Request(process.env.APP_ORIGIN ?? "http://localhost", { headers: await headers() });
    sameOrigin(request);
    const { screen, steps, expected, observed, device, contact, file } = parseReport(data);
    const hash = ipKey(request);
    const driver = database();
    await consume(driver.query, "report:" + hash, 5, 3600);
    const screenshot = await readScreenshot(file);
    await driver.transaction(async query => {
      await consume(query, "reports:daily", 100, 86400);
      await query(`insert into paessed.problem_reports
        (screen, steps, expected, observed, device, contact, screenshot)
        values ($1,$2,$3,$4,$5,$6,$7)`, [screen, steps, expected, observed, device, contact || null, screenshot]);
    });
    return { success: true };
  } catch (error) {
    if (error instanceof HttpError && error.status === 429) return { error: "Se alcanzó el límite de reportes. Inténtalo más tarde." };
    if (error instanceof HttpError && error.status === 400) return { error: error.message };
    return { error: "No pudimos guardar el reporte. Vuelve a intentarlo." };
  }
}
