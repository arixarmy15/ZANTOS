import "server-only";
import { routing } from "./routing";

export type LanguageMeta = { code: string; name: string; direction: "ltr" | "rtl" };

/** Every interface language, named in its own language (from its message file's `meta`). */
export async function getLanguages(): Promise<LanguageMeta[]> {
  return Promise.all(
    routing.locales.map(async (code) => {
      const messages = (await import(`../../messages/${code}.json`)).default as {
        meta: { name: string; direction: "ltr" | "rtl" };
      };
      return { code, name: messages.meta.name, direction: messages.meta.direction };
    }),
  );
}
