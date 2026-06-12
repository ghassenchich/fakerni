import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { I18nManager } from "react-native";
import en from "./locales/en.json";
import fr from "./locales/fr.json";
import ar from "./locales/ar.json";

export const RTL_LANGUAGES = ["ar"];
export const LANGUAGE_STORAGE_KEY = "fakerni_language";

const resources = {
  en: { translation: en },
  fr: { translation: fr },
  ar: { translation: ar },
};

export function applyDirection(lng) {
  const isRTL = RTL_LANGUAGES.includes(lng);
  if (I18nManager.isRTL !== isRTL) {
    I18nManager.allowRTL(isRTL);
    I18nManager.forceRTL(isRTL);
  }
}

async function detectLanguage() {
  const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (saved && resources[saved]) return saved;

  const deviceLanguage = Localization.getLocales()[0]?.languageCode;
  return resources[deviceLanguage] ? deviceLanguage : "en";
}

export async function changeLanguage(lng) {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
  await i18n.changeLanguage(lng);
  applyDirection(lng);
}

export const i18nReady = detectLanguage().then((lng) =>
  i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: "en",
    supportedLngs: ["en", "fr", "ar"],
    interpolation: { escapeValue: false },
  })
).then(() => {
  applyDirection(i18n.resolvedLanguage);
});

export default i18n;
