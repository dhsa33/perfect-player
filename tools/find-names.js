const fs = require('fs');
const src = fs.readFileSync('assets/js/hupu/legend-era/era-historical-births.js','utf8');

for (const name of ['Ricky Pierce', 'Cedric Ceballos', 'Nene Hilario', 'Nene']) {
  const search = '"' + name + '"';
  const idx = src.indexOf(search);
  if (idx !== -1) {
    console.log(name + ': ' + src.slice(idx, idx + 40));
  } else {
    console.log(name + ': NOT FOUND');
  }
}
