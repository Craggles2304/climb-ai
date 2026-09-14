const {contextBridge,ipcRenderer}=require('electron');

contextBridge.exposeInMainWorld('opCompanion',{
  getState:()=>ipcRenderer.invoke('companion:get-state'),
  pair:(payload)=>ipcRenderer.invoke('companion:pair',payload),
  unpair:()=>ipcRenderer.invoke('companion:unpair'),
  restart:()=>ipcRenderer.invoke('companion:restart'),
  setAutoStart:(enabled)=>ipcRenderer.invoke('companion:auto-start',enabled),
  openClimb:()=>ipcRenderer.invoke('companion:open-climb'),
  onState:(handler)=>{
    const listener=(_event,state)=>handler(state);
    ipcRenderer.on('companion:state',listener);
    return()=>ipcRenderer.removeListener('companion:state',listener);
  }
});
