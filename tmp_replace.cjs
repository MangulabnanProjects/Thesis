const fs = require('fs');
const path = require('path');

const dirPath = 'd:/web4/src-mobile';
const appJsPath = 'd:/web4/App.js';

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let newContent = content.replace(/#6C63FF/gi, '#4CAF50')
                           .replace(/#EEEDFF/gi, '#E8F5E9')
                           .replace(/#F0EEFF/gi, '#E8F5E9');
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent);
    console.log('Replaced in', filePath);
  }
}

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      processDir(p);
    } else if (p.endsWith('.js')) {
      replaceInFile(p);
    }
  }
}

processDir(dirPath);
replaceInFile(appJsPath);
console.log('Done');
