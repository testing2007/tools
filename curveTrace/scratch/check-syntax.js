const code = require('fs').readFileSync('impl.html', 'utf8');
const {spawnSync} = require('child_process');
const idx = code.indexOf('type="module">');
const end = code.lastIndexOf('</script>');
const js = code.slice(idx + 'type="module">'.length, end);
const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
    input: js,
    encoding: 'utf8'
});

if (result.status === 0) {
    console.log('JS module syntax OK');
} else {
    process.stderr.write(result.stderr || result.stdout || 'Syntax check failed\n');
    process.exit(result.status || 1);
}
