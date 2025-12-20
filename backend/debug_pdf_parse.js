const pdf = require('pdf-parse');
console.log('Type of pdf:', typeof pdf);
console.log('Is pdf a function?', typeof pdf === 'function');
console.log('Exports:', pdf);

const fs = require('fs');
const path = require('path');

// Create a dummy PDF buffer (empty) just to check if function call works, 
// though it might fail on parsing, we just want to see if it's callable.
// Better: try to read a real file if possible, or just check the export.

if (typeof pdf !== 'function') {
    console.error('ERROR: pdf-parse did not export a function');
} else {
    console.log('SUCCESS: pdf-parse exported a function');
}
