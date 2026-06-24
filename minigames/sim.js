// Headless balance sim of RUN SILENT v3 — replicates the in-game tick math.
const SYS = [{id:'engines',n:45},{id:'sensors',n:22},{id:'life',n:16}];
const THR_FAR = 80;

const POLICIES = {
  PASSIVE:    () => ({on:{engines:1,sensors:1,life:1,lights:1}}),          // do nothing, all on
  DECOY_SPAM: () => ({on:{engines:1,sensors:1,life:1,lights:1}, decoy:true}), // all on + throw decoys asap
  SKILLED:    ({prox,thr}) => {                                            // omniscient optimal-ish captain
    if (prox > 0.60) { // sweeping: get under the line
      return thr > 16 ? {on:{engines:0,sensors:0,life:1,lights:0}} : {on:{engines:0,sensors:0,life:0,lights:0}};
    }
    return {on:{engines:1,sensors:0,life:1}}; // far: engines+life (61 < 80, safe but blind)
  },
  RECKLESS_BURN: () => ({on:{engines:1,sensors:0,life:1,lights:0}}),       // engines always on, never go quiet
};

function sim(name, SP, nearStart, detFill){
  let t=0,dist=0,det=0,o2=100,sweepIx=0,wasNear=false,haul=3,decoyT=0,launch=0,strikes=0,suff=0,grace=0;
  const dt=0.05; let steps=0;
  while(true){
    if(++steps>40000) return {res:'TIMEOUT',t,dist,strikes,sweepIx};
    t+=dt;
    const prox=(Math.sin(t*2*Math.PI/SP - Math.PI/2)+1)/2;
    const near=prox>0.62;
    if(wasNear&&!near) sweepIx++; wasNear=near;
    const firstCycle=t<SP;
    const nearBase=Math.max(9,nearStart-sweepIx*3);
    const thr=THR_FAR-(THR_FAR-nearBase)*Math.max(0,Math.min(1,(prox-0.40)/0.45));
    const act=POLICIES[name]({prox,near,thr,haul,o2,sweepIx});
    const on=act.on;
    if(act.decoy && haul>0 && decoyT<=0){haul--;decoyT=2.5;launch=0.5;}
    let sig=0; for(const s of SYS) if(on[s.id]) sig+=s.n; if(launch>0) sig+=30;
    if(launch>0)launch-=dt;
    if(on.engines)dist=Math.min(100,dist+(near?1:4.5)*dt);
    if(!on.life){o2=Math.max(0,o2-18*dt); if(o2<=0){suff+=dt; if(suff>3) return {res:'SUFFOCATED',t,dist,strikes,sweepIx};}}
    else {o2=Math.min(100,o2+22*dt); suff=0;}
    if(decoyT>0)decoyT-=dt; if(grace>0)grace-=dt;
    const safe=decoyT>0||grace>0; const over=sig-thr;
    if(over>0&&!safe){const f=detFill*Math.max(0.3,Math.min(1.6,over/25))*(on.sensors?0.7:1)*(firstCycle?0.5:1); det=Math.min(100,det+f*dt);}
    else det=Math.max(0,det-14*dt);
    if(det>=100){strikes++;det=0;grace=1.5;dist=Math.max(0,dist-15); if(strikes>=3) return {res:'CAUGHT',t,dist,strikes,sweepIx};}
    if(dist>=100) return {res:'ESCAPE',t,dist,strikes,sweepIx};
  }
}

const seeds=[[13,26,22],[10,30,26],[16,22,18]]; // SP, nearStart, detFill — the rolled-variance extremes
for(const name of Object.keys(POLICIES)){
  console.log('\n== '+name+' ==');
  for(const [SP,ns,df] of seeds){
    const r=sim(name,SP,ns,df);
    console.log(`  SP=${SP} nearStart=${ns} detFill=${df.toFixed(0)}  ->  ${r.res.padEnd(10)} t=${r.t.toFixed(1)}s dist=${r.dist.toFixed(0)}% strikes=${r.strikes} sweeps=${r.sweepIx}`);
  }
}
