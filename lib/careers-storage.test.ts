import { describe, expect, it } from 'vitest';
import { MAX_CV_BYTES, checkDocument, extensionOf } from './careers-storage';

const file = (name: string, type: string, size = 1024) => ({ name, size, type });

describe('checkDocument', () => {
  it('accepts a PDF and both Word formats', () => {
    expect(checkDocument(file('cv.pdf', 'application/pdf')).ok).toBe(true);
    expect(checkDocument(file('cv.doc', 'application/msword')).ok).toBe(true);
    expect(
      checkDocument(
        file('cv.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
      ).ok,
    ).toBe(true);
  });

  it('accepts octet-stream only when the extension is one of the three', () => {
    // Some clients send this for .doc, so refusing it outright rejects real
    // applicants; the extension is what keeps it narrow.
    expect(checkDocument(file('cv.doc', 'application/octet-stream')).ok).toBe(true);
    expect(checkDocument(file('cv.exe', 'application/octet-stream')).ok).toBe(false);
  });

  it('refuses a file whose extension does not match its declared type', () => {
    // The whole point of checking both: a .exe announcing itself as a PDF is
    // exactly the upload worth refusing.
    expect(checkDocument(file('payload.exe', 'application/pdf')).ok).toBe(false);
    expect(checkDocument(file('photo.png', 'image/png')).ok).toBe(false);
  });

  it('refuses an empty file and one over 5 MB', () => {
    expect(checkDocument(file('cv.pdf', 'application/pdf', 0)).ok).toBe(false);
    expect(checkDocument(file('cv.pdf', 'application/pdf', MAX_CV_BYTES + 1)).ok).toBe(false);
    expect(checkDocument(file('cv.pdf', 'application/pdf', MAX_CV_BYTES)).ok).toBe(true);
  });

  it('says what to do rather than that something went wrong', () => {
    const tooBig = checkDocument(file('cv.pdf', 'application/pdf', MAX_CV_BYTES + 1));
    expect(tooBig.ok).toBe(false);
    if (!tooBig.ok) expect(tooBig.message).toMatch(/under 5 MB/);
  });
});

describe('extensionOf', () => {
  it('lower-cases, and is empty when there is no extension', () => {
    expect(extensionOf('Rohan CV.PDF')).toBe('.pdf');
    expect(extensionOf('cv')).toBe('');
    // A dotted name must not turn its last segment into something else.
    expect(extensionOf('rohan.mehta.cv.docx')).toBe('.docx');
  });
});
