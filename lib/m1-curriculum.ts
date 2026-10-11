/**
 * PAES Regular M1 — proceso de Admisión 2027 (pruebas rendidas en 2026).
 * DEMRE calls these "unidades temáticas". PAESSED displays them as "subejes".
 * One canonical taxonomy for dashboard, learning path, and Playground filters.
 * Source: official DEMRE/Mineduc curriculum, pages 6–9.
 */
export const M1_CURRICULUM_SOURCE = "https://acceso.mineduc.cl/wp-content/uploads/2026/03/Temario-PAESRegular-2026-M1-v1.pdf";
export const M1_ADMISSION_YEAR = 2027;

export const M1_AXES = [
  {
    id: "numeros",
    name: "Números",
    units: [
      { id: "numeros-enteros-racionales", name: "Conjunto de los números enteros y racionales" },
      { id: "porcentaje", name: "Porcentaje" },
      { id: "potencias-raices-enesimas", name: "Potencias y raíces enésimas" },
    ],
  },
  {
    id: "algebra",
    name: "Álgebra y funciones",
    units: [
      { id: "expresiones-algebraicas", name: "Expresiones algebraicas" },
      { id: "proporcionalidad", name: "Proporcionalidad" },
      { id: "ecuaciones-inecuaciones-primer-grado", name: "Ecuaciones e inecuaciones de primer grado" },
      { id: "sistemas-ecuaciones-lineales-2x2", name: "Sistemas de ecuaciones lineales (2x2)" },
      { id: "funcion-lineal-afin", name: "Función lineal y afín" },
      { id: "funcion-cuadratica", name: "Función cuadrática" },
    ],
  },
  {
    id: "geometria",
    name: "Geometría",
    units: [
      { id: "figuras-geometricas", name: "Figuras geométricas" },
      { id: "cuerpos-geometricos", name: "Cuerpos geométricos" },
      { id: "transformaciones-isometricas", name: "Transformaciones isométricas" },
      { id: "semejanza-proporcionalidad-figuras", name: "Semejanza y proporcionalidad de figuras" },
    ],
  },
  {
    id: "datos",
    name: "Probabilidad y estadística",
    units: [
      { id: "representacion-datos-tablas-graficos", name: "Representación de datos a través de tablas y gráficos" },
      { id: "medidas-posicion", name: "Medidas de posición" },
      { id: "reglas-probabilidades", name: "Reglas de las probabilidades" },
    ],
  },
] as const;

export type M1AxisId = (typeof M1_AXES)[number]["id"];
export type M1UnitId = (typeof M1_AXES)[number]["units"][number]["id"];

export const M1_UNITS = M1_AXES.flatMap((axis) =>
  axis.units.map((unit) => ({ ...unit, axisId: axis.id, axisName: axis.name }))
);

export function getM1UnitsForAxis(axisId: M1AxisId) {
  return M1_UNITS.filter((unit) => unit.axisId === axisId);
}

export function getM1Unit(unitId: string) {
  return M1_UNITS.find((unit) => unit.id === unitId);
}
