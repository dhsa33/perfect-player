const fs = require('fs');
const s = fs.readFileSync('assets/js/hupu/legend-era/era-historical-births.js','utf8');
const lines = s.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Cedric') || lines[i].includes('Ceballos'))
    console.log((i+1) + ': ' + lines[i]);
  if (lines[i].includes('"Nene"'))
    console.log((i+1) + ': ' + lines[i]);
  if (lines[i].includes('Ricky'))
    console.log((i+1) + ': ' + lines[i]);
}
