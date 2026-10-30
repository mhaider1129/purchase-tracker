import { openProtectedFile } from "./attachments";
import api from "./axios";
import { saveAs } from "file-saver";
jest.mock("./axios", () => ({ get: jest.fn() }));
jest.mock("file-saver", () => ({ saveAs: jest.fn() }));
beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockResolvedValue({ data: new Blob(["fixture"]) });
});
test("canonical and legacy API prefix use authenticated Axios blob requests", async () => {
  await openProtectedFile("/api/attachments/30/download", "test.pdf");
  expect(api.get).toHaveBeenCalledWith("/attachments/30/download", {
    responseType: "blob",
  });
  expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), "test.pdf");
});
test("local URL compatibility goes through authorized path lookup", async () => {
  await openProtectedFile("/uploads/request-20/test.pdf", "test.pdf");
  expect(api.get).toHaveBeenCalledWith(
    "/attachments/download?path=uploads%2Frequest-20%2Ftest.pdf",
    { responseType: "blob" },
  );
});
test("plan download uses authenticated API instead of direct navigation", async () => {
  await openProtectedFile("/api/procurement-plans/5/download", "plan.pdf");
  expect(api.get).toHaveBeenCalledWith("/procurement-plans/5/download", {
    responseType: "blob",
  });
});
test("external and unsupported URL schemes cannot receive the application token", async () => {
  for (const url of [
    "https://untrusted.invalid/test",
    "data:text/plain,fixture",
    "//untrusted.invalid/test",
  ])
    await expect(openProtectedFile(url)).rejects.toThrow();
  expect(api.get).not.toHaveBeenCalled();
});
test("revoked download does not save an error response as a file", async () => {
  api.get.mockRejectedValueOnce(new Error("denied"));
  await expect(openProtectedFile("/attachments/30/download")).rejects.toThrow(
    "denied",
  );
  expect(saveAs).not.toHaveBeenCalled();
});

test('PDF previews keep the filename-derived type and use a temporary authenticated blob',async()=>{
 jest.useFakeTimers();URL.createObjectURL=jest.fn(()=> 'blob:fixture');URL.revokeObjectURL=jest.fn();const open=jest.spyOn(window,'open').mockImplementation(()=>null);
 await openProtectedFile('/attachments/30/download','clinical.pdf',true);expect(URL.createObjectURL).toHaveBeenCalledWith(expect.objectContaining({type:'application/pdf'}));expect(open).toHaveBeenCalledWith('blob:fixture','_blank','noopener,noreferrer');expect(saveAs).not.toHaveBeenCalled();jest.runOnlyPendingTimers();expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fixture');open.mockRestore();jest.useRealTimers();
});
