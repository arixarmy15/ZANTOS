"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { postJson } from "@/components/upload/upload-file";
import { useErrorMessage } from "@/components/upload/use-error-message";
import { useRouter } from "@/i18n/navigation";

export function DeleteCheckButton({ checkId }: { checkId: string }) {
  const t = useTranslations("check");
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 aria-hidden="true" />
          {t("delete")}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={t("close")}>
        <DialogTitle>{t("deleteTitle")}</DialogTitle>
        <DialogDescription>{t("deleteBody")}</DialogDescription>
        {error ? (
          <p role="alert" className="text-error-fg">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <DialogClose asChild>
            <Button>{t("cancel")}</Button>
          </DialogClose>
          <Button
            variant="destructive-solid"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const result = await postJson(`/api/checks/${checkId}`, undefined, "DELETE");
              if (result.ok) {
                router.replace("/");
                router.refresh();
              } else {
                setError(errorMessage(result.error));
                setBusy(false);
              }
            }}
          >
            {t("deleteConfirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
