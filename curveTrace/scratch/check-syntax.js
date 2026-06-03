const code = require('fs').readFileSync('impl.html', 'utf8');
const idx = code.indexOf('type="module">');
const end = code.lastIndexOf('</script>');
const js = code.slice(idx + 'type="module">'.length, end);
try {
    new Function(js);
    console.log('✅ JS syntax OK');
} catch (e) {
    console.error('❌ Syntax error:', e.message);
}
