import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("PAESSED sets route-specific tab titles alongside metadata descriptions", async () => {
  const root = await read("app/layout.tsx");
  assert.match(root, /title: "Paessed"/);
  assert.match(root, /description: "Paessed - Inicio"/);

  for (const [path, description] of [
    ["app/page.tsx", "Paessed - Inicio"],
    ["app/app/layout.tsx", "Paessed - Dashboard"],
    ["app/app/inicio/page.tsx", "Paessed - Dashboard - Inicio"],
    ["app/app/ensayos/layout.tsx", "Paessed - Dashboard - Ensayos"],
    ["app/app/playground/page.tsx", "Paessed - Dashboard - Playground"],
    ["app/app/aprender/page.tsx", "Paessed - Dashboard - Aprender"],
    ["app/app/perfil/page.tsx", "Paessed - Dashboard - Perfil"],
    ["app/app/auditoria/layout.tsx", "Paessed - Dashboard - Auditoría"],
    ["app/diagnostico/layout.tsx", "Paessed - Diagnóstico"],
    ["app/bienvenida/page.tsx", "Paessed - Bienvenida"],
    ["app/login/page.tsx", "Paessed - Iniciar sesión"],
    ["app/registro/page.tsx", "Paessed - Registro"],
    ["app/auth/recover/page.tsx", "Paessed - Recuperar contraseña"],
    ["app/auth/password/page.tsx", "Paessed - Cambiar contraseña"],
    ["app/reportar/layout.tsx", "Paessed - Reportar problema"],
  ]) {
    const source = await read(path);
    assert.ok(source.includes(`description: "${description}"`), `Missing metadata in ${path}`);
    assert.ok(source.includes(`title: "${description}"`), `Missing browser tab title in ${path}`);
  }
});

test("favicon PNG is a supported, square file-based icon", async () => {
  const bytes = await readFile(new URL("../app/icon.png", import.meta.url));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(bytes.readUInt32BE(16), 64);
  assert.equal(bytes.readUInt32BE(20), 64);
});
