import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { parseReport, readScreenshot } from "../lib/server/report-input.ts";

function report() {
  const data = new FormData();
  for (const key of ["screen", "steps", "expected", "observed", "device"]) data.set(key, "Prueba");
  data.set("contact", "");
  return data;
}

test("reports reject repeated, unknown, oversized and non-file fields", () => {
  assert.equal(parseReport(report()).file, null);
  const invalid = [
    data => data.append("screen", "Otra pantalla"),
    data => data.set("extra", "Campo adicional"),
    data => data.set("screenshot", "Texto"),
    data => data.set("screenshot", new File([new Uint8Array(512 * 1024 + 1)], "grande.png", { type: "image/png" })),
  ];
  for (const mutate of invalid) {
    const data = report();
    mutate(data);
    assert.throws(() => parseReport(data), error => error.status === 400);
  }
});

test("screenshots require a decodable PNG or JPEG of the declared type", async () => {
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "white" } }).png().toBuffer();
  const data = report();
  data.set("screenshot", new File([png], "captura.png", { type: "image/png" }));
  assert.deepEqual(await readScreenshot(parseReport(data).file), png);
  for (const file of [
    new File([png.subarray(0, 8)], "incompleta.png", { type: "image/png" }),
    new File([png], "captura.jpg", { type: "image/jpeg" }),
  ]) {
    data.set("screenshot", file);
    await assert.rejects(readScreenshot(parseReport(data).file), error => error.status === 400);
  }
});
