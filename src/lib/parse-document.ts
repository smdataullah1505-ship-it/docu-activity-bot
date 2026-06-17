import mammoth from "mammoth";
import JSZip from "jszip";

export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const ext = name.split(".").pop() || "";

  if (ext === "txt" || ext === "md") {
    return await file.text();
  }
  if (ext === "docx") {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }
  if (ext === "pptx") {
    return await extractPptxText(file);
  }
  if (ext === "pdf") {
    return await extractPdfText(file);
  }
  throw new Error(`Unsupported file type: .${ext}. Use PDF, DOCX, PPTX, or TXT.`);
}

async function extractPptxText(file: File): Promise<string> {
  const ab = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(ab);
  const slideFiles = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml/)![1], 10);
      const nb = parseInt(b.match(/slide(\d+)\.xml/)![1], 10);
      return na - nb;
    });

  const out: string[] = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]].async("string");
    // Extract <a:t>...</a:t> text runs
    const texts = Array.from(xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)).map((m) => m[1]);
    if (texts.length) {
      out.push(`Slide ${i + 1}:\n${texts.join(" ")}`);
    }
  }
  return out.join("\n\n");
}

async function extractPdfText(file: File): Promise<string> {
  // Dynamic import to keep this client-only and load the worker lazily.
  const pdfjs = await import("pdfjs-dist");
  // @ts-expect-error - worker URL import
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const ab = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: ab }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((it) => ("str" in it ? (it as { str: string }).str : ""))
      .join(" ");
    pages.push(`Page ${i}:\n${text}`);
  }
  return pages.join("\n\n");
}
