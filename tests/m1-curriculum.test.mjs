import test from "node:test";
import assert from "node:assert/strict";
import { M1_AXES, M1_UNITS, M1_ADMISSION_YEAR, M1_CURRICULUM_SOURCE, getM1Unit, getM1UnitsForAxis } from "../lib/m1-curriculum.ts";

test("M1 Admisión 2027: 4 ejes y 16 unidades temáticas oficiales", () => {
  assert.equal(M1_ADMISSION_YEAR, 2027);
  assert.equal(M1_AXES.length, 4);
  assert.deepEqual(M1_AXES.map((axis) => axis.units.length), [3, 6, 4, 3]);
  assert.equal(M1_UNITS.length, 16);
  assert.match(M1_CURRICULUM_SOURCE, /Temario-PAESRegular-2026-M1-v1\.pdf$/);
});

test("Todos los subejes tienen ID único y pertenecen a su eje", () => {
  assert.equal(new Set(M1_UNITS.map((unit) => unit.id)).size, 16);
  assert.equal(new Set(M1_UNITS.map((unit) => unit.name)).size, 16);
  for (const axis of M1_AXES) {
    assert.deepEqual(getM1UnitsForAxis(axis.id).map((unit) => unit.id), axis.units.map((unit) => unit.id));
    for (const unit of axis.units) {
      assert.equal(getM1Unit(unit.id)?.axisId, axis.id);
      assert.equal(getM1Unit(unit.id)?.axisName, axis.name);
    }
  }
});

test("Geometría Regular 2027 incluye cuerpos geométricos y semejanza", () => {
  assert.deepEqual(
    getM1UnitsForAxis("geometria").map((unit) => unit.id),
    ["figuras-geometricas", "cuerpos-geometricos", "transformaciones-isometricas", "semejanza-proporcionalidad-figuras"]
  );
  assert.equal(getM1Unit("desconocido"), undefined);
});
