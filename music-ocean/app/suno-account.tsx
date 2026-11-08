import {useEffect,useState} from 'react';
import {ArrowUpRight,LoaderCircle,RotateCcw} from 'lucide-react';
import {accountUsage,type AccountUsage} from '@/lib/account-usage';

export default function SunoAccount({zh,active,connected,request}:{zh:boolean;active:boolean;connected:boolean;request:(path:string)=>Promise<unknown>}){
  const [usage,setUsage]=useState<AccountUsage|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    let current=true;setUsage(null);setError('');
    if(!active||!connected){setLoading(false);return;}
    setLoading(true);
    void request('/api/account').then(raw=>{if(current){const next=accountUsage(raw);setUsage(next);if(!next)setError(zh?'暂未收到余额，请到 Suno 查看。':'Balance unavailable. Check your Suno account.');}}).catch(()=>{if(current)setError(zh?'余额查询未完成，可重试或到 Suno 查看。':'Could not check the balance. Retry or open Suno.');}).finally(()=>{if(current)setLoading(false);});
    return()=>{current=false;};
  },[active,connected,revision,request,zh]);
  return <div className="suno-balance">
    {connected&&<><div className="balance-heading"><span>{usage?.plan||'Suno'} · {zh?'账户余额':'Account balance'}</span><button aria-label={zh?'刷新 Suno 余额':'Refresh Suno balance'} disabled={loading} onClick={()=>setRevision(r=>r+1)}>{loading?<LoaderCircle className="spin" size={14}/>:<RotateCcw size={14}/>}</button></div>
    {usage?<div className="balance-counts"><div><strong>{usage.generation??'—'}</strong><span>{zh?'创作额度':'Generation credits'}</span></div><div><strong>{usage.downloads??'—'}</strong><span>{zh?'下载额度':'Download credits'}</span></div></div>:<p role="status">{loading?(zh?'正在查询真实余额…':'Checking your balance…'):error}</p>}</>}
    <a className="secondary-button" href="https://suno.com/account" target="_blank" rel="noreferrer">{zh?'Suno 充值与订阅':'Suno plans & top-ups'}<ArrowUpRight size={14}/></a>
    <p>{zh?'创作与下载分别计额。在 Suno 官方账户页选择套餐或购买额度。':'Generation and downloads use separate credits. Choose a plan or top up on your official Suno account page.'}</p>
  </div>;
}
