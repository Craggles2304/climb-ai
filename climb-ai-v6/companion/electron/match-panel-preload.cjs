const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('matchPanel',{
  getState:()=>ipcRenderer.invoke('companion:get-state'),
  markMoment:()=>ipcRenderer.invoke('companion:mark-moment'),
  openMain:()=>ipcRenderer.invoke('companion:open-main'),
  onState:handler=>{const listener=(_event,state)=>handler(state);ipcRenderer.on('companion:state',listener);return()=>ipcRenderer.removeListener('companion:state',listener)}
});

