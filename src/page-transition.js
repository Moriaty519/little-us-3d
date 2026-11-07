// One live room camera flight, followed by an overlapping page arrival.
export function createPageTransition({room,home,hideHome}){
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  let operation=null,sequence=0,frameId=null,finishFrame=null;
  function animate(duration,draw,token){
    return new Promise(resolve=>{
      finishFrame=resolve;let start=null;
      const frame=time=>{
        if(token!==sequence){finishFrame=null;resolve(false);return;}
        start??=time;const p=reduced.matches?1:Math.min(1,(time-start)/duration);
        draw(p);
        if(p<1)frameId=requestAnimationFrame(frame);else{frameId=null;finishFrame=null;resolve(true);}
      };
      if(reduced.matches){draw(1);finishFrame=null;resolve(true);}else frameId=requestAnimationFrame(frame);
    });
  }
  function clean(op){
    if(operation!==op)return;
    room?.endFeatureFocus();home.style.opacity='';home.inert=op.homeInert;
    home.classList.remove('feature-departing');op.page.style.opacity='';op.page.style.transform='';op.page.inert=op.pageInert;
    document.body.classList.remove('feature-transitioning');delete document.body.dataset.transitionPhase;
    document.body.classList.remove('guitar-room-transition');for(const name of ['--ktv-ui-opacity','--ktv-guitar-opacity'])op.page.style.removeProperty?.(name);
    document.body.classList.remove('album-shelf-transition');home.style.removeProperty?.('--album-room-opacity');for(const name of ['--album-book-opacity','--album-ui-opacity'])op.page.style.removeProperty?.(name);
    document.body.classList.remove('cinema-matched-transition');op.page.style.removeProperty?.('--cinema-ui-opacity');
    operation=null;
  }
  function cancel(){
    if(!operation)return;const op=operation;sequence++;
    if(frameId!==null)cancelAnimationFrame(frameId);frameId=null;
    const resolve=finishFrame;finishFrame=null;resolve?.(false);
    op.resolveCancel();
    op.page.hidden=true;clean(op);
  }
  async function enter({entrance,page,open,fit,isCurrent,focus,arrivalBounds,arrivalProgress}){
    cancel();const token=++sequence;
    const op={page,isCurrent,homeInert:home.inert,pageInert:page.inert};op.cancelled=new Promise(resolve=>op.resolveCancel=resolve);operation=op;
    home.inert=true;page.inert=true;page.style.opacity='0';
    home.classList.add('feature-departing');document.body.classList.add('feature-transitioning');document.body.dataset.transitionPhase='focus';
    try{
      const guitar=entrance==='guitar'&&!!room?.guitarIsolationProgress&&!reduced.matches;
      const shelf=entrance==='photos'&&!!room?.albumIsolationProgress&&!reduced.matches;
      const mapMatch=entrance==='map'&&!!arrivalBounds&&!reduced.matches;
      const cinemaMatch=entrance==='screen'&&!reduced.matches;
      const cinematicMatch=cinemaMatch||mapMatch;
      if(cinemaMatch){document.body.classList.add('cinema-matched-transition');page.style.setProperty('--cinema-ui-opacity','0');}
      if(guitar){document.body.classList.add('guitar-room-transition');home.style.setProperty('--album-room-opacity','1');page.style.setProperty('--ktv-ui-opacity','0');}
      if(shelf){document.body.classList.add('album-shelf-transition');home.style.setProperty('--album-room-opacity','1');page.style.setProperty('--album-book-opacity','0');page.style.setProperty('--album-ui-opacity','0');}
      const focused=!reduced.matches&&room?.beginFeatureFocus(entrance);
      let prepareError;
      let bounds;
      const prepared=Promise.resolve(open()).then(()=>{if((shelf||mapMatch||guitar)&&operation===op){bounds=arrivalBounds?.();room.featureFocusBounds?.(bounds);}}).catch(error=>{prepareError=error;});
      // Prepare the projection before moving, so a first-visit scene build
      // cannot interrupt the camera midway through the flight.
      // Map and projection both prepare the destination before the shared camera
      // flight starts, so the entry reads as the same movement into the screen/map.
      if(cinematicMatch){
        await Promise.race([prepared,op.cancelled]);
        if(operation!==op||!isCurrent()){if(operation===op)cancel();return false;}
        if(prepareError)throw prepareError;
      }
      const flew=await animate(focused?(shelf?960:cinematicMatch?1080:820):160,p=>room?.featureFocusProgress(cinematicMatch?p*p*p*(p*(p*6-15)+10):p*p*(3-2*p)),token);
      await Promise.race([prepared,op.cancelled]);
      if(!flew||operation!==op||!isCurrent()){if(operation===op)cancel();return false;}
      if(prepareError)throw prepareError;
      if(cinemaMatch&&focused){
        document.body.dataset.transitionPhase='arrive';
        const arrived=await animate(400,p=>{
          const ease=p*p*(3-2*p);
          // Keep the room opaque underneath to avoid dimming the shared picture.
          page.style.opacity=String(ease);page.style.transform='';
          const ui=Math.max(0,(p-.25)/.75);page.style.setProperty('--cinema-ui-opacity',String(ui*ui*(3-2*ui)));
        },token);
        if(!arrived||operation!==op||!isCurrent()){if(operation===op)cancel();return false;}
        hideHome();clean(op);fit?.();focus?.();return true;
      }
      if(guitar&&focused&&bounds){
        const smooth=value=>{const p=Math.max(0,Math.min(1,value));return p*p*(3-2*p);};
        document.body.dataset.transitionPhase='guitar';page.style.opacity='1';
        const transferred=await animate(720,p=>{
          const backdrop=smooth(p/.78),transfer=smooth((p-.72)/.28);
          room.guitarIsolationProgress(backdrop);room.guitarTransferProgress(transfer);
          home.style.setProperty('--album-room-opacity',String(1-backdrop));
        },token);
        if(!transferred||operation!==op||!isCurrent()){if(operation===op)cancel();return false;}
        hideHome();home.style.opacity='0';document.body.dataset.transitionPhase='reveal';
        const revealed=await animate(1120,p=>{
          arrivalProgress?.(smooth(p));page.style.setProperty('--ktv-ui-opacity',String(smooth((p-.7)/.3)));
        },token);
        if(!revealed||operation!==op||!isCurrent()){if(operation===op)cancel();return false;}
        clean(op);fit?.();focus?.();return true;
      }
      if(shelf&&focused&&bounds){
        document.body.dataset.transitionPhase='isolate';page.style.opacity='1';
        const smooth=value=>{const p=Math.max(0,Math.min(1,value));return p*p*(3-2*p);};
        const isolated=await animate(720,p=>{
          const background=smooth(p/.72),transfer=smooth((p-.72)/.28);
          room.albumIsolationProgress(background);room.albumTransferProgress(transfer);
          home.style.setProperty('--album-room-opacity',String(1-background));page.style.setProperty('--album-book-opacity',String(transfer));
        },token);
        if(!isolated||operation!==op||!isCurrent()){if(operation===op)cancel();return false;}
        document.body.dataset.transitionPhase='controls';
        const controls=await animate(200,p=>page.style.setProperty('--album-ui-opacity',String(smooth(p))),token);
        if(!controls||operation!==op||!isCurrent()){if(operation===op)cancel();return false;}
        hideHome();clean(op);fit?.();focus?.();return true;
      }
      document.body.classList.remove('album-shelf-transition');
      const alignedMap=mapMatch&&focused&&!!bounds;
      if(alignedMap&&room?.mapLensProgress){
        document.body.dataset.transitionPhase='map-lens';
        const lens=await animate(140,p=>room.mapLensProgress(p*p*(3-2*p)),token);
        if(!lens||operation!==op||!isCurrent()){if(operation===op)cancel();return false;}
      }
      document.body.dataset.transitionPhase='arrive';
      // The map page is already matched to the framed map underneath; show it
      // atomically instead of letting foreground furniture show through a
      // half-transparent page.
      const instantMap=alignedMap&&!reduced.matches;
      const arrived=await animate(instantMap?1:(alignedMap?400:mapMatch?400:680),p=>{
        const ease=1-Math.pow(1-p,3),fade=instantMap?1:(alignedMap||mapMatch?p*p*(3-2*p):Math.min(1,ease/0.8));
        page.style.opacity=String(fade);home.style.opacity=alignedMap||mapMatch?'':String(1-fade);
        page.style.transform=reduced.matches||alignedMap||mapMatch?'':`scale(${1+.045*(1-ease)})`;
      },token);
      if(!arrived||operation!==op||!isCurrent()){if(operation===op)cancel();return false;}
      arrivalProgress?.(1);hideHome();clean(op);fit?.();focus?.();return true;
    }catch(error){if(operation===op)cancel();throw error;}
  }
  return {enter,cancel,cancelIfStale:()=>{if(operation&&!operation.isCurrent())cancel();},isActive:()=>!!operation};
}
