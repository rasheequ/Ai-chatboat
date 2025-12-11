// This service simulates the "Cloud Function" for text extraction using the browser's PDF.js
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

export const extractTextFromPdf = async (file: File): Promise<{ text: string; pageCount: number }> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += pageText + '\n';
  }

  return { text: fullText, pageCount: pdf.numPages };
};

export const chunkText = (text: string, chunkSize: number = 500): string[] => {
  // Simple chunking by character count, respecting sentence boundaries roughly
  const chunks: string[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+|\s\n/g) || [text];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > chunkSize) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  // Filter out empty chunks to prevent API errors
  return chunks.filter(c => c.length > 0);
};