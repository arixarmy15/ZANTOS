import "server-only";
import { getTranslations } from "next-intl/server";
import type { CheckRecord, Storage } from "@/lib/storage/types";
import { evaluateCheck } from "./evaluate";
import { presentFindings, presentRules, summarize, type Translate } from "./present";

/** Evaluates a check and renders its findings in one interface language. */
export async function presentCheck(storage: Storage, check: CheckRecord, locale: string) {
  const evaluation = await evaluateCheck(storage, check);
  const t = (await getTranslations({ locale })) as unknown as Translate;
  const documents = new Map(
    evaluation.documents.map((doc) => [
      doc.id,
      { fileName: doc.fileName, documentType: doc.documentType },
    ]),
  );
  return {
    evaluation,
    findings: presentFindings(evaluation.run.findings, { locale, t, documents }),
    rules: presentRules(evaluation.run, t),
    summary: summarize(evaluation.run),
  };
}
