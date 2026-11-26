// Shared shell interaction contract: ELMOS master app.js toggleSettings.
 // Keep SSC-specific settings and onOpen callbacks outside this controller.
export function installSettingsPanel({panel,trigger,root=document,onOpen=()=>{}}){
 if(!panel||!trigger)throw Error('Settings panel and trigger required.');
 const setOpen=(open,{focus=false}={})=>{panel.hidden=!open;trigger.setAttribute('aria-expanded',String(open));if(open)onOpen();else if(focus)trigger.focus();};
 const toggle=()=>setOpen(panel.hidden);
 const outside=event=>{if(!panel.hidden&&!panel.contains(event.target)&&!trigger.contains(event.target))setOpen(false);};
 const keyboard=event=>{if(event.key==='Escape'&&!panel.hidden){setOpen(false,{focus:true});event.preventDefault();}};
 trigger.addEventListener('click',toggle);
 root.addEventListener('click',outside,true);
 root.addEventListener('keydown',keyboard);
 setOpen(!panel.hidden);
 return {open:()=>setOpen(true),close:()=>setOpen(false),destroy(){trigger.removeEventListener('click',toggle);root.removeEventListener('click',outside,true);root.removeEventListener('keydown',keyboard);}};
}
