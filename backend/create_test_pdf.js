const PDFDocument = require('pdfkit');
const fs = require('fs');

const doc = new PDFDocument();
doc.pipe(fs.createWriteStream('test.pdf'));

doc.fontSize(25).text('Test Invoice', 100, 100);
doc.text('Supplier: TEST SUPPLIER');
doc.text('No. POP 123');

doc.end();
console.log('PDF created');
