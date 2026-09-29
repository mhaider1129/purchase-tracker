import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { DOCUMENT_BRANDING_UPDATED_EVENT } from "./DocumentPrintBranding";

const emptySettings = { logo_data: "", document_code: "", template_data: "" };

const ImageSetting = ({ label, value, alt, disabled, onChange, onRemove }) => (
  <label className="block">
    <span className="block text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</span>
    <input type="file" accept="image/*" disabled={disabled}
      className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-sm"
      onChange={(event) => onChange(event.target.files?.[0])} />
    {value && <span className="mt-2 flex items-center gap-3">
      <img src={value} alt={alt} className="h-14 max-w-40 object-contain" />
      <button type="button" className="text-sm text-red-700 underline" onClick={onRemove}>Remove</button>
    </span>}
  </label>
);

const DocumentBrandingSettings = () => {
  const [settings, setSettings] = useState(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", text: "" });

  useEffect(() => {
    let active = true;
    api.get("/document-branding")
      .then((response) => active && setSettings({ ...emptySettings, ...response.data?.settings }))
      .catch((error) => active && setFeedback({ type: "error", text: error?.response?.data?.message || "Failed to load document branding." }))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const readImage = (field, file) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
      setFeedback({ type: "error", text: "Choose an image smaller than 2MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSettings((current) => ({ ...current, [field]: String(reader.result || "") }));
      setFeedback({ type: "", text: "" });
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setSaving(true);
    setFeedback({ type: "", text: "" });
    try {
      const response = await api.put("/document-branding", {
        logo_data: settings.logo_data,
        document_code: settings.document_code,
        template_data: settings.template_data,
      });
      setSettings({ ...emptySettings, ...response.data?.settings });
      setFeedback({ type: "success", text: response.data?.message || "Document branding saved." });
      window.dispatchEvent(new Event(DOCUMENT_BRANDING_UPDATED_EVENT));
    } catch (error) {
      setFeedback({ type: "error", text: error?.response?.data?.message || "Failed to save document branding." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Loading organization document branding…</p>;

  return <section className="space-y-4 rounded border border-blue-100 bg-blue-50 p-4">
    <div><h3 className="text-base font-semibold text-blue-950">Organization document branding</h3>
      <p className="text-sm text-blue-900">Configure the template once. It is applied to every printable page and popup for every user.</p></div>
    {feedback.text && <p className={`text-sm ${feedback.type === "error" ? "text-red-600" : "text-green-700"}`}>{feedback.text}</p>}
    <div className="grid gap-4 lg:grid-cols-3">
      <ImageSetting label="Company logo" value={settings.logo_data} alt="Current company logo" disabled={saving}
        onChange={(file) => readImage("logo_data", file)} onRemove={() => setSettings((value) => ({ ...value, logo_data: "" }))} />
      <label className="block"><span className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Document code</span>
        <input type="text" maxLength={80} value={settings.document_code} disabled={saving} placeholder="e.g. PR-FRM-001"
          className="mt-1 w-full rounded border border-gray-300 bg-white p-2"
          onChange={(event) => setSettings((value) => ({ ...value, document_code: event.target.value }))} /></label>
      <ImageSetting label="Page template / watermark" value={settings.template_data} alt="Current print template" disabled={saving}
        onChange={(file) => readImage("template_data", file)} onRemove={() => setSettings((value) => ({ ...value, template_data: "" }))} />
    </div>
    {settings.updated_at && <p className="text-xs text-gray-600">Last updated {new Date(settings.updated_at).toLocaleString()}{settings.updated_by_name ? ` by ${settings.updated_by_name}` : ""}.</p>}
    <button type="button" onClick={save} disabled={saving}
      className={`rounded px-4 py-2 font-semibold text-white ${saving ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"}`}>
      {saving ? "Saving branding…" : "Save branding for all users"}
    </button>
  </section>;
};

export default DocumentBrandingSettings;