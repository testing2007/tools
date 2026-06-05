const fs = require('fs');
const content = fs.readFileSync('libs/opencv.js', 'utf8');

// The key question: where is cv.Mat defined?
// We know cv is the outer async function variable (char 705)
// matFromArray uses cv.Mat - so cv.Mat must be set somewhere

// Strategy: Find all assignments to cv that include Mat
// Pattern: something assigns something to cv related to Mat

// Search for any pattern where Mat is assigned via cv
const pats = [
    'cv.Mat',
    'cv["Mat"]',
    "cv['Mat']",
];

pats.forEach(pat => {
    let idx = 0;
    let count = 0;
    while ((idx = content.indexOf(pat, idx)) >= 0 && count < 10) {
        const ctx = content.substring(Math.max(0, idx-30), idx+150);
        console.log('--- "' + pat + '" at', idx, '---');
        console.log(ctx);
        idx++;
        count++;
    }
    if (count === 0) console.log('NOT FOUND:', pat);
});

// Check the very end of the file - maybe Mat is assigned there
const last20k = content.substring(content.length - 20000);
console.log('\n--- Last 1000 chars of file ---');
console.log(content.substring(content.length - 1000));

// Check the UMD wrapper pattern - does the factory call cv()?  
console.log('\n--- First 1000 chars of file ---');
console.log(content.substring(0, 1000));
