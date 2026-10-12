"use client";

import { Bot, Check, Copy, Mail, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { postJson } from "@/components/upload/upload-file";
import { useErrorMessage } from "@/components/upload/use-error-message";
import { useRouter } from "@/i18n/navigation";
import { mailtoLink } from "@/lib/assist/mailto";
import { languageName } from "@/lib/format";

type Draft = { subject: string; body: string };

/**
 * AI-drafted request to correct the documents, in the documents' language by default.
 * Labelled as an AI-generated draft; offered for copying or opening in a mail program only.
 */
export function EmailDraft({
  checkId,
  languages,
  defaultLanguage,
  issueCount,
  enabled,
}: {
  checkId: string;
  /** Language tags offered: the documents' languages first, then the interface languages. */
  languages: string[];
  defaultLanguage: string;
  issueCount: number;
  enabled: boolean;
}) {
  const t = useTranslations("results.email");
  const tc = useTranslations("check");
  const locale = useLocale();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [language, setLanguage] = useState(defaultLanguage);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const ids = { language: useId(), subject: useId(), body: useId() };

  async function generate() {
    setBusy(true);
    setError(null);
    const result = await postJson(`/api/checks/${checkId}/email`, { language });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDraft(result.data as Draft);
    router.refresh(); // token usage changed
  }

  async function copy() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(`${draft.subject}\n\n${draft.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("copy_failed");
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" disabled={!enabled || issueCount === 0}>
          <Mail aria-hidden="true" />
          {t("open")}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={tc("close")} className="max-w-[640px]">
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription className="text-small text-slate">{t("description")}</DialogDescription>

        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1">
            <Label htmlFor={ids.language}>{t("language")}</Label>
            <NativeSelect
              id={ids.language}
              value={language}
              onChange={(event) => {
                setLanguage(event.target.value);
                setDraft(null);
              }}
            >
              {languages.map((tag) => (
                <option key={tag} value={tag}>
                  {languageName(tag, locale)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button variant="primary" onClick={() => void generate()} disabled={busy}>
            <Send aria-hidden="true" className="rtl:-scale-x-100" />
            {busy ? t("generating") : draft ? t("regenerate") : t("generate")}
          </Button>
        </div>
        <p className="text-small text-slate">{t("tokensNote", { count: issueCount })}</p>

        <div aria-live="polite" className="grid gap-3">
          {error ? (
            <p className="text-small text-error-fg">
              {error === "copy_failed" ? t("copyFailed") : errorMessage(error)}
            </p>
          ) : null}
          {draft ? (
            <div className="grid gap-3 rounded-sm border border-rule p-3 animate-fade-in">
              <p className="flex items-center gap-1.5 text-caption font-medium text-slate">
                <Bot aria-hidden="true" className="size-3.5" />
                {t("aiDraft")}
              </p>
              <div className="grid gap-1">
                <Label htmlFor={ids.subject}>{t("subject")}</Label>
                <Input
                  id={ids.subject}
                  dir="auto"
                  value={draft.subject}
                  onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor={ids.body}>{t("body")}</Label>
                <Textarea
                  id={ids.body}
                  dir="auto"
                  rows={12}
                  value={draft.body}
                  onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => void copy()}>
                  {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                  {copied ? t("copied") : t("copy")}
                </Button>
                <a
                  href={mailtoLink(draft)}
                  className={buttonVariants({ variant: "secondary", size: "sm" })}
                >
                  <Mail aria-hidden="true" />
                  {t("openMail")}
                </a>
              </div>
              <p className="text-small text-slate">{t("neverSent")}</p>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
