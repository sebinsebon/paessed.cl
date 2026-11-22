const screens = {
  home: { title: "Inicio", element: document.querySelector("#home") },
  question: { title: "Pregunta 65", element: document.querySelector("#question") },
  result: { title: "Resultado", element: document.querySelector("#result") },
};
const answerForm = document.querySelector("#answer-form");
const answerInputs = [...answerForm.querySelectorAll("input[name=answer]")];
const dialog = document.querySelector("#finish-dialog");
const viewButtons = [...document.querySelectorAll("[data-set-view]")];
const numberOfQuestions = 65;
const correctAnswer = "C";

// The practice exam on main repeats these eight keys. This attempt starts with
// its first 47 answers correct and the following 17 one letter off.
const practiceKeys = ["C", "C", "B", "B", "A", "C", "C", "B"];
const priorAnswers = Array.from({ length: numberOfQuestions - 1 }, (_, index) => {
  const key = practiceKeys[index % practiceKeys.length];
  const picked = index < 47 ? key : answerInputs[(key.charCodeAt(0) - 64) % answerInputs.length].value;
  return { key, picked };
});

let selected = null;
let submitted = false;

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function setView(view) {
  document.body.dataset.view = view;
  for (const button of viewButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.setView === view));
  }
}

function goTo(screen) {
  for (const [name, { element }] of Object.entries(screens)) {
    element.hidden = name !== screen;
  }
  document.body.dataset.screen = screen;
  document.title = `${screens[screen].title} · Paessed`;
  window.scrollTo(0, 0);
  screens[screen].element.querySelector("h1").focus({ preventScroll: true });
}

function renderAttempt() {
  const answered = priorAnswers.length + Number(selected !== null);
  const count = `${answered}/${numberOfQuestions}`;
  setText("count-home", count);
  setText("count-question", count);
  document.querySelector("#home-progress").value = answered;

  setText("essay-status", submitted ? "Ensayo completado" : "Ensayo en curso");
  setText("resume-label", submitted ? "Ver resultado" : "Continuar ensayo");
  setText("essay-position", submitted ? "Entrega completada" : "Pregunta 65 de 65");

  if (!submitted) {
    setText("last-result", "Sin ensayos rendidos");
    return;
  }

  const isCorrect = selected === correctAnswer;
  const correct = priorAnswers.filter(({ key, picked }) => key === picked).length + Number(isCorrect);
  const wrong = answered - correct;
  const omitted = numberOfQuestions - answered;
  const score = Math.round(100 + correct / numberOfQuestions * 900);
  const chosenInput = answerInputs.find(input => input.value === selected);
  const chosenValue = chosenInput.labels[0].lastElementChild.textContent;

  setText("last-result", `${score} pts`);
  setText("score", score);
  setText("right-total", correct);
  setText("wrong-total", wrong);
  setText("omitted-total", omitted);
  setText("accuracy", `${Math.round(correct / answered * 100)}%`);
  setText("chosen-answer", `${selected} · ${chosenValue}`);
  setText("verdict", isCorrect ? "Correcta" : "Incorrecta");
  setText("verdict-icon", isCorrect ? "✓" : "×");
  document.querySelector("#correction").dataset.correct = String(isCorrect);
}

const axisGrid = document.querySelector("#axis-grid");
const mobileLayout = window.matchMedia("(max-width: 790px)");
const setAxisTabStop = () => { axisGrid.tabIndex = mobileLayout.matches ? 0 : -1; };
mobileLayout.addEventListener("change", setAxisTabStop);
setAxisTabStop();
for (const name of ["Números", "Álgebra y funciones", "Geometría", "Probabilidad y estadística"]) {
  const card = document.createElement("li");
  const title = document.createElement("h3");
  card.className = "axis-card";
  title.textContent = name;
  card.append(title);
  card.insertAdjacentHTML("beforeend", '<p>0/0 correctas</p><div class="axis-track" aria-hidden="true"></div><p>En calibración</p>');
  axisGrid.append(card);
}

for (const button of viewButtons) {
  button.addEventListener("click", () => setView(button.dataset.setView));
}
for (const button of document.querySelectorAll("[data-go-home]")) {
  button.addEventListener("click", () => goTo("home"));
}

document.querySelector("#resume").addEventListener("click", () => goTo(submitted ? "result" : "question"));
document.querySelector("#reset").addEventListener("click", () => {
  answerForm.reset();
  selected = null;
  submitted = false;
  renderAttempt();
  setView("proposal");
  goTo("home");
});

answerForm.addEventListener("change", event => {
  selected = event.target.value;
  renderAttempt();
});
answerForm.addEventListener("submit", event => {
  event.preventDefault();
  dialog.returnValue = "";
  dialog.showModal();
});
dialog.addEventListener("close", () => {
  if (dialog.returnValue !== "submit") return;
  submitted = true;
  renderAttempt();
  goTo("result");
});

renderAttempt();
