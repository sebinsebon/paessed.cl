"""Prepare the user's reviewed Gold packages for the local Default catalog.

No source package is modified. Distribution permission is separate from fidelity.
Run: python scripts/prepare-gold.py PATH_TO_GOLD
"""
import hashlib
import json
import pathlib
import shutil
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
source = pathlib.Path(sys.argv[1]).resolve()
manifest = json.loads((source / "ENTREGA_SHA256.json").read_text(encoding="utf-8"))
taxonomy = [
    ("numeros", "numeros-enteros-racionales", "Conjunto de los números enteros y racionales"),
    ("numeros", "porcentaje", "Porcentaje"),
    ("numeros", "potencias-raices-enesimas", "Potencias y raíces enésimas"),
    ("algebra", "expresiones-algebraicas", "Expresiones algebraicas"),
    ("algebra", "proporcionalidad", "Proporcionalidad"),
    ("algebra", "ecuaciones-inecuaciones-primer-grado", "Ecuaciones e inecuaciones de primer grado"),
    ("algebra", "sistemas-ecuaciones-lineales-2x2", "Sistemas de ecuaciones lineales (2x2)"),
    ("algebra", "funcion-lineal-afin", "Función lineal y afín"),
    ("algebra", "funcion-cuadratica", "Función cuadrática"),
    ("geometria", "figuras-geometricas", "Figuras geométricas"),
    ("geometria", "cuerpos-geometricos", "Cuerpos geométricos"),
    ("geometria", "transformaciones-isometricas", "Transformaciones isométricas"),
    ("geometria", "semejanza-proporcionalidad-figuras", "Semejanza y proporcionalidad de figuras"),
    ("datos", "representacion-datos-tablas-graficos", "Representación de datos a través de tablas y gráficos"),
    ("datos", "medidas-posicion", "Medidas de posición"),
    ("datos", "reglas-probabilidades", "Reglas de las probabilidades"),
]
units = {name: (axis, unit) for axis, unit, name in taxonomy}
out = ROOT / "public" / "default" / "gold"
out.mkdir(parents=True, exist_ok=True)
exams, questions = [], []
for package in sorted(source.glob("*.paessed")):
    raw = package.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if manifest.get(package.name) != digest:
        raise ValueError(f"Hash no coincide: {package.name}")
    with zipfile.ZipFile(package) as archive:
        if archive.testzip():
            raise ValueError(f"CRC inválido: {package.name}")
        data = json.loads(archive.read("final.json"))
    if data.get("schema_version") != "0.2.0":
        raise ValueError("Contrato incompatible")
    exam_id = data["exam"]["id"]
    source_hash = next(s["sha256"] for s in data["sources"] if s["id"] == "exam")
    admission = int(package.stem[-4:])
    title = ("PDT Matemática" if package.stem.startswith("PDT") else "PAES M1 " + ("Invierno" if "Invierno" in package.stem else "Regular")) + f" · Admisión {admission}"
    exams.append({"id": exam_id, "title": title, "questionCount": len(data["questions"]),
        "href": "/app/ensayos/default/" + exam_id, "packageUrl": "/default/gold/" + package.name,
        "sha256": digest, "sourceSha256": source_hash, "year": admission,
        "reviewVersion": "Gold 0.7", "distribution": "private_local"})
    for q in data["questions"]:
        axis, unit = units[q["curriculum"]["subeje"]]
        number = int(q["number"])
        revision = hashlib.sha256(json.dumps({k:q.get(k) for k in ["stem", "options", "answer", "curriculum"]}, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        questions.append({"id": "demre:" + source_hash + ":" + str(number), "examId": exam_id,
            "number": number, "axisId": axis, "unitId": unit, "revision": revision,
            "correct": q["answer"]["label"], "eligible": q["curriculum"]["en_temario"] == "si" and q["answer"]["status"] == "verified"})
    shutil.copyfile(package, out / package.name)
index = {"version": 1, "reviewVersion": "Gold 0.7", "exams": exams, "questions": questions}
(ROOT / "lib" / "default-catalog.json").write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Default preparado: {len(exams)} ensayos, {len(questions)} preguntas, {sum(q['eligible'] for q in questions)} aptas para Aprender.")
