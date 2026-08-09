"use client";

/**
 * FianzaColdOpen — 2.8s cinematic cold-open + wordmark beat. Single-pass analytic WebGL:
 * every element is light (gaussian core + inverse-square bloom scaled by
 * circle-of-confusion), per-frame hash grain, premultiplied alpha so the
 * aperture composites over the live page.
 *
 * <FianzaColdOpen />  — mount once at the app root, above everything.
 * Plays once per sessionStorage session; never on client-side navigation
 * (mount it only on full page load). Never intercepts input. Unmounts to null.
 */
import { useEffect, useRef, useState } from 'react';

const KEY = 'fianza-cold-open-played';

const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
const FRAG = `precision highp float;
uniform vec2 uR;uniform vec2 uC;
uniform float uT,uZoom,uFoc,uFil,uIgn,uSpread,uLock,uPulse,uApert,uBlow,uAlpha,uVel,uGrain;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float segd(vec2 q,float L){return length(vec2(max(abs(q.x)-L,0.0),q.y));}
float glow(float d,float w,float coc,float I){
 float s=w+coc;
 float core=exp(-0.5*d*d/(s*s))*pow(w/s,0.45);
 float br=0.018+6.0*coc;
 float bl=0.22*pow(0.02/br,0.6)/(1.0+pow(d/br,1.9));
 return I*(core+bl);}
void main(){
 float asp=uR.x/uR.y;
 vec2 uv=gl_FragCoord.xy/uR;
 vec2 p=(uv-uC)*vec2(asp,1.0);
 float lk=clamp(uLock,0.0,1.0);
 float amber=uIgn*0.045/(1.0+pow(length(p)/0.6,2.0));
 float mint=0.0;
 for(int i=-4;i<=4;i++){
  float fi=float(i);
  float h=fract(sin(fi*127.1+7.7)*43758.5453);
  float z=(i==0)?1.0:mix(0.5,2.8,h);
  float zE=mix(z,1.12,lk*0.85);
  float zf=1.0+(uZoom-1.0)/z;
  float ys=fi*0.16*mix(0.75,1.35,fract(h*7.31));
  float y=mix(ys*zf,fi*0.10,uLock);
  float rev=(i==0)?uIgn:clamp(uSpread*2.6-abs(fi)*0.5-h*0.35,0.0,1.0);
  if(rev>0.001){
   float I=rev*((i==0)?1.0+(1.0-uFoc)*0.35:0.85/(zE*zE));
   float coc=((i==0)?(1.0-uFoc)*0.05:abs(zE-1.0)*0.028+(1.0-uFoc)*0.02)+uVel;
   float L=(i==0)?mix(0.012,asp,pow(uFil,1.5))*uZoom:asp*1.2;
   float w=0.0016*((i==0)?uZoom:zf);
   amber+=glow(segd(vec2(p.x,p.y-y),L),w,coc,I);
  }
 }
 if(uPulse>-5.0){
  float ppx=(uPulse-uC.x)*asp;
  float dxh=p.x-ppx;
  float head=exp(-dxh*dxh/0.0018);
  float trail=(dxh<0.0)?exp(dxh/0.16)*0.55:0.0;
  mint+=(head+trail)*glow(abs(p.y),0.0022,0.004,1.0)*1.4;
  mint+=0.5*head/(1.0+pow(length(vec2(dxh,p.y))/0.05,2.0));
 }
 float ap=1.0;float lip=0.0;
 if(uApert>0.0005){
  float ay=abs(p.y);
  float e=0.012+uApert*0.1;
  ap=smoothstep(uApert-e,uApert+e,ay);
  lip=exp(-pow((ay-uApert)/(e*1.4),2.0));
 }
 vec3 nec=vec3(1.0,0.690,0.125);vec3 ion=vec3(0.345,0.941,0.784);
 vec3 em=nec*amber*uBlow+ion*mint;
 vec3 col=vec3(0.0235,0.0353,0.0314)+em;
 col*=mix(1.0,0.55,smoothstep(0.35,1.15,length((uv-0.5)*vec2(asp,1.0))));
 col=col/(1.0+col*0.35);
 float g=hash(gl_FragCoord.xy+vec2(fract(uT*61.7)*173.0,fract(uT*47.3)*291.0))-0.5;
 col+=g*uGrain*(0.045+0.05*min(amber+mint,1.0));
 float a=uAlpha*ap;
 gl_FragColor=vec4(col*a+(nec*lip*0.45*uBlow+ion*lip*0.06)*uAlpha,a);
}`;

type Ease = (x: number) => number;
/** Numeric cubic-bezier — camera-operator easing, never default ease. */
function bez(x1: number, y1: number, x2: number, y2: number): Ease {
  const f = (a: number, b: number, m: number) => {
    const i = 1 - m;
    return 3 * i * i * m * a + 3 * i * m * m * b + m * m * m;
  };
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, m = 0.5;
    for (let k = 0; k < 26; k++) { m = (lo + hi) / 2; if (f(x1, x2, m) < x) lo = m; else hi = m; }
    return f(y1, y2, m);
  };
}
const eDolly = bez(0.5, 0, 0.65, 0.6);
const eFocus = bez(0.85, 0, 0.13, 1);
const eFil = bez(0.7, 0, 0.1, 1);
const eSpread = bez(0.4, 0, 0.2, 1);
const eLock = bez(0.25, 0, 0.15, 1);
const ePulse = bez(0.55, 0, 0.3, 1);
const eApert = bez(0.75, 0, 0.12, 1);
const eOut = bez(0, 0, 0.2, 1);
const seg = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));

interface Uniforms {
  zoom: number; cx: number; cy: number; foc: number; fil: number; ign: number;
  spread: number; lock: number; pulse: number; apert: number; blow: number; alpha: number;
}
/** The whole shot, 0.00–2.80s, as a pure function of authored time. */
function uniforms(t: number): Uniforms {
  const cT = eFocus(seg(t, 0.55, 1.5));
  const fl = t < 1 ? (Math.sin(t * 91.3) * 0.6 + Math.sin(t * 233.7) * 0.4) * 0.18 * (1 - seg(t, 0.15, 0.85)) : 0;
  return {
    zoom: 1 + 0.22 * eDolly(seg(t, 0, 2.8)),
    cx: 0.63 + (0.5 - 0.63) * cT,
    cy: 0.565 + (0.5 - 0.565) * cT,
    foc: eFocus(seg(t, 0.8, 1.45)),
    fil: eFil(seg(t, 0.85, 1.55)),
    ign: Math.min(1.3, eOut(seg(t, 0.03, 0.32)) * (1 + fl)),
    spread: eSpread(seg(t, 1.02, 1.58)),
    lock: t < 1.6 ? 0
      : t < 1.645 ? 1.075 * eLock(seg(t, 1.6, 1.645))       // snap past grid
      : t < 1.675 ? 1.075 - 0.075 * seg(t, 1.645, 1.675)    // one-frame overshoot seats
      : 1,                                                   // dead still
    pulse: t >= 1.74 && t < 2.2 ? -0.08 + 1.43 * ePulse(seg(t, 1.74, 2.18)) : -10,
    apert: t < 2.2 ? 0 : 0.004 + 0.75 * eApert(seg(t, 2.2, 2.62)),
    blow: 1 + 1.8 * Math.exp(-(((t - 2.3) / 0.14) ** 2)),
    alpha: t < 2.5 ? 1 : 1 - eOut(seg(t, 2.5, 2.78)),
  };
}

export interface FianzaColdOpenProps {
  /** Slow-motion review multiplier; 1 in production. */
  timeScale?: number;
  /** Grain amount, 0–2. */
  grain?: number;
  /**
   * How often it plays.
   *   'always'  — every page load. Highest impact, highest tax on repeat visits.
   *   'session' — once per browser session (default).
   *   number    — minutes of cooldown, e.g. 60 replays at most hourly.
   */
  replay?: 'always' | 'session' | number;
  onDone?: () => void;
}

const END = 4.55; // 2.8 open + wordmark beat

export default function FianzaColdOpen({
  timeScale = 1,
  grain = 1,
  replay = 'session',
  onDone,
}: FianzaColdOpenProps) {
  /*
   * Rendered on the server as well as the client. If this returned null during
   * SSR the browser would paint the landing page first and only cover it once
   * React hydrated — a visible flash of content before the shot begins. The
   * shade below is therefore in the initial HTML, opaque from the first paint,
   * and only ever removed from here.
   */
  const [play, setPlay] = useState(true);
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const el = host.current;

    /* Decide on the client, where storage and media queries actually exist.
       Anything that says "skip" tears the shade down on the first frame. */
    let skipIt = false;
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) skipIt = true;
      else if (replay === 'session' && sessionStorage.getItem(KEY)) skipIt = true;
      else if (typeof replay === 'number') {
        const last = Number(localStorage.getItem(KEY) || 0);
        if (Date.now() - last < replay * 60_000) skipIt = true;
      }
    } catch { /* storage denied — play it */ }
    if (skipIt) { setPlay(false); onDone?.(); return; }

    try {
      if (replay === 'session') sessionStorage.setItem(KEY, '1');
      else if (typeof replay === 'number') localStorage.setItem(KEY, String(Date.now()));
    } catch { /* ignore */ }
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';
    el.appendChild(cv);
    /* The aperture opens onto the live page at 2.19s, and the landing hero's
       left half is bg-bone — the same #F4F1E9 as the wordmark. Without its own
       ground the word is invisible over that half. This soft radial scrim rides
       the same curve as the word, so legibility never depends on what is behind. */
    const scrim = document.createElement('div');
    scrim.style.cssText = 'position:absolute;inset:0;opacity:0;pointer-events:none;background:radial-gradient(ellipse 78% 46% at 50% 50%,rgba(6,9,8,0.94) 0%,rgba(6,9,8,0.82) 42%,rgba(6,9,8,0.45) 68%,rgba(6,9,8,0) 100%);';
    el.appendChild(scrim);

    const word = document.createElement('div');
    word.textContent = 'FIANZA';
    word.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);opacity:0;color:#F4F1E9;font-family:var(--font-display),"Space Grotesk",system-ui,sans-serif;font-weight:600;font-size:clamp(40px,6vw,84px);letter-spacing:0.34em;text-indent:0.34em;white-space:nowrap;text-shadow:0 0 14px rgba(255,176,32,0.75),0 0 46px rgba(255,176,32,0.45),0 0 110px rgba(255,176,32,0.24),0 0 200px rgba(255,176,32,0.12);';
    el.appendChild(word);
    const gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
    const ts = timeScale > 0 ? timeScale : 1;
    let done = false, running = false, raf = 0, hiddenAt = 0;
    let scale = 1, t0 = performance.now(), prevNow = t0, prevZoom = 1, frames = 0, acc = 0;

    const finish = () => { if (done) return; done = true; cleanup(); setPlay(false); onDone?.(); };
    if (!gl) { finish(); return; }

    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); finish(); return; }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const la = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(la);
    gl.vertexAttribPointer(la, 2, gl.FLOAT, false, 0, 0);
    const U: Record<string, WebGLUniformLocation | null> = {};
    for (const n of ['uR', 'uC', 'uT', 'uZoom', 'uFoc', 'uFil', 'uIgn', 'uSpread', 'uLock', 'uPulse', 'uApert', 'uBlow', 'uAlpha', 'uVel', 'uGrain']) {
      U[n] = gl.getUniformLocation(prog, n);
    }

    const size = () => {
      const d = Math.min(window.devicePixelRatio || 1, 2) * scale;
      cv.width = Math.max(2, Math.round(window.innerWidth * d));
      cv.height = Math.max(2, Math.round(window.innerHeight * d));
      gl.viewport(0, 0, cv.width, cv.height);
    };
    size();

    /* Any input cuts straight to the open — never trap anyone. */
    const skip = () => {
      const t = (performance.now() - t0) / 1000 / ts;
      if (t < 2.2) t0 = performance.now() - 2.2 * 1000 * ts;
      else if (t > 2.4) t0 = performance.now() - END * 1000 * ts; // second input ends the wordmark
    };
    const onVis = () => {
      if (document.hidden) {
        if (running) { running = false; cancelAnimationFrame(raf); hiddenAt = performance.now(); }
      } else if (!running && !done) {
        t0 += performance.now() - hiddenAt; prevNow = performance.now();
        running = true; raf = requestAnimationFrame(loop);
      }
    };
    const loop = () => {
      if (!running) return;
      const now = performance.now(), dt = (now - prevNow) / 1000;
      prevNow = now;
      const t = (now - t0) / 1000 / ts;
      if (t >= END) { finish(); return; }
      if (t >= 2.19) el.style.background = 'transparent';
      // wordmark beat: fade in with glow, hold, gone
      const wIn = eOut(seg(t, 2.58, 3.05)), wOut = 1 - eOut(seg(t, 4.12, 4.55));
      const wa = wIn * wOut;
      word.style.opacity = wa.toFixed(3);
      scrim.style.opacity = wa.toFixed(3);
      word.style.transform = `translate(-50%,-50%) scale(${(1.035 - 0.035 * eOut(seg(t, 2.58, 3.7))).toFixed(4)})`;
      if (t >= 2.8) { cv.style.display = 'none'; raf = requestAnimationFrame(loop); return; }
      const u = uniforms(t);
      const vel = Math.min(0.02, Math.abs(u.zoom - prevZoom) / Math.max(dt, 0.001) * 0.02);
      prevZoom = u.zoom;
      gl.uniform2f(U.uR, cv.width, cv.height);
      gl.uniform2f(U.uC, u.cx, u.cy);
      gl.uniform1f(U.uT, t);
      gl.uniform1f(U.uZoom, u.zoom);
      gl.uniform1f(U.uFoc, u.foc);
      gl.uniform1f(U.uFil, u.fil);
      gl.uniform1f(U.uIgn, u.ign);
      gl.uniform1f(U.uSpread, u.spread);
      gl.uniform1f(U.uLock, u.lock);
      gl.uniform1f(U.uPulse, u.pulse);
      gl.uniform1f(U.uApert, u.apert);
      gl.uniform1f(U.uBlow, u.blow);
      gl.uniform1f(U.uAlpha, u.alpha);
      gl.uniform1f(U.uVel, vel);
      gl.uniform1f(U.uGrain, grain);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      /* frame-budget guard: drop render scale before touching the light */
      if (dt < 0.25) { acc += dt; frames++; }
      if (frames >= 40) {
        if (acc / frames > 0.021 && scale > 0.55) { scale -= 0.2; size(); }
        frames = 0; acc = 0;
      }
      raf = requestAnimationFrame(loop);
    };
    const cleanup = () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('pointerdown', skip, true);
      window.removeEventListener('keydown', skip, true);
      window.removeEventListener('wheel', skip, true);
      window.removeEventListener('touchstart', skip, true);
      window.removeEventListener('scroll', skip, true);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('resize', size);
      if (cv.parentNode) cv.parentNode.removeChild(cv);
      if (scrim.parentNode) scrim.parentNode.removeChild(scrim);
      if (word.parentNode) word.parentNode.removeChild(word);
    };
    window.addEventListener('pointerdown', skip, { capture: true, passive: true });
    window.addEventListener('keydown', skip, { capture: true, passive: true });
    window.addEventListener('wheel', skip, { capture: true, passive: true });
    window.addEventListener('touchstart', skip, { capture: true, passive: true });
    window.addEventListener('scroll', skip, { capture: true, passive: true });
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('resize', size);
    running = true;
    raf = requestAnimationFrame(loop);
    return () => { done = true; cleanup(); };
  }, [play]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!play) return null;
  return (
    <>
      {/* Hides the shade for reduced-motion users without waiting for JS, so
          they never see a black frame at all. */}
      <style>{'@media(prefers-reduced-motion:reduce){#fianza-cold-open{display:none!important}}'}</style>
      <div
        id="fianza-cold-open"
        ref={host}
        aria-hidden
        style={{ position: 'fixed', inset: 0, zIndex: 2147483000, pointerEvents: 'none', background: '#060908' }}
      />
    </>
  );
}
