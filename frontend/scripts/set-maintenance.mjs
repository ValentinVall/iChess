import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.resolve(__dirname, "../public/maintenance.json");

const baseConfig = {
  enabled: false,
  title: "Технические работы на шахматной доске",
  subtitle:
    "Мы временно закрыли вход для новых посещений, пока наводим порядок в сервисе и готовим следующее обновление.",
  message:
    "Обновляем систему, проверяем стабильность и готовим сервис к безопасному возвращению игроков.",
  eta: "Вернемся сразу после завершения проверки. Обновите страницу чуть позже.",
};

function readConfig() {
  if (!fs.existsSync(configPath)) {
    return { ...baseConfig };
  }

  const raw = fs.readFileSync(configPath, "utf8");
  return { ...baseConfig, ...JSON.parse(raw) };
}

function writeConfig(config) {
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

const command = process.argv[2];
const currentConfig = readConfig();

if (command === "on") {
  writeConfig({ ...currentConfig, enabled: true });
  console.log("Maintenance mode: ON");
  process.exit(0);
}

if (command === "off") {
  writeConfig({ ...currentConfig, enabled: false });
  console.log("Maintenance mode: OFF");
  process.exit(0);
}

if (command === "status") {
  console.log(`Maintenance mode: ${currentConfig.enabled ? "ON" : "OFF"}`);
  console.log(configPath);
  process.exit(0);
}

console.log("Usage: node ./scripts/set-maintenance.mjs <on|off|status>");
process.exit(1);
