import pdf from 'pdf-parse';

/**
 * Extract text from a PDF buffer
 */
export async function pdfToText(buffer: Buffer): Promise<string> {
  const data = await pdf(buffer);
  return data.text;
}

/**
 * Extract text and metadata from a PDF buffer
 */
export async function pdfToTextWithMetadata(buffer: Buffer): Promise<{
  text: string;
  numPages: number;
  info: {
    title?: string;
    author?: string;
    subject?: string;
  };
}> {
  const data = await pdf(buffer);

  return {
    text: data.text,
    numPages: data.numpages,
    info: {
      title: data.info?.Title as string | undefined,
      author: data.info?.Author as string | undefined,
      subject: data.info?.Subject as string | undefined,
    },
  };
}

export default pdfToText;
