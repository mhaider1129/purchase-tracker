import api from "./axios";
import { saveAs } from "file-saver";
export async function openProtectedFile(
  url,
  filename = "attachment",
  preview = false,
) {
  if (typeof url !== "string") throw new Error("File URL unavailable");
  let endpoint = url.replace(/^\/api(?=\/)/, "");
  if (endpoint.startsWith("/uploads/"))
    endpoint = `/attachments/download?path=${encodeURIComponent(endpoint.slice(1))}`;
  if (
    !endpoint.startsWith("/attachments/") &&
    !endpoint.startsWith("/procurement-plans/")
  )
    throw new Error("Unsupported file URL");
  const response = await api.get(endpoint, { responseType: "blob" });
  if (preview && /\.(pdf|png|jpe?g|webp)$/i.test(filename)) {
    const ext = filename.split(".").pop().toLowerCase();
    const blob = new Blob([response.data], {
      type:
        ext === "pdf"
          ? "application/pdf"
          : ext === "jpg"
            ? "image/jpeg"
            : `image/${ext}`,
    });
    const href = URL.createObjectURL(blob);
    window.open(href, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(href), 60000);
  } else saveAs(response.data, filename);
}
