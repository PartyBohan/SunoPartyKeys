import {api} from '@/lib/suno-server';
import {getChatGPTUser} from '@/app/chatgpt-auth';
export const dynamic='force-dynamic';
async function handle(req:Request){
 const user=await getChatGPTUser();
 if(!user)return api(req);
 const headers=new Headers(req.headers);headers.set('oai-authenticated-user-id',user.userId);
 return api(new Request(req.url,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:await req.arrayBuffer()}));
}
export const GET=handle;
export const POST=handle;
