/** Reads a script file as plain text. Supports .txt, .md and .docx (parsed in the browser). */
export async function readScriptFile(file: File): Promise<string> {
  if (/\.docx$/i.test(file.name)) {
    const mammoth = await import("mammoth/mammoth.browser");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value.replace(/\n{3,}/g, "\n\n").trim();
  }
  return await file.text();
}
