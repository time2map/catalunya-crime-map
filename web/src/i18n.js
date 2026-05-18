import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./i18n/en.js";
import es from "./i18n/es.js";

const urlLang = typeof window !== "undefined"
  ? new URLSearchParams(window.location.search).get("lang")
  : null;
const stored = typeof localStorage !== "undefined" ? localStorage.getItem("lang") : null;
const browserLang = typeof navigator !== "undefined" ? navigator.language?.slice(0, 2) : "en";
const defaultLang = urlLang || stored || (browserLang === "es" || browserLang === "ca" ? "es" : "en");

i18next.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: defaultLang,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18next;
