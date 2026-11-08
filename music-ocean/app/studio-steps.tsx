import {Check} from 'lucide-react';
import {canVisitStep,type StudioStep} from '@/lib/studio-flow';
export default function StudioSteps({step,zh,hasMelody,hasWork,onChange}:{step:StudioStep;zh:boolean;hasMelody:boolean;hasWork:boolean;onChange:(step:StudioStep)=>void}){
 const labels=zh?['录旋律','选风格','作品']:['Melody','Style','Your song'];
 return <nav className="flow-progress" aria-label={zh?'创作步骤':'Creation steps'}>{labels.map((label,index)=>{
  const number=(index+1) as StudioStep;
  return <span className="flow-item" key={label}>{index>0&&<span className="flow-line" aria-hidden="true"/>}<button aria-current={step===number?'step':undefined} className={step===number?'current':step>number?'done':''} disabled={!canVisitStep(number,hasMelody,hasWork)} onClick={()=>onChange(number)}><i>{step>number?<Check size={11}/>:number}</i><span>{label}</span></button></span>;
 })}</nav>;
}
