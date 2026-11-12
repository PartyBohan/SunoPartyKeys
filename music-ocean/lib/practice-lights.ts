import {connectedPorts,createPartyKeysLighting,lightingSysexAvailable} from './partykeys/connect-lighting.mjs';
import {midiOutputChoices,supportsPartyKeysBus,lightingInputIds} from './partykeys/partykeys-lights.mjs';

type Choice={id:string;port:MIDIOutput};
export type LightState='inactive'|'unavailable'|'ready'|'sent'|'error';
export class PracticeLights {
  private controller:ReturnType<typeof createPartyKeysLighting>|null=null;
  private output:MIDIOutput|null=null;
  private pairing='';
  private notes:number[]=[];
  private active=false;
  private failed=false;

  constructor(private status:(state:LightState)=>void) {}

  sync(access:MIDIAccess|null,allowed:boolean,selection:string,active:boolean) {
    this.active=active;
    if (!active||!access) {this.detach();this.status('inactive');return;}
    if (!lightingSysexAvailable(access,allowed)) {this.detach();this.status('unavailable');return;}
    const inputs=connectedPorts(access.inputs),outputs=connectedPorts(access.outputs);
    const choices=(midiOutputChoices(outputs) as Choice[]).filter(({port})=>supportsPartyKeysBus(port))
      .map(choice=>({...choice,ids:lightingInputIds(choice.port,inputs,outputs)}))
      .filter(({ids})=>ids.length&&(selection==='all'||ids.includes(selection)));
    if (choices.length!==1) {this.detach();this.status('unavailable');return;}
    const {id,port,ids}=choices[0],pairing=ids.join(',');
    if (this.controller&&this.output===port&&this.pairing===pairing) return;
    this.detach();
    try {
      this.controller=createPartyKeysLighting({inputs:access.inputs,outputs:access.outputs,outputId:id,sysexEnabled:true,
        onStatus:(state:string)=>{
          this.failed=state==='error';
          this.status(this.failed?'error':this.notes.length?'sent':'ready');
        }});
      this.output=port;
      this.pairing=pairing;
      this.status('ready');
      if (this.notes.length) this.controller.set(this.notes);
    } catch {this.status('unavailable');}
  }

  receive(bytes:number[],inputId:string) {this.controller?.receive(bytes,inputId);}
  set(notes:number[]) {
    const next=this.active?notes:[];
    if (this.notes.join(',')===next.join(',')) return;
    this.notes=next;
    if (next.length) this.controller?.set(next);
    else if(this.controller){this.controller.off();if(!this.failed)this.status('ready');}
  }
  private detach() {
    this.controller?.dispose();
    this.controller=null;
    this.output=null;
    this.pairing='';
    this.failed=false;
  }
  dispose() {this.active=false;this.notes=[];this.detach();}
}
