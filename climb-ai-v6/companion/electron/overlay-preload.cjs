'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('opOverlay',{
  getState:()=>ipcRenderer.invoke('overlay:get-state'),
  saveLayout:layout=>ipcRenderer.invoke('overlay:save-layout',layout),
  finishEditing:()=>ipcRenderer.invoke('overlay:finish-edit'),
  onState:callback=>{const listener=(_event,payload)=>callback(payload);ipcRenderer.on('overlay:state',listener);return()=>ipcRenderer.removeListener('overlay:state',listener)},
});
