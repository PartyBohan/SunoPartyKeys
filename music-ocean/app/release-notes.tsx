import {useEffect,useRef} from 'react';
import {X} from 'lucide-react';
import {RELEASE_NOTES} from '@/lib/release-notes';
export default function ReleaseNotes({open,zh,onClose}:{open:boolean;zh:boolean;onClose:()=>void}){
 const ref=useRef<HTMLDialogElement|null>(null);
 useEffect(()=>{if(open&&!ref.current?.open)ref.current?.showModal();if(!open&&ref.current?.open)ref.current?.close();},[open]);
 return <dialog ref={ref} className="updates-dialog" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="dialog-body"><div className="dialog-heading"><h2>{zh?'更新记录':'What’s new'}</h2><button className="icon-button" aria-label={zh?'关闭':'Close'} onClick={onClose}><X size={18}/></button></div><div className="release-list">{RELEASE_NOTES.map(release=>{const note=zh?release.zh:release.en;return <article key={release.version}><div className="release-date"><strong>{release.version}</strong><time>{release.date}</time></div><h3>{note.title}</h3><ul>{note.items.map(item=><li key={item}>{item}</li>)}</ul></article>;})}</div></div></dialog>;
}
