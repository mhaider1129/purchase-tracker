import { applyDocumentBranding } from "./DocumentPrintBranding";

describe("applyDocumentBranding", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.head
      .querySelectorAll("#system-document-print-branding-styles")
      .forEach((element) => element.remove());
  });

  it("adds the centrally configured logo, code, and template", () => {
    applyDocumentBranding(document, {
      logo_data: "data:image/png;base64,AAAA",
      document_code: "PR-FRM-001",
      template_data: "data:image/png;base64,BBBB",
    });

    const header = document.getElementById("system-document-print-branding");
    expect(header).toHaveTextContent("PR-FRM-001");
    expect(header.querySelector("img")).toHaveAttribute(
      "src",
      "data:image/png;base64,AAAA",
    );
    expect(
      document.getElementById("system-document-print-branding-styles"),
    ).toHaveTextContent("data:image/png;base64,BBBB");
  });

  it("replaces prior branding instead of duplicating it", () => {
    applyDocumentBranding(document, { document_code: "OLD" });
    applyDocumentBranding(document, { document_code: "NEW" });

    expect(
      document.querySelectorAll("#system-document-print-branding"),
    ).toHaveLength(1);
    expect(document.body).toHaveTextContent("NEW");
    expect(document.body).not.toHaveTextContent("OLD");
  });
});