export type UploadResult = { ok: true; id: string } | { ok: false; error: string };

/** Uploads one file with progress reporting (fetch cannot report upload progress). */
export function uploadFile(
  checkId: string,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    const body = new FormData();
    body.append("file", file);
    request.open("POST", `/api/checks/${checkId}/documents`);
    request.responseType = "json";
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      const response = (request.response ?? {}) as { id?: string; error?: string };
      if (request.status === 201 && response.id) resolve({ ok: true, id: response.id });
      else resolve({ ok: false, error: response.error ?? "network" });
    };
    request.onerror = () => resolve({ ok: false, error: "network" });
    request.send(body);
  });
}

export async function postJson(
  url: string,
  body: unknown,
  method = "POST",
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (response.ok) return { ok: true, data };
    return { ok: false, error: (data as { error?: string } | null)?.error ?? "network" };
  } catch {
    return { ok: false, error: "network" };
  }
}
