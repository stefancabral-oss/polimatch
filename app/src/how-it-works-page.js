import "./install-error-reporter.js";
import "./photo-survey.css";
import "./site-menu.css";
import { mountSiteMenu } from "./site-menu.js";

// "Como funciona" (ICM 69, #331). O texto está no HTML; aqui só se liga o menu.
// A página não fala com a API.

const menu = mountSiteMenu({ current: "how" });

document.addEventListener("click", (event) => {
  const trigger = event.target.closest('[data-action="menu"]');
  if (trigger) menu.open(trigger);
});
