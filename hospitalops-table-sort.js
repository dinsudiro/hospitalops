const collator=new Intl.Collator('id-ID',{numeric:true,sensitivity:'base'});
const months={jan:1,januari:1,feb:2,februari:2,mar:3,maret:3,apr:4,april:4,mei:5,jun:6,juni:6,jul:7,juli:7,agu:8,agt:8,agustus:8,sep:9,september:9,okt:10,oktober:10,nov:11,nop:11,november:11,des:12,desember:12};
function sortValue(value){
 if(value===null||value===undefined||String(value).trim()===''||/^[-–—]$/.test(String(value).trim()))return null;
 if(typeof value==='number')return Number.isFinite(value)?value:null;
 const text=String(value).trim(),month=text.match(/^([a-z]+)\s*(\d{4})$/i),date=text.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/i);
 if(month&&months[month[1].toLowerCase()])return Number(month[2])*10000+months[month[1].toLowerCase()]*100;
 if(date&&months[date[2].toLowerCase()])return Number(date[3])*10000+months[date[2].toLowerCase()]*100+Number(date[1]);
 if(/^\d{4}-\d{2}-\d{2}$/.test(text))return Number(text.replaceAll('-',''));
 const numeric=text.replace(/^Rp\s*/i,'').replace(/%$/,'').replace(/\s/g,'');
 if(/^-?\d+(?:[.,]\d+)*$/.test(numeric)){
  const n=Number(numeric.includes(',')?numeric.replaceAll('.','').replace(',','.'): /^-?\d{1,3}(\.\d{3})+$/.test(numeric)?numeric.replaceAll('.',''):numeric);
  if(Number.isFinite(n))return n;
 }
 return text;
}
export function compareSortValues(a,b,descending=false){
 const left=sortValue(a),right=sortValue(b);
 if(left===null||right===null)return left===right?0:left===null?1:-1;
 const delta=typeof left==='number'&&typeof right==='number'?left-right:collator.compare(String(left),String(right));
 return descending?-delta:delta;
}
function cellValue(cell){
 if(!cell)return '';
 if(cell.dataset.sortValue!==undefined)return cell.dataset.sortValue;
 const controls=[...cell.querySelectorAll('input,select,textarea')];
 if(controls.length)return controls.map(c=>c.type==='checkbox'?(c.checked?(c.value==='on'?'1':c.value):''):c.tagName==='SELECT'?c.selectedOptions[0]?.textContent||'':c.value).join(' ');
 return cell.textContent.trim();
}
export function installTableSorting({context,customSort,scope}){
 const states=new Map();let lastScope=scope?.();
 function key(table){
  if(table.dataset.sortKey)return table.dataset.sortKey;
  const slot=table.closest('[id]')?.id||'',dialog=table.closest('dialog')?.querySelector('h2')?.textContent||'',panel=table.closest('.panel')?.querySelector('h2,h3')?.textContent||'';
  table.dataset.sortKey=JSON.stringify([context(),slot,dialog,panel,[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim())]);return table.dataset.sortKey;
 }
 function apply(table,state){
  for(const th of table.querySelectorAll('thead th')){
   const button=th.querySelector('[data-table-sort]');if(!button)continue;
   const selected=Number(button.dataset.tableSort)===state?.column;
   th.setAttribute('aria-sort',selected?(state.descending?'descending':'ascending'):'none');
   const direction=button.querySelector('.sort-direction'),next=selected?(state.descending?' (turun)':' (naik)'):'';if(direction.textContent!==next)direction.textContent=next;
  }
  if(!state||table.closest('#patients-results,#directory-results,#partner-detail-results'))return;
  const marker=state.column+':'+state.descending;if(table.dataset.sortApplied===marker)return;table.dataset.sortApplied=marker;
  for(const body of table.tBodies){
   const rows=[...body.rows];if(rows.some(r=>r.cells.length===1&&r.cells[0].colSpan>1))continue;
   rows.sort((a,b)=>compareSortValues(cellValue(a.cells[state.column]),cellValue(b.cells[state.column]),state.descending));
   body.append(...rows);
  }
 }
 function enhance(){
  if(scope&&lastScope!==scope()){lastScope=scope();states.clear()}
  for(const table of document.querySelectorAll('table')){
   if(!table.tHead||table.closest('[data-no-table-sort]'))continue;
   const tableKey=key(table);
   [...table.tHead.rows[0]?.cells||[]].forEach((th,index)=>{
    if(th.dataset.sortReady||th.querySelector('button,input')||/^(aksi|profil|pilih)$/i.test(th.textContent.trim()))return;
    th.dataset.sortReady='true';th.scope='col';
    const name=th.textContent.trim(),button=document.createElement('button');button.type='button';button.className='table-sort-button';button.dataset.tableSort=String(index);button.setAttribute('aria-label','Urutkan berdasarkan '+name);button.title='Klik untuk mengurutkan naik atau turun';button.append(document.createTextNode(name));
    const direction=document.createElement('span');direction.className='sort-direction';direction.setAttribute('aria-hidden','true');button.append(direction);th.replaceChildren(button);
   });
   apply(table,states.get(tableKey));
  }
 }
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-table-sort]');if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();
  const table=button.closest('table'),tableKey=key(table),column=Number(button.dataset.tableSort),old=states.get(tableKey),state={column,descending:old?.column===column?!old.descending:false};states.set(tableKey,state);
  const scrollLeft=table.closest('.tablewrap')?.scrollLeft||0;
  if(customSort(table,column,state.descending)){enhance();const next=[...document.querySelectorAll('table')].find(t=>t.dataset.sortKey===tableKey);next?.querySelector('[data-table-sort="'+column+'"]')?.focus({preventScroll:true});if(next?.closest('.tablewrap'))next.closest('.tablewrap').scrollLeft=scrollLeft;return}
  delete table.dataset.sortApplied;apply(table,state);
 },true);
 const observer=new MutationObserver(enhance);observer.observe(document.body,{childList:true,subtree:true});enhance();
}
