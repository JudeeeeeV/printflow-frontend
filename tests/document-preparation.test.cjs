const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const pdfLib = require('pdf-lib');

function load(file, mocks = {}, globals = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, File, Error, ...globals, require(name) {
    if (name in mocks) return mocks[name];
    throw new Error(`Unexpected import ${name}`);
  } });
  return exports;
}
function preparation(options = {}) {
  const urls = [], released = [];
  const module = load('services/documentPreparation.ts', { 'pdf-lib': options.pdf || pdfLib }, {
    URL: { createObjectURL: () => { const url = `blob:${urls.length}`; urls.push(url); return url; }, revokeObjectURL: url => released.push(url) },
    Image: class {
      naturalWidth = options.imageInvalid ? 0 : 30;
      naturalHeight = options.imageInvalid ? 0 : 20;
      set src(value) { queueMicrotask(() => options.imageError ? this.onerror() : this.onload()); }
    },
  });
  return { ...module, urls, released };
}
async function pdfFile(name = 'source.pdf', type = 'application/pdf', pages = 2) {
  const document = await pdfLib.PDFDocument.create();
  for (let i = 0; i < pages; i++) document.addPage([400, 800]);
  return new File([await document.save({ addDefaultPage: false })], name, { type, lastModified: 123 });
}

test('PDF checks use actual readable pages and normalize generic browser MIME without changing source metadata', async () => {
  const p = preparation();
  for (const type of ['application/pdf', '', 'application/octet-stream']) {
    const source = await pdfFile('Original.PDF', type);
    const result = await p.prepareDocument(source);
    assert.equal(result.file.name, 'Original.PDF'); assert.equal(result.file.lastModified,123);
    assert.equal(result.file.type,'application/pdf'); assert.equal(result.pageCount,2);
    assert.equal(result.feedback.passed,true); assert.match(result.feedback.message,/server will validate/);
    if (type === 'application/pdf') assert.equal(result.file,source);
  }
});
test('supported images and DOCX stay within existing formats without claiming DPI or server validation', async () => {
  const p = preparation();
  for (const [extension, mime] of [['PNG','image/png'],['jpg','image/jpeg'],['jpeg','image/jpeg'],['WEBP','image/webp'],['DOCX',p.DOCX_MIME_TYPE]]) {
    const result = await p.prepareDocument(new File(['fixture'],`source.${extension}`,{type:mime}));
    assert.equal(result.feedback.passed,true); assert.equal(result.pageCount,1);
    assert.doesNotMatch(result.feedback.message,/300|DPI|Print-Ready/);
    if (extension === 'DOCX') assert.match(result.feedback.message,/validate, convert, and count/);
  }
  assert.deepEqual(p.released,p.urls);
});
test('unsupported content, MIME mismatches and empty files offer explicit replacement guidance', async () => {
  const p = preparation();
  for (const file of [new File(['x'],'bad.txt'),new File(['x'],'spoof.pdf',{type:'text/html'}),new File(['x'],'file'),new File(['x'],'pdf',{type:'application/pdf'}),new File(['x'],'bad.__proto__'),new File(['x'],'bad.constructor')]) {
    const result = await p.prepareDocument(file); assert.equal(result.code,'UNSUPPORTED_FILE'); assert.ok(result.nextStep);
  }
  assert.equal((await p.prepareDocument(new File([],'empty.pdf',{type:'application/pdf'}))).code,'EMPTY_FILE');
});
test('20 MB bounds accept the boundary and reject a larger selection before decoding', async () => {
  const p = preparation();
  for (const size of [p.MAX_DOCUMENT_BYTES-1,p.MAX_DOCUMENT_BYTES,p.MAX_DOCUMENT_BYTES+1]) {
    const file = new File(['fixture'],'source.docx',{type:p.DOCX_MIME_TYPE});
    Object.defineProperty(file,'size',{value:size});
    const result = await p.prepareDocument(file);
    if (size > p.MAX_DOCUMENT_BYTES) assert.equal(result.code,'FILE_TOO_LARGE');
    else assert.equal(result.feedback.passed,true);
  }
});
test('malformed, zero-page and detected protected PDFs do not become ready', async () => {
  const p = preparation();
  for (const file of [new File(['%PDF-broken'],'bad.pdf',{type:'application/pdf'}),await pdfFile('empty.pdf','application/pdf',0)]) {
    const result = await p.prepareDocument(file); assert.equal(result.code,'UNREADABLE_FILE'); assert.ok(result.nextStep);
  }
  const protectedPdf = await pdfLib.PDFDocument.create();
  protectedPdf.addPage();
  protectedPdf.context.trailerInfo.Encrypt = protectedPdf.context.obj({ Filter:'Standard' });
  const result = await p.prepareDocument(new File([await protectedPdf.save()], 'protected.pdf', {type:'application/pdf'}));
  assert.match(result.message,/password-protected/); assert.match(result.nextStep,/Unlock/);
});
test('image read failures and zero dimensions release every temporary URL', async () => {
  for (const options of [{imageInvalid:true},{imageError:true}]) {
    const p = preparation(options);
    const result = await p.prepareDocument(new File(['broken'],'source.png',{type:'image/png'}));
    assert.equal(result.code,'UNREADABLE_FILE'); assert.deepEqual(p.released,p.urls);
  }
});
test('server file errors distinguish replacement, explicit retry, and uncertain outcomes', () => {
  const p = preparation();
  for (const code of ['UNSUPPORTED_FILE','EMPTY_FILE','FILE_TOO_LARGE','UNREADABLE_FILE','FILE_LIMIT_EXCEEDED','DRAFT_FILE_UNAVAILABLE','CONVERSION_UNAVAILABLE','UPLOAD_FAILED']) {
    const feedback = p.submissionFileFeedback({status:400,data:{field:'file',code,message:'Problem',nextStep:'Action'}});
    assert.equal(feedback.message,'Problem'); assert.equal(feedback.nextStep,'Action');
    assert.equal(feedback.retryable,code === 'CONVERSION_UNAVAILABLE');
    assert.equal(feedback.uncertain,code === 'UPLOAD_FAILED');
  }
  for (const status of [0,500,503]) assert.equal(p.submissionFileFeedback({status}).uncertain,true);
  for (const status of [400,401,403,409]) assert.equal(p.submissionFileFeedback({status,data:{message:'Form error'}}),null);
  assert.equal(p.submissionFileFeedback({status:400,data:{field:'receipt',code:'UNREADABLE_FILE'}}),null);
});

const jsx = (type, props) => ({type,props});
const runtime = {jsx,jsxs:jsx};
const nodes = tree => !tree || typeof tree !== 'object' ? [] : [tree,...[tree.props?.children].flat().flatMap(nodes)];
test('upload input supports same-file reselection, replacement during checking, and pending submission controls', () => {
  let calls = 0;
  const react = {useState: value => [value,()=>{}],useRef: () => ({current:null})};
  const {FileUploadZone} = load('components/orders/FileUploadZone/FileUploadZone.tsx', {
    react, 'react/jsx-runtime':runtime, '@carbon/icons-react':{CloudUpload:()=>null}, '../FileFeedback':{FileFeedback:()=>null},
  });
  for (const disabled of [false,true]) {
    const tree = FileUploadZone({disabled,isValidating:true,validationResult:null,onFileSelect:()=>calls++,onRemoveFile:()=>{}});
    const input = nodes(tree).find(node => node.type === 'input');
    const target = {value:'previous.pdf'}; input.props.onClick({target}); assert.equal(target.value,'');
    assert.equal(input.props.disabled,disabled);
    input.props.onChange({target:{files:[new File(['x'],'source.pdf')]}});
    nodes(tree).find(node=>node.props.onDrop).props.onDrop({preventDefault(){},dataTransfer:{files:[new File(['y'],'source.pdf')]}});
    assert.equal(calls,2);
    for (const button of nodes(tree).filter(node=>node.type==='button')) assert.equal(button.props.disabled,disabled);
    assert.ok(nodes(tree).some(node=>node.props.role==='status'));
  }
});
test('feedback provides an alert, focus guidance and correctly labeled explicit recovery actions', () => {
  const effects=[];
  const react={useRef:()=>({current:{focus:()=>effects.push('focused')}}),useEffect:callback=>callback()};
  const {FileFeedback} = load('components/orders/FileFeedback.tsx', {react,'react/jsx-runtime':runtime});
  const tree=FileFeedback({focusOnError:true,feedback:{passed:false,message:'Problem',nextStep:'Action',uncertain:true},onCheckOrders:()=>effects.push('open'),checkLabel:'Open saved order'});
  assert.equal(tree.props.role,'alert'); assert.equal(tree.props.tabIndex,-1); assert.deepEqual(effects,['focused']);
  const buttons=nodes(tree).filter(node=>node.type==='button');
  assert.equal(buttons.length,1); assert.equal(buttons[0].props.children,'Open saved order');
  buttons[0].props.onClick(); assert.deepEqual(effects,['focused','open']);
});
