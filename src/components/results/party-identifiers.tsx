import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { VERIFICATION_LINKS, type PartyIdentifier } from "@/lib/checks/identifiers";

/**
 * The parties' VAT and EORI numbers with a link to the official service that can confirm
 * them. Tickline checks format and consistency only; it does not query those services.
 */
export function PartyIdentifiers({ identifiers }: { identifiers: PartyIdentifier[] }) {
  const t = useTranslations("results.identifiers");
  if (identifiers.length === 0) return null;
  return (
    <section aria-labelledby="identifiers-heading" className="grid gap-3 break-inside-avoid">
      <div className="grid gap-1">
        <h2 id="identifiers-heading" className="text-title font-semibold">
          {t("heading")}
        </h2>
        <p className="max-w-[72ch] text-small text-slate">{t("lead")}</p>
      </div>
      <ul className="divide-y divide-rule border border-rule bg-paper">
        {identifiers.map((item) => (
          <li
            key={`${item.party}:${item.kind}:${item.value}`}
            className="grid gap-x-4 gap-y-1 px-3 py-2.5 text-small sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] sm:items-center"
          >
            <span className="font-medium">
              {t(item.party)} · {t(item.kind)}
            </span>
            <span className="grid min-w-0 gap-0.5">
              <bdi dir="ltr" className="code justify-self-start">
                {item.value}
              </bdi>
              <span className="truncate text-caption text-slate">
                {t("documents")}: <bdi>{item.documents.join(", ")}</bdi>
              </span>
            </span>
            {item.verifyAt ? (
              <a
                href={VERIFICATION_LINKS[item.verifyAt]}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-6 items-center gap-1 justify-self-start text-harbor underline underline-offset-2 hover:text-harbor-strong pointer-coarse:min-h-11 print:no-underline"
              >
                {t(item.verifyAt === "vies" ? "vies" : "eoriCheck")}
                <ExternalLink aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="sr-only">{t("newTab")}</span>
              </a>
            ) : (
              <span className="text-caption text-slate">{t("notEu")}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
