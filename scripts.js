const mergeFileInput = document.getElementById('merge-file-input');
const mergeFileList = document.getElementById('merge-file-list');
const mergeButton = document.getElementById('merge-button');
const removeFileInput = document.getElementById('remove-file-input');
const pdfInfo = document.getElementById('pdf-info');
const pageToRemoveInput = document.getElementById('page-to-remove');
const removePageButton = document.getElementById('remove-page-button');
const convertFileInput = document.getElementById('convert-file-input');
const convertFormatSelect = document.getElementById('convert-format');
const convertButton = document.getElementById('convert-button');
const compressFileInput = document.getElementById('compress-file-input');
const compressLevelSelect = document.getElementById('compress-level');
const compressButton = document.getElementById('compress-button');
const errorMessage = document.getElementById('error-message');
let mergeFiles = [];
let removePdfFile = null;
let convertPdfFile = null;
let compressPdfFile = null;

if (mergeFileInput) {
    mergeFileInput.addEventListener('change', (e) => {
        mergeFiles = Array.from(e.target.files);
        updateMergeFileList();
    });
}

if (removeFileInput) {
    removeFileInput.addEventListener('change', async (e) => {
        removePdfFile = e.target.files[0];
        await updatePdfInfo();
    });
}

if (convertFileInput) {
    convertFileInput.addEventListener('change', (e) => {
        convertPdfFile = e.target.files[0];
        convertButton.disabled = !convertPdfFile;
    });
}

if (compressFileInput) {
    compressFileInput.addEventListener('change', (e) => {
        compressPdfFile = e.target.files[0];
        compressButton.disabled = !compressPdfFile;
    });
}

if (mergeButton) {
    mergeButton.addEventListener('click', mergePDFs);
}

if (removePageButton) {
    removePageButton.addEventListener('click', removePageFromPDF);
}

if (convertButton) {
    convertButton.addEventListener('click', convertPDF);
}

if (compressButton) {
    compressButton.addEventListener('click', compressPDF);
}

function updateMergeFileList() {
    mergeFileList.innerHTML = '';
    mergeFiles.forEach(file => {
        const li = document.createElement('li');
        li.textContent = file.name;
        mergeFileList.appendChild(li);
    });
    mergeButton.disabled = mergeFiles.length < 2;
    errorMessage.textContent = '';
}

async function updatePdfInfo() {
    try {
        const arrayBuffer = await removePdfFile.arrayBuffer();
        const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
        const pageCount = pdf.getPageCount();
        pdfInfo.textContent = `Number of pages in file: ${pageCount}`;
        pageToRemoveInput.max = pageCount;
        removePageButton.disabled = false;
    } catch (error) {
        console.error('Error loading PDF:', error);
        pdfInfo.textContent = 'Error loading PDF file.';
        removePageButton.disabled = true;
    }
}

async function mergePDFs() {
    try {
        errorMessage.textContent = '';
        const pdfDoc = await PDFLib.PDFDocument.create();

        for (const file of mergeFiles) {
            if (file.type === 'application/pdf') {
                const pdfBytes = await file.arrayBuffer();
                const pdf = await PDFLib.PDFDocument.load(pdfBytes);
                const copiedPages = await pdfDoc.copyPages(pdf, pdf.getPageIndices());
                copiedPages.forEach((page) => pdfDoc.addPage(page));
            } else if (file.type.startsWith('image/')) {
                const imageBytes = await file.arrayBuffer();
                let image;
                if (file.type === 'image/jpeg') {
                    image = await pdfDoc.embedJpg(imageBytes);
                } else if (file.type === 'image/png') {
                    image = await pdfDoc.embedPng(imageBytes);
                }
                const { width, height } = image.scale(1);
                const page = pdfDoc.addPage([width, height]);
                page.drawImage(image, {
                    x: 0,
                    y: 0,
                    width: width,
                    height: height,
                });
            }
        }

        const pdfBytes = await pdfDoc.save();
        download(pdfBytes, "merged_document.pdf", "application/pdf");
    } catch (error) {
        console.error('Error:', error);
        errorMessage.textContent = 'An error occurred while merging files. Please try again.';
    }
}

async function removePageFromPDF() {
    try {
        errorMessage.textContent = '';
        const pageToRemove = parseInt(pageToRemoveInput.value);
        if (isNaN(pageToRemove) || pageToRemove < 1) {
            throw new Error('Invalid page number');
        }

        const arrayBuffer = await removePdfFile.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
        const pageCount = pdfDoc.getPageCount();

        if (pageToRemove > pageCount) {
            throw new Error('Page number exceeds the number of pages in the document');
        }

        pdfDoc.removePage(pageToRemove - 1);

        const pdfBytes = await pdfDoc.save();
        download(pdfBytes, "document_with_removed_page.pdf", "application/pdf");
    } catch (error) {
        console.error('Error:', error);
        errorMessage.textContent = `Error: ${error.message}`;
    }
}

async function convertPDF() {
    try {
        errorMessage.textContent = '';
        const format = convertFormatSelect.value;
        const arrayBuffer = await convertPdfFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
        const page = await pdf.getPage(1);
        const scale = 1.5;
        const viewport = page.getViewport({scale: scale});
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({canvasContext: context, viewport: viewport}).promise;

        let result;
        if (format === 'jpg' || format === 'png') {
            result = canvas.toDataURL(`image/${format}`);
            download(result, `converted_document.${format}`, `image/${format}`);
        } else if (format === 'doc') {
            const textContent = await page.getTextContent();
            const text = textContent.items.map(item => item.str).join(' ');
            const blob = new Blob([text], {type: 'text/plain'});
            download(blob, "converted_document.txt", "text/plain");
        }
    } catch (error) {
        console.error('Error:', error);
        errorMessage.textContent = 'An error occurred while converting the file. Please try again.';
    }
}

async function compressPDF() {
    try {
        errorMessage.textContent = '';
        const level = compressLevelSelect.value;
        const arrayBuffer = await compressPdfFile.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);

        pdfDoc.setTitle('');
        pdfDoc.setAuthor('');
        pdfDoc.setSubject('');
        pdfDoc.setKeywords([]);
        pdfDoc.setProducer('');
        pdfDoc.setCreator('');

        let compressionFactor;
        switch (level) {
            case 'low':
                compressionFactor = 0.9;
                break;
            case 'medium':
                compressionFactor = 0.7;
                break;
            case 'high':
                compressionFactor = 0.5;
                break;
            default:
                compressionFactor = 0.8;
        }

        const pages = pdfDoc.getPages();
        for (const page of pages) {
            const { width, height } = page.getSize();
            page.setSize(width * compressionFactor, height * compressionFactor);
        }

        const pdfBytes = await pdfDoc.save();
        download(pdfBytes, "compressed_document.pdf", "application/pdf");

        const originalSize = arrayBuffer.byteLength;
        const compressedSize = pdfBytes.byteLength;
        const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);

        errorMessage.textContent = `File compressed. Size reduction: ${compressionRatio}%`;
    } catch (error) {
        console.error('Error:', error);
        errorMessage.textContent = 'An error occurred while compressing the file. Please try again.';
    }
}
