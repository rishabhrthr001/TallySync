const fs = require('fs');
const path = require('path');

const excludeDirs = ['node_modules', 'dist', '.git', 'tally-agent'];
const excludeFiles = ['package-lock.json']; // Don't break lockfiles

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
    // Only process text files (skip zip, log, etc)
    if (!file.match(/\.(js|cjs|ts|tsx|html|json|md|env|example)$/)) return;

    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // 1. URLs and specific strings first
    content = content.replace(/app\.photobill\.com/g, 'app.photobill.com');
    content = content.replace(/photoBill\.com/g, 'photobill.com');
    content = content.replace(/photobill\.com/g, 'photobill.com');
    content = content.replace(/PhotoBill/g, 'PhotoBill');
    
    // 2. We must carefully skip cloud run URLs and mongodb URLs
    // We will temporarily mask them
    const urlMatches = [];
    content = content.replace(/tallysync-backend[^\s"']*/g, (match) => {
        urlMatches.push(match);
        return `__URL_MASK_${urlMatches.length - 1}__`;
    });
    content = content.replace(/tallysync-frontend[^\s"']*/g, (match) => {
        urlMatches.push(match);
        return `__URL_MASK_${urlMatches.length - 1}__`;
    });
    content = content.replace(/mongodb:\/\/[^\s"']*/g, (match) => {
        urlMatches.push(match);
        return `__URL_MASK_${urlMatches.length - 1}__`;
    });
    // Also mask package names tallysync-frontend, tallysync-backend, tallysync-root
    content = content.replace(/tallysync-frontend/g, (match) => {
        urlMatches.push(match);
        return `__URL_MASK_${urlMatches.length - 1}__`;
    });
    content = content.replace(/tallysync-backend/g, (match) => {
        urlMatches.push(match);
        return `__URL_MASK_${urlMatches.length - 1}__`;
    });
    content = content.replace(/tallysync-root/g, (match) => {
        urlMatches.push(match);
        return `__URL_MASK_${urlMatches.length - 1}__`;
    });

    // 3. Replace the rest
    content = content.replace(/PhotoBill/g, 'PhotoBill');
    content = content.replace(/photoBill/g, 'photoBill');
    content = content.replace(/photobill/g, 'photobill');

    // 4. Unmask URLs
    urlMatches.forEach((match, i) => {
        content = content.replace(`__URL_MASK_${i}__`, match);
    });

    if (content !== original) {
        console.log('Updated: ' + file);
        fs.writeFileSync(file, content, 'utf8');
    }
});
