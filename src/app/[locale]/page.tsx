import {
  ArrowRight,
  Barcode,
  Braces,
  Briefcase,
  CircleCheck,
  CircleHelp,
  Clock,
  ExternalLink,
  FileOutput,
  KeyRound,
  Landmark,
  Languages,
  ListChecks,
  MonitorSmartphone,
  Scale,
  ScanText,
  Send,
  Server,
  ShieldCheck,
  Trash2,
  Truck,
  Upload,
  Building2,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import type * as React from "react";
import { getTranslations } from "next-intl/server";
import { EvidenceDemo } from "@/components/landing/evidence-demo";
import { Section } from "@/components/landing/section";
import { Button } from "@/components/ui/button";
import { RefTag, StatusTag } from "@/components/ui/tag";
import { getLanguages } from "@/i18n/languages";
import { Link } from "@/i18n/navigation";
import { requireLocale } from "@/i18n/require-locale";
import { routing } from "@/i18n/routing";
import { getServerEnv } from "@/lib/config/env";
import { CATEGORY_ORDER, CORE_RULES } from "@/lib/validation/engine";

// Limits and retention come from the server's configuration at request time.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

/** Sources for the figures quoted on the page. */
const SOURCES = {
  briefing:
    "https://library.iccwbo.org/content/tfb/BRIEFINGS/20220627_TA_Briefing_No3_reducing_discrepancy_rates.pdf",
  ucp600: "https://library.iccwbo.org/content/tfb/RULES/tfb-ucp600-rules.htm",
};

const FAQ_KEYS = [
  "compliance",
  "documents",
  "scans",
  "retention",
  "corrections",
  "models",
  "lc",
  "counterparty",
] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing" });
  const site = getServerEnv().SITE_URL;
  return {
    title: { absolute: t("metaTitle") },
    description: t("metaDescription"),
    openGraph: {
      type: "website",
      siteName: "TradeCheck",
      title: t("metaTitle"),
      description: t("metaDescription"),
      locale,
    },
    twitter: { card: "summary_large_image" },
    // Canonical and language links need the public address; without it they would point
    // at the wrong host.
    alternates: site
      ? {
          canonical: `/${locale}`,
          languages: {
            ...Object.fromEntries(routing.locales.map((code) => [code, `/${code}`])),
            "x-default": `/${routing.defaultLocale}`,
          },
        }
      : undefined,
  };
}

export default async function OverviewPage({ params }: Props) {
  const { locale } = await params;
  requireLocale(locale);
  const t = await getTranslations("landing");
  const tf = await getTranslations("findings");
  const env = getServerEnv();
  const languages = await getLanguages();
  const hours = env.RETENTION_HOURS;
  const ruleCount = CORE_RULES.length;

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "TradeCheck",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: t("metaDescription"),
      inLanguage: languages.map((language) => language.code),
      ...(env.SITE_URL ? { url: `${env.SITE_URL}/${locale}` } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ_KEYS.map((key) => ({
        "@type": "Question",
        name: t(`faq.items.${key}.q`),
        acceptedAnswer: { "@type": "Answer", text: t(`faq.items.${key}.a`, { hours }) },
      })),
    },
  ];

  const startCheck = (label: string) => (
    <Button asChild variant="primary" size="lg">
      <Link href="/checks/new">
        {label}
        <ArrowRight aria-hidden="true" className="rtl:-scale-x-100" />
      </Link>
    </Button>
  );

  return (
    <>
      <script
        type="application/ld+json"
        // JSON-LD must be inline; "<" is escaped so the text cannot close the script tag.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />

      {/* Hero: what it is, who it is for, the next step, and the product doing its job. */}
      <section aria-labelledby="hero-heading" className="border-b border-rule bg-paper">
        <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-page py-10 md:py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-14">
          <div className="grid content-start gap-6">
            <h1 id="hero-heading" className="text-display-sm font-semibold md:text-display">
              {t("hero.title")}
            </h1>
            <p className="max-w-[60ch] text-lead text-slate">{t("hero.lead")}</p>
            <div className="flex flex-wrap gap-3">
              {startCheck(t("hero.start"))}
              <Button asChild variant="secondary" size="lg">
                <a href="#how-it-works">{t("hero.how")}</a>
              </Button>
            </div>
            <ul
              aria-label={t("hero.factsLabel")}
              className="grid gap-2 border-t border-rule pt-4 text-small text-slate sm:grid-cols-3 sm:gap-4"
            >
              <Fact icon={ListChecks}>{t("hero.rules", { count: ruleCount })}</Fact>
              <Fact icon={Clock}>{t("hero.retention", { hours })}</Fact>
              <Fact icon={Languages}>{t("hero.languages", { count: languages.length })}</Fact>
            </ul>
          </div>
          <EvidenceDemo />
        </div>
      </section>

      {/* Problem, with sourced figures and an honest statement of scope. */}
      <Section id="problem" title={t("problem.title")}>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-x-14">
          <div className="grid content-start gap-5">
            <p className="max-w-[68ch] text-reading">{t("problem.body")}</p>
            <ul aria-label={t("problem.listLabel")} className="grid gap-2">
              {(["counts", "totals", "terms", "parties", "missing"] as const).map((key) => (
                <li key={key} className="flex items-start gap-3 text-reading">
                  <span aria-hidden="true" className="mt-2.5 h-0.5 w-3 shrink-0 bg-error-mark" />
                  {t(`problem.items.${key}`)}
                </li>
              ))}
            </ul>
          </div>
          <aside aria-label={t("sources")} className="grid content-start gap-4">
            <figure className="grid gap-2 border-s-[3px] border-harbor bg-paper p-5">
              <p className="text-display-sm font-semibold text-harbor tabular-nums">
                <bdi dir="ltr">{t("problem.statValue")}</bdi>
              </p>
              <p className="text-reading">{t("problem.statText")}</p>
              <figcaption>
                <SourceLink href={SOURCES.briefing}>{t("problem.statSource")}</SourceLink>
              </figcaption>
            </figure>
            <figure className="grid gap-2 border-s-[3px] border-rule bg-paper p-5">
              <blockquote className="text-reading">{t("problem.ruleText")}</blockquote>
              <figcaption>
                <SourceLink href={SOURCES.ucp600}>{t("problem.ruleSource")}</SourceLink>
              </figcaption>
            </figure>
            <p className="text-small text-slate">{t("problem.scope")}</p>
          </aside>
        </div>
      </Section>

      {/* How it works, in the order the user does it. */}
      <Section id="how-it-works" tone="paper" title={t("how.title")} lead={t("how.lead")}>
        <ol className="grid gap-px border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              [
                "add",
                Upload,
                {
                  files: env.UPLOAD_MAX_FILES_PER_CHECK,
                  mb: env.UPLOAD_MAX_FILE_MB,
                  pages: env.UPLOAD_MAX_PAGES,
                },
              ],
              ["read", ScanText, {}],
              ["check", ListChecks, { count: ruleCount }],
              ["share", FileOutput, {}],
            ] as const
          ).map(([key, Icon, values], index) => (
            <li key={key} className="grid content-start gap-3 bg-paper p-5">
              <span className="flex items-center gap-2">
                <RefTag className="min-h-6 px-2 text-small">{index + 1}</RefTag>
                <Icon aria-hidden="true" className="size-5 text-harbor" />
              </span>
              <h3 className="text-title font-semibold">{t(`how.steps.${key}.title`)}</h3>
              <p className="text-body text-slate">{t(`how.steps.${key}.body`, values)}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* The real rule list, read from the engine so the page cannot drift from the product. */}
      <Section id="checks" title={t("checks.title")} lead={t("checks.lead")}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORY_ORDER.map((category) => {
            const rules = CORE_RULES.filter((rule) => rule.category === category);
            return (
              <section
                key={category}
                aria-labelledby={`category-${category}`}
                className="grid content-start gap-3 border border-rule bg-paper p-4"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 id={`category-${category}`} className="text-title-sm font-semibold">
                    {tf(`categories.${category}`)}
                  </h3>
                  <span className="shrink-0 text-small text-slate tabular-nums">
                    {t("checks.count", { count: rules.length })}
                  </span>
                </div>
                <ul className="grid gap-2">
                  {rules.map((rule) => (
                    <li key={rule.id} className="flex items-start gap-2 text-small">
                      <CircleCheck
                        aria-hidden="true"
                        className="mt-px size-4 shrink-0 text-success-fg"
                      />
                      {tf(`rules.${rule.id}`)}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </Section>

      {/* The signature element: evidence tied to the page and line. */}
      <Section id="evidence" tone="paper" title={t("evidence.title")} lead={t("evidence.body")}>
        <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-x-14">
          <ul className="grid content-start gap-3">
            {(["quotes", "corrected", "zoom"] as const).map((key) => (
              <li key={key} className="flex items-start gap-3 text-reading">
                <CircleCheck aria-hidden="true" className="mt-1 size-5 shrink-0 text-harbor" />
                {t(`evidence.items.${key}`)}
              </li>
            ))}
          </ul>
          <figure className="grid gap-2">
            <div className="grid gap-3 border border-rule bg-paper p-4">
              <div className="flex flex-wrap items-center gap-2">
                <RefTag>F1</RefTag>
                <StatusTag status="error" />
                <span className="text-small text-slate">{tf("rules.xdoc-packages")}</span>
              </div>
              <p className="text-body">
                {tf("messages.xdoc-packages", {
                  valueA: "12",
                  docA: "⁨commercial-invoice.pdf⁩",
                  valueB: "14",
                  docB: "⁨packing-list.pdf⁩",
                })}
              </p>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-stretch gap-2">
                <q className="block bg-evidence-wash px-3 py-2 font-mono text-small before:content-none after:content-none">
                  <bdi>{t("evidence.quote")}</bdi>
                </q>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="w-0.5 self-stretch bg-harbor" />
                  <RefTag className="border-harbor bg-harbor-tint">F1</RefTag>
                </span>
              </div>
              <p className="text-caption text-slate">
                <bdi className="code">commercial-invoice.pdf</bdi> · {t("demo.page", { page: 1 })}
              </p>
            </div>
            <figcaption className="text-small text-slate">{t("evidence.exampleLabel")}</figcaption>
          </figure>
        </div>
      </Section>

      {/* What it will not do: the product's boundaries, stated as plainly as its features. */}
      <Section id="principles" title={t("principles.title")}>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["hs", Barcode],
              ["sources", Landmark],
              ["guess", CircleHelp],
              ["advice", Scale],
            ] as const
          ).map(([key, Icon]) => (
            <li key={key} className="grid content-start gap-2 border-t-2 border-carbon pt-4">
              <Icon aria-hidden="true" className="size-5 text-carbon" />
              <h3 className="text-title-sm font-semibold">{t(`principles.items.${key}.title`)}</h3>
              <p className="text-body text-slate">{t(`principles.items.${key}.body`)}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* AI and privacy, side by side. */}
      <section
        aria-label={`${t("ai.title")} · ${t("privacy.title")}`}
        className="border-b border-rule bg-paper"
      >
        <div className="mx-auto grid max-w-[1200px] gap-px bg-rule px-0 md:grid-cols-2">
          <div className="grid content-start gap-4 bg-paper px-page py-12 md:py-16 md:pe-10">
            <h2 className="text-heading font-semibold md:text-page">{t("ai.title")}</h2>
            <p className="text-reading text-slate">{t("ai.body")}</p>
            <ul className="grid gap-3">
              <Point icon={Braces}>{t("ai.items.schema")}</Point>
              <Point icon={ShieldCheck}>{t("ai.items.data")}</Point>
              <Point icon={ListChecks}>{t("ai.items.tokens")}</Point>
            </ul>
          </div>
          <div className="grid content-start gap-4 bg-paper px-page py-12 md:py-16 md:ps-10">
            <h2 className="text-heading font-semibold md:text-page">{t("privacy.title")}</h2>
            <ul className="grid gap-3">
              <Point icon={Server}>{t("privacy.items.local")}</Point>
              <Point icon={Trash2}>{t("privacy.items.retention", { hours })}</Point>
              <Point icon={Send}>{t("privacy.items.send")}</Point>
              <Point icon={KeyRound}>{t("privacy.items.keys")}</Point>
            </ul>
          </div>
        </div>
      </section>

      {/* Who it is for, and in which languages. */}
      <Section id="audience" title={t("audience.title")}>
        <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-x-14">
          <ul className="grid content-start gap-3">
            <Point icon={Briefcase}>{t("audience.items.exporters")}</Point>
            <Point icon={Truck}>{t("audience.items.forwarders")}</Point>
            <Point icon={Building2}>{t("audience.items.brokers")}</Point>
          </ul>
          <div className="grid content-start gap-3">
            <h3 className="text-title-sm font-semibold">{t("audience.languages")}</h3>
            <ul className="flex flex-wrap gap-2">
              {languages.map((language) => (
                <li
                  key={language.code}
                  lang={language.code}
                  dir={language.direction}
                  className="border border-rule bg-paper px-3 py-1.5 text-body"
                >
                  {language.name}
                </li>
              ))}
            </ul>
            <p className="flex items-start gap-2 text-body text-slate">
              <MonitorSmartphone aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {t("audience.devices")}
            </p>
          </div>
        </div>
      </Section>

      {/* Questions, answered on the page (and mirrored in the FAQPage structured data). */}
      <Section id="faq" tone="paper" title={t("faq.title")}>
        <div className="max-w-[80ch] divide-y divide-rule border-y border-rule">
          {FAQ_KEYS.map((key) => (
            <details key={key} className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-3 text-title-sm font-semibold transition-control hover:text-harbor [&::-webkit-details-marker]:hidden">
                {t(`faq.items.${key}.q`)}
                <span
                  aria-hidden="true"
                  className="code shrink-0 text-title text-slate group-open:hidden"
                >
                  +
                </span>
                <span
                  aria-hidden="true"
                  className="code hidden shrink-0 text-title text-slate group-open:inline"
                >
                  −
                </span>
              </summary>
              <p className="max-w-[72ch] pb-4 text-reading text-slate">
                {t(`faq.items.${key}.a`, { hours })}
              </p>
            </details>
          ))}
        </div>
      </Section>

      {/* Final call to action. */}
      <section aria-labelledby="cta-heading" className="bg-ledger">
        <div className="mx-auto grid max-w-[1200px] gap-4 px-page py-12 md:py-16">
          <div className="grid gap-5 border-t-[3px] border-harbor bg-paper p-6 md:p-10">
            <h2 id="cta-heading" className="text-heading font-semibold md:text-page">
              {t("cta.title")}
            </h2>
            <p className="max-w-[60ch] text-reading text-slate">{t("cta.body")}</p>
            <div className="flex flex-wrap gap-3">
              {startCheck(t("cta.start"))}
              <Button asChild variant="secondary" size="lg">
                <Link href="/checks">{t("cta.checks")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Fact({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Icon aria-hidden="true" className="mt-px size-4 shrink-0 text-harbor" />
      <span>{children}</span>
    </li>
  );
}

function Point({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-reading">
      <Icon aria-hidden="true" className="mt-1 size-5 shrink-0 text-harbor" />
      <span>{children}</span>
    </li>
  );
}

function SourceLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-6 items-center pointer-coarse:min-h-11 gap-1 text-small text-harbor underline underline-offset-2 hover:text-harbor-strong"
    >
      {children}
      <ExternalLink aria-hidden="true" className="size-3.5 shrink-0" />
    </a>
  );
}
