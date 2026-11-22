import { groups } from "./screens.mjs";

const screens = new Map(groups.flatMap(([category, items]) => items.map(([id, title, details]) => [id, { category, title, details }])));
const navigation = document.querySelector("#navigation");
const select = document.querySelector("#screen");
const preview = document.querySelector("#capture");
const error = document.querySelector("#capture-error");
const buttons = [...document.querySelectorAll("[data-choice]")];
const current = {
  screen: "portada",
  view: "propuesta",
  format: matchMedia("(max-width: 780px)").matches ? "movil" : "desktop",
  theme: "claro",
};

for (const [category, items] of groups) {
  const section = document.createElement("section");
  const label = document.createElement("h2");
  label.textContent = category;
  section.append(label);
  const options = document.createElement("optgroup");
  options.label = category;
  for (const [id, title] of items) {
    const link = document.createElement("a");
    link.href = `#${id}`;
    link.textContent = title;
    section.append(link);
    const option = document.createElement("option");
    option.value = id;
    option.textContent = title;
    options.append(option);
  }
  navigation.append(section);
  select.append(options);
}

function render() {
  const { screen, view, format, theme } = current;
  const { category, title, details } = screens.get(screen);
  const image = `screens/${screen}-${format}-${theme}-${view}.webp`;
  const caption = `${view === "actual" ? "Actual" : "Propuesta"} · ${format === "desktop" ? "Escritorio, 1440 px" : "Móvil, 390 px"} · Tema ${theme}`;
  document.querySelector("#category").textContent = category;
  document.querySelector("#screen-title").textContent = title;
  document.querySelector("#details").textContent = details;
  document.querySelector("#caption").textContent = caption;
  document.querySelector("#frame").dataset.format = format;
  document.querySelector("#open").href = image;
  select.value = screen;
  error.hidden = true;
  preview.alt = `Captura: ${title}. ${caption}.`;
  preview.src = image;
  for (const button of buttons) {
    button.setAttribute("aria-pressed", String(current[button.dataset.choice] === button.value));
  }
  for (const link of navigation.querySelectorAll("a")) {
    if (link.hash === `#${screen}`) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
}

function changeScreen() {
  const target = location.hash.slice(1);
  current.screen = screens.has(target) ? target : "portada";
  render();
}

for (const button of buttons) {
  button.addEventListener("click", () => {
    current[button.dataset.choice] = button.value;
    render();
  });
}
select.addEventListener("change", () => { location.hash = select.value; });
preview.addEventListener("error", () => { error.hidden = false; });
window.addEventListener("hashchange", changeScreen);
changeScreen();
