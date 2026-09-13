import type {MetadataRoute} from 'next';

export default function manifest():MetadataRoute.Manifest{
  return {
    name:'OP CLIMB',
    short_name:'OP CLIMB',
    description:'Personal League of Legends coaching built from your own match evidence.',
    start_url:'/',
    display:'standalone',
    background_color:'#050a12',
    theme_color:'#050a12',
    icons:[
      {src:'/favicon.ico',sizes:'64x64',type:'image/x-icon'},
      {src:'/brand/overpowered-crest.png',sizes:'512x512',type:'image/png'},
    ],
  };
}
