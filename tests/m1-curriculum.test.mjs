import test from "node:test";
import assert from "node:assert/strict";
import { M1_AXES, M1_UNITS, M1_ADMISSION_YEAR, M1_CURRICULUM_SOURCE, getM1Unit, getM1UnitsForAxis, toggleM1AxisSelection, toggleM1UnitSelection } from "../lib/m1-curriculum.ts";

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

test("Se pueden combinar subejes de distintos ejes sin duplicados", () => {
  const numeros = getM1UnitsForAxis("numeros").map((unit) => unit.id);
  const mezcla = toggleM1UnitSelection(numeros, "funcion-cuadratica");
  assert.equal(mezcla.length, numeros.length + 1);
  assert.ok(mezcla.includes("porcentaje"));
  assert.ok(mezcla.includes("funcion-cuadratica"));
  assert.equal(new Set(mezcla).size, mezcla.length);
  assert.deepEqual(toggleM1UnitSelection(mezcla, "funcion-cuadratica"), numeros);
});

test("Seleccionar un eje completo no borra otros ejes; al repetirlo se desmarca", () => {
  const geometria = toggleM1AxisSelection(["porcentaje"], "geometria");
  assert.equal(geometria.length, 5);
  assert.ok(geometria.includes("porcentaje"));
  assert.ok(geometria.includes("cuerpos-geometricos"));
  assert.deepEqual(toggleM1AxisSelection(geometria, "geometria"), ["porcentaje"]);
  assert.deepEqual(toggleM1AxisSelection([], "numeros"), getM1UnitsForAxis("numeros").map((unit) => unit.id));
});

test("Selección mixta de un eje selecciona todas las unidades al tocar el eje", () => {
  const selected = ["porcentaje", "funcion-cuadratica"];
  const full = toggleM1AxisSelection(selected, "numeros");
  assert.equal(full.length, 4);
  assert.ok(full.includes("funcion-cuadratica"));
  assert.ok(getM1UnitsForAxis("numeros").every((unit) => full.includes(unit.id)));
});
