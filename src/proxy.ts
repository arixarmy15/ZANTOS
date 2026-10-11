import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Redirects `/` to the best matching locale (Accept-Language, then English) and keeps
// every page under `/[locale]/...`.
export default createMiddleware(routing);

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
