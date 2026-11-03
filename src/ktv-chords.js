// Six-string voicings: every tap advances to a different chord, then wraps.
export const KTV_CHORDS=[
  {name:'C',frequencies:[130.8128,164.8138,195.9977,261.6256,329.6276,391.9954]},
  {name:'Am',frequencies:[110,164.8138,220,261.6256,329.6276,440]},
  {name:'F',frequencies:[87.3071,130.8128,174.6141,220,261.6256,349.2282]},
  {name:'G',frequencies:[97.9989,146.8324,195.9977,246.9417,293.6648,391.9954]}
];
export function createGuitarStrummer(Context){
  let context=null,tone=null,index=0,generation=0;const voices=new Set();
  function stop(){generation++;for(const voice of voices){try{voice.source.stop();}catch{}voice.source.disconnect();voice.gain.disconnect();}voices.clear();context?.suspend().catch(()=>{});}
  function strum(muted=false){
    const chord=KTV_CHORDS[index++%KTV_CHORDS.length],token=generation;
    if(muted||!Context)return chord.name;
    try{
      if(!context){context=new Context();tone=context.createBiquadFilter();tone.type='lowpass';tone.frequency.value=1750;tone.Q.value=.45;tone.connect(context.destination);}
      context.resume().then(()=>{
        if(token!==generation)return;
        chord.frequencies.forEach((frequency,string)=>{
          const count=Math.round(context.sampleRate*2.05),period=Math.max(2,Math.round(context.sampleRate/frequency));
          const buffer=context.createBuffer(1,count,context.sampleRate),samples=buffer.getChannelData(0),ring=new Float32Array(period);
          for(let i=0;i<period;i++)ring[i]=(Math.random()*2-1)*.5;
          // A rounded excitation and low-pass body soften the pick and upper harmonics.
          for(let pass=0;pass<3;pass++){const smooth=ring.slice();for(let i=0;i<period;i++)ring[i]=(smooth[(i+period-1)%period]+2*smooth[i]+smooth[(i+1)%period])*.25;}
          for(let i=0;i<count;i++){const k=i%period;samples[i]=ring[k];ring[k]=(ring[k]+ring[(k+1)%period])*.497;}
          const source=context.createBufferSource(),gain=context.createGain(),start=context.currentTime+string*.042;
          source.buffer=buffer;gain.gain.setValueAtTime(.0001,start);gain.gain.linearRampToValueAtTime(.135*Math.pow(.94,string),start+.012);gain.gain.exponentialRampToValueAtTime(.0001,start+2);
          source.connect(gain).connect(tone);const voice={source,gain};voices.add(voice);
          source.onended=()=>{voices.delete(voice);source.disconnect();gain.disconnect();};source.start(start);
        });
      }).catch(()=>{});
    }catch{}
    return chord.name;
  }
  return {strum,stop};
}
