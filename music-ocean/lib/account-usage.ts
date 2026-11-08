export type AccountUsage={plan:string|null;generation:number|null;downloads:number|null};
export function accountUsage(raw:unknown):AccountUsage|null{
  const queue:unknown[]=[raw];let steps=0;
  while(queue.length&&steps++<32){
    const value=queue.shift();
    if(!value||typeof value!=='object')continue;
    if(Array.isArray(value)){queue.push(...value);continue;}
    const data=value as Record<string,any>;
    if(data.suno_account&&typeof data.suno_account==='object'){
      const a=data.suno_account;
      const count=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0?n:null;
      return {plan:typeof a.plan?.name==='string'?a.plan.name:null,generation:count(a.credits_remaining),downloads:count(a.download_credits_remaining)};
    }
    for(const key of ['data','result','structuredContent'])if(data[key])queue.push(data[key]);
  }
  return null;
}
