const fs = require('fs');
const path = require('path');

const excludeDirs = ['node_modules', 'dist', '.git', 'tally-agent'];
const excludeFiles = ['package-lock.json'];

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            if (!excludeDirs.includes(file)) {
                results = results.concat(walk(fullPath));
            }
        } else {
            if (!excludeFiles.includes(file)) {
                results.push(fullPath);
            }
        }
    });
    return results;
}

const files = walk(path.join(__dirname, '..'));

files.forEach(file => {
    if (!file.match(/\.(js|cjs|ts|tsx)$/)) return;

    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    content = content.replace(/pankaj@photobill\.com/g, 'pankaj@tallySync.com');

    if (content !== original) {
        console.log('Reverted email in: ' + file);
        fs.writeFileSync(file, content, 'utf8');
    }
});
