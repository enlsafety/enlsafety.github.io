'use strict';
const assert=require('node:assert/strict');require('../safety-card-model.js');const m=ENLSafetyCardModel,l=m.layout,cells=l.cells;
assert.equal(cells.length,new Set(cells.map(c=>c.key)).size,'each original cell appears once');
for(const key of [...Object.keys(m.template.fields),'P32'])assert.equal(cells.filter(c=>c.key===key).length,1,key+' remains visible and editable');
for(let row=1;row<=l.heights.length;row++){
 const occupied=new Set();for(const c of cells.filter(c=>c.row===row))for(let col=c.col;col<c.col+c.cols;col++){assert.ok(col>=1&&col<=16);assert.ok(!occupied.has(col),'overlap at '+row+','+col);occupied.add(col);}
}
const cell=k=>cells.find(c=>c.key===k);
assert.equal(cell('B12').row,cell('B21').row);assert.equal(cell('B21').col,9);assert.equal(cell('J12').cols,16);assert.ok(cell('J12').row>cell('B27').row);
for(const k of ['M16','M17','M18'])assert.equal(cell(k).cols,9);
for(const k of ['J21','B28','B35'])assert.equal(cell(k).cols,16,'independent section '+k);
console.log('PASS all fields retained, no overlaps, agency beside organization, full-width incident/document/capability/improvement sections');
