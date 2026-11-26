import "./install-error-reporter.js";
import "./photo-survey.css";
import "./site-menu.css";
import { mountSiteMenu } from "./site-menu.js";

// "Créditos das fotos" (ICM 74, #348). O texto está no HTML, que é gerado por
// app/scripts/build-celebrity-cards.mjs; aqui só se liga o menu. A página não
// fala com a API.

const menu = mountSiteMenu({ current: "credits" });

document.addEventListener("click", (event) => {
  const trigger = event.target.closest('[data-action="menu"]');
  if (trigger) menu.open(trigger);
});
