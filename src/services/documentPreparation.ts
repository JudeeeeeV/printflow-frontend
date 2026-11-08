export const DOCX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const formats: Record<string, string> = {
  pdf: 'application/pdf',
  docx: DOCX_MIME_TYPE,
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};
const codes = [
  'UNSUPPORTED_FILE',
  'EMPTY_FILE',
  'FILE_TOO_LARGE',
  'UNREADABLE_FILE',
  'FILE_LIMIT_EXCEEDED',
  'CONVERSION_UNAVAILABLE',
  'UPLOAD_FAILED',
  'DRAFT_FILE_UNAVAILABLE',
];

export interface FileFeedback {
  passed: boolean;
  message: string;
  nextStep?: string;
  code?: string;
  retryable?: boolean;
  uncertain?: boolean;
}
export interface PreparedFile {
  file: File;
  pageCount: number;
  paperSize: string;
  feedback: FileFeedback;
}

const failure = (code: string, message: string, nextStep: string): FileFeedback => ({
  passed: false,
  code,
  message,
  nextStep,
});

/** Fast local checks only; the server validates/converts again on submission. */
export async function prepareDocument(file: File): Promise<PreparedFile | FileFeedback> {
  const dot = file.name.lastIndexOf('.');
  const extension = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : '';
  const mime = Object.hasOwn(formats, extension) ? formats[extension] : undefined;
  if (!mime || (file.type && file.type !== 'application/octet-stream' && file.type !== mime)) {
    return failure(
      'UNSUPPORTED_FILE',
      'This file format is not supported or does not match its extension.',
      'Choose a PDF, DOCX, PNG, JPG, or WEBP file. Export it again rather than renaming its extension.'
    );
  }
  if (file.size === 0)
    return failure(
      'EMPTY_FILE',
      'This file is empty.',
      'Export a non-empty file or choose another file.'
    );
  if (file.size > MAX_DOCUMENT_BYTES)
    return failure(
      'FILE_TOO_LARGE',
      'This file exceeds the 20 MB upload limit.',
      'Compress or export a smaller file, then select it again.'
    );
  const selected =
    file.type === mime
      ? file
      : new File([file], file.name, { type: mime, lastModified: file.lastModified });
  let pageCount = 1,
    paperSize = 'A4';
  if (mime === 'application/pdf') {
    const { PDFDocument, EncryptedPDFError } = await import('pdf-lib');
    try {
      const pdf = await PDFDocument.load(await selected.arrayBuffer());
      pageCount = pdf.getPageCount();
      if (pageCount < 1)
        return failure(
          'UNREADABLE_FILE',
          'This PDF has no pages.',
          'Export a PDF containing the pages you want to print and select it again.'
        );
      const { width, height } = pdf.getPage(0).getSize();
      const longest = Math.max(width, height);
      if (Math.abs(longest - 792) < 20) paperSize = 'SHORT';
      else if (Math.abs(longest - 1008) < 20) paperSize = 'LONG';
    } catch (error) {
      const encrypted =
        error instanceof EncryptedPDFError ||
        (error instanceof Error && error.message === new EncryptedPDFError().message);
      return failure(
        'UNREADABLE_FILE',
        encrypted ? 'This PDF is password-protected.' : 'This PDF could not be read.',
        encrypted
          ? 'Unlock it and export an unprotected PDF, then select it again.'
          : 'Open it in its original app and export a new PDF, or choose another file.'
      );
    }
  } else if (mime.startsWith('image/')) {
    const url = URL.createObjectURL(selected);
    try {
      const readable = await new Promise<boolean>((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image.naturalWidth > 0 && image.naturalHeight > 0);
        image.onerror = () => resolve(false);
        image.src = url;
      });
      if (!readable)
        return failure(
          'UNREADABLE_FILE',
          'This image could not be read.',
          'Open and export a new PNG, JPG, or WEBP image, then select it again.'
        );
    } catch {
      return failure(
        'UNREADABLE_FILE',
        'This image could not be checked.',
        'Export a new image or choose another file.'
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return {
    file: selected,
    pageCount,
    paperSize,
    feedback: {
      passed: true,
      message:
        mime === DOCX_MIME_TYPE
          ? 'DOCX selected. The server will validate, convert, and count its pages when you submit.'
          : 'Local checks passed. The server will validate and prepare this file when you submit.',
    },
  };
}

/** Read only the additive, document-scoped server contract. */
export function submissionFileFeedback(error: unknown): FileFeedback | null {
  if (!error || typeof error !== 'object') return null;
  const api = error as { status?: number; data?: unknown };
  const data = api.data as
    { field?: unknown; code?: unknown; message?: unknown; nextStep?: unknown } | undefined;
  if (data?.field === 'file' && typeof data.code === 'string' && codes.includes(data.code)) {
    return {
      passed: false,
      code: data.code,
      message: typeof data.message === 'string' ? data.message : 'The file could not be prepared.',
      nextStep:
        typeof data.nextStep === 'string' ? data.nextStep : 'Choose another file and try again.',
      retryable: data.code === 'CONVERSION_UNAVAILABLE',
      uncertain: data.code === 'UPLOAD_FAILED',
    };
  }
  if (api.status === 0 || (typeof api.status === 'number' && api.status >= 500)) {
    return {
      passed: false,
      message: 'The submission outcome could not be confirmed.',
      nextStep: 'Keep your file and settings. Check My Orders or Drafts before trying again.',
      uncertain: true,
    };
  }
  return null;
}
