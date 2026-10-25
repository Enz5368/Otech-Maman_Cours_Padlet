import { chromium } from "../word-editor/node_modules/playwright/index.mjs";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  await page.goto("http://127.0.0.1:8765/index.html");
  await page.getByRole("button", { name: "Voir l'exemple gratuit" }).click();
  await page.waitForFunction(() => document.querySelector("#appPage").hidden === false);
  const labels = await page.locator('.sidebar .nav-button[data-view]').allTextContents();
  if (!labels.includes("Accueil") || !labels.includes("Mes cours") || labels.includes("Cours par niveau à projeter")) {
    throw new Error(`Navigation UX invalide: ${labels.join(" | ")}`);
  }
  for (const label of ["Ouvrir mes cours", "Créer un cours", "Présenter un cours"]) {
    if (await page.getByRole("button", { name: label, exact: true }).count() !== 1) throw new Error(`Accueil incomplet: ${label}`);
  }
  await page.screenshot({ path: "tests/visual/home.png", fullPage: true });
  await page.getByRole("button", { name: "Ouvrir mes cours", exact: true }).click();
  await page.waitForSelector(".welcome-strip");
  if (!(await page.locator(".welcome-strip").innerText()).includes("Choisissez une classe")) throw new Error("Parcours Mes cours incomplet");
  if (errors.length) throw new Error(`Erreurs page: ${errors.join("; ")}`);
  console.log("UI accueil et parcours Mes cours OK");
} finally {
  await browser.close();
}
