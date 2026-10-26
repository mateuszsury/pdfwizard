const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const PDFLib = require('pdf-lib');

function app() {
  const nodes = new Map();
  const document = {
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, {value: '', textContent: '', addEventListener(){}, appendChild(){}});
      return nodes.get(id);
    },
    addEventListener(){}, createElement(){ return {getContext(){ return {}; }}; },
  };
  const downloads = [];
  const pdfjs = {GlobalWorkerOptions: {}, getDocument(){ return {promise: Promise.resolve({
    getPage: async () => ({getTextContent: async () => ({items: [{str:'Hello'}, {str:'PDF'}]})})
  })}; }};
  const source = fs.readFileSync('scripts.js','utf8');
  const factory = new Function('document','PDFLib','Blob','pdfjsLib','download','console', source + `
    return {
      merge(files) { mergeFiles = files; return mergePDFs(); },
      remove(file) { removePdfFile = file; return removePageFromPDF(); },
      optimize(file) { compressPdfFile = file; return compressPDF(); },
      convert(file) { convertPdfFile = file; return convertPDF(); }
    };`);
  const ctx = factory(document, PDFLib, Blob, pdfjs, (...args)=>downloads.push(args), {error(){}});
  return {ctx, nodes, downloads};
}
function file(bytes, type='application/pdf') {
  return {type, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)};
}
async function pdf(pages) {
  const doc = await PDFLib.PDFDocument.create();
  for (const size of pages) doc.addPage(size);
  doc.setAuthor('Original document author');
  return doc.save({useObjectStreams:false});
}
test('merge preserves all pages from both documents', async () => {
  const a = app();
  await a.ctx.merge([file(await pdf([[200,300]])), file(await pdf([[400,500]]))]);
  assert.equal(a.downloads.length, 1);
  const result = await PDFLib.PDFDocument.load(a.downloads[0][0]);
  assert.equal(result.getPageCount(), 2);
});
test('single PNG becomes a PDF page', async () => {
  const a = app();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG14AAAAASUVORK5CYII=', 'base64');
  await a.ctx.merge([file(png, 'image/png')]);
  assert.equal(a.downloads.length, 1);
  assert.equal((await PDFLib.PDFDocument.load(a.downloads[0][0])).getPageCount(), 1);
});
test('remove selects the requested page and rejects an out-of-range index', async () => {
  const a=app(), input = file(await pdf([[200,300],[400,500]]));
  a.nodes.get('page-to-remove').value = '2';
  await a.ctx.remove(input);
  const result = await PDFLib.PDFDocument.load(a.downloads[0][0]);
  assert.deepEqual(result.getPages()[0].getSize(), {width:200,height:300});
  a.nodes.get('page-to-remove').value='9';
  await a.ctx.remove(input);
  assert.equal(a.downloads.length,1);
  assert.match(a.nodes.get('error-message').textContent,/exceeds/);
});
test('optimization never crops pages, strips author metadata or increases file size',async()=>{
  const a=app(), original=await pdf([[200,300],[400,500]]);
  await a.ctx.optimize(file(original));
  const bytes=a.downloads[0][0], result=await PDFLib.PDFDocument.load(bytes,{updateMetadata:false});
  assert.ok(bytes.byteLength <= original.byteLength);
  assert.equal(result.getAuthor(),'Original document author');
  assert.deepEqual(result.getPages().map(p=>p.getSize()),[{width:200,height:300},{width:400,height:500}]);
});
test('plain-text conversion is labelled TXT and uses extracted text',async()=>{
  const a=app(), input=file(await pdf([[200,300]]));
  a.nodes.get('convert-format').value='txt';
  await a.ctx.convert(input);
  assert.equal(a.downloads[0][1],'converted_document.txt');
  assert.equal(await a.downloads[0][0].text(),'Hello PDF');
});
