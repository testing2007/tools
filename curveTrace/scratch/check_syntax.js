const fs = require('fs');
const path = require('path');
const vm = require('vm');

const filePath = path.join(__dirname, '../impl.html');
const content = fs.readFileSync(filePath, 'utf8');

// Regex to find script blocks and check their attributes
const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
let match;
let count = 0;

console.log('Extracting and validating script blocks...');

while ((match = scriptRegex.exec(content)) !== null) {
    const attrs = match[1];
    let scriptCode = match[2];
    count++;

    // Skip importmap
    if (attrs.includes('type="importmap"') || attrs.includes("type='importmap'")) {
        console.log(`Script block ${count} is an importmap. Skipping syntax validation.`);
        continue;
    }

    // Strip all import statements (e.g. import ... from '...')
    scriptCode = scriptCode.replace(/import\s+[\s\S]+?from\s+['"].+?['"];?/g, (m) => {
        return m.split('\n').map(line => '// ' + line).join('\n');
    });

    try {
        // Compile code without running it to verify syntax
        new vm.Script(scriptCode, { filename: `impl.html#script[${count}]` });
        console.log(`Script block ${count} is syntactically valid.`);
    } catch (e) {
        console.error(`Syntax error in Script block ${count}:`);
        console.error(e.stack || e);
        process.exit(1);
    }
}

if (count === 0) {
    console.warn('No script blocks found in impl.html!');
} else {
    console.log('All script blocks are syntactically valid!');
}
