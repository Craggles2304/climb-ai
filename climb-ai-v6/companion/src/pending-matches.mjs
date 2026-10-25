import {existsSync,readFileSync,writeFileSync,renameSync} from 'node:fs';

// Keep every unacknowledged game across restarts. Older installations stored
// just one envelope here, which the next game could overwrite before upload.
export function pendingMatchStore(file){
  const read=()=>{
    if(!file||!existsSync(file))return[];
    const saved=JSON.parse(readFileSync(file,'utf8'));
    return (Array.isArray(saved)?saved:[saved]).filter(e=>e?.type==='FINAL'&&e.clientSessionId&&e.snapshots?.length);
  };
  const write=rows=>{
    if(!file)return;
    const temp=file+'.tmp';
    writeFileSync(temp,JSON.stringify(rows),'utf8');
    renameSync(temp,file);
  };
  return {
    read,
    save(envelope){const rows=read().filter(e=>e.clientSessionId!==envelope.clientSessionId);write([...rows,envelope]);},
    acknowledge(id){write(read().filter(e=>e.clientSessionId!==id));},
  };
}
