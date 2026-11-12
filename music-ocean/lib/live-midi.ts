type LiveKey={type:string;portId?:string;channel:number;note?:number};

// USB keyboards emit one press and release per held key. Ignore duplicate packets
// on the same input and channel without swallowing a later, genuine re-strike.
export class LiveMidiKeys {
  private down=new Set<string>();

  accept(event:LiveKey) {
    if(event.type!=='on'&&event.type!=='off')return true;
    const key=`${event.portId??''}:${event.channel}:${event.note}`;
    if(event.type==='off')return this.down.delete(key);
    if(this.down.has(key))return false;
    this.down.add(key);
    return true;
  }

  clear(){this.down.clear();}
}

export function midiBridgePresent() {
  const host=window as Window&{webkit?:{messageHandlers?:{midiBridge?:unknown}};__webMIDIBridge?:unknown};
  return Boolean(host.webkit?.messageHandlers?.midiBridge&&host.__webMIDIBridge);
}

export function mobileMidiHost() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
}
