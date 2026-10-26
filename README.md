# PDFWizard

Browser-side PDF tools maintained by Mateusz Sury: merge PDFs and PNG/JPEG
images, remove a selected page, export the first PDF page to an image or plain
text, and attempt lossless structural optimization.

```sh
python -m http.server 8000
# Open http://localhost:8000
```

Files are processed locally by the application. PDF libraries are fetched from
versioned public CDNs; internet access is required for those initial assets.
PDF-to-TXT is text extraction, not a Word document converter. Image/text exports
currently process the first page only. Lossless optimization preserves page
dimensions and metadata and keeps the original when no smaller result is found;
it does not downsample embedded images or promise a reduction for every PDF.

## Development checks

```sh
npm ci
npm test
node --check scripts.js
```

Tests use the real pdf-lib engine for merging, image embedding, page removal and
lossless optimization. The TXT UI path uses a text-extraction stub; tests do not
claim browser canvas rendering or full PDF.js compatibility. Retain document
backups and verify output before replacing an original file.

Original code is MIT licensed. pdf-lib, PDF.js and download.js retain their own
licenses; third-party dependencies are not attributed to the maintainer.
