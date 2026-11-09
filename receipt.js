/* Rhino's body receipt (used by /clock/ and /sleep/).
   Draws a 1080×1920 look-A paper receipt of the viewer's own result on a canvas, right in the browser,
   and saves it as a PNG through a blob URL. Nothing is sent anywhere and nothing is stored:
   no network calls (the pages' CSP sets connect-src 'none'), no outside scripts, no cookies.
   iPhone fallback: some browsers (older iOS Safari, in-app browsers) ignore the download attribute,
   so a preview of the receipt always appears under the button; press and hold it to Save to Photos. */
(function(){
  'use strict';
  const W=1080, H=1920;
  const C={navy:'#0A1A5C',cobalt:'#1F4FD8',yellow:'#FFD60A',ink:'#0B0B0F',paper:'#F3F1EC',muted:'#4A4E5C',
    coral:'#FF6B5B',rule:'#BDB8AC',track:'#DEDBD3',sky:'#DCE3FA',star:'#8FA2E6'};
  const FAM={head:"'Poppins', system-ui, sans-serif",body:"'Inter', system-ui, sans-serif",note:"'Kalam', 'Comic Sans MS', cursive"};
  // Rhino's horn mark (ring version), from the brand's horn_mark_ring.svg, 512×512 space.
  const HORN={
    yellow:['M352 300 C 360 228 380 160 412 92 C 438 168 444 244 430 316 Z','M298 240 C 302 214 312 192 326 172 C 338 198 342 222 338 250 Z'],
    paper:['M96 404 C 84 330 92 252 140 208 C 182 170 236 168 286 196 C 330 220 372 252 410 280 C 444 304 452 350 430 380 C 412 404 380 410 350 404 L 250 392 C 200 388 150 396 96 404 Z','M150 214 C 140 180 142 150 156 124 C 182 140 204 166 212 196 Z'],
    glasses:'M242 234 L306 234 Q322 234 322 250 L322 280 Q322 296 306 296 L242 296 Q226 296 226 280 L226 250 Q226 234 242 234 Z M226 256 L168 244',
    smile:'M376 372 C 396 384 420 376 430 356'
  };

  const font=(px,w,fam)=>w+' '+px+'px '+fam;
  // largest size (down to min) at which the text fits maxW
  function fit(x,text,w,fam,px,maxW,min){
    for(;px>min;px-=2){x.font=font(px,w,fam);if(x.measureText(text).width<=maxW)return px;}
    x.font=font(min,w,fam);return min;
  }
  function wrap(x,text,maxW){
    const words=String(text).split(/\s+/),lines=[];let cur='';
    words.forEach(wd=>{const t=cur?cur+' '+wd:wd;if(x.measureText(t).width>maxW&&cur){lines.push(cur);cur=wd;}else cur=t;});
    if(cur)lines.push(cur);return lines;
  }
  function rrect(x,l,t,w,h,r){x.beginPath();x.moveTo(l+r,t);x.arcTo(l+w,t,l+w,t+h,r);x.arcTo(l+w,t+h,l,t+h,r);x.arcTo(l,t+h,l,t,r);x.arcTo(l,t,l+w,t,r);x.closePath();}
  function dashed(x,l,r,y){x.save();x.setLineDash([14,12]);x.lineWidth=4;x.strokeStyle=C.rule;x.beginPath();x.moveTo(l,y);x.lineTo(r,y);x.stroke();x.restore();}
  function horn(x,cx,cy,size){
    x.save();x.translate(cx-size/2,cy-size/2);x.scale(size/512,size/512);
    x.beginPath();x.arc(256,256,250,0,Math.PI*2);x.fillStyle=C.yellow;x.fill();
    x.lineWidth=12;x.strokeStyle=C.ink;x.stroke();
    x.beginPath();x.arc(256,256,214,0,Math.PI*2);x.fillStyle=C.cobalt;x.fill();x.stroke();
    x.translate(40,34);x.scale(.84,.84);
    if(typeof Path2D==='function'){
      HORN.yellow.forEach(d=>{x.fillStyle=C.yellow;x.fill(new Path2D(d));});
      HORN.paper.forEach(d=>{x.fillStyle=C.paper;x.fill(new Path2D(d));});
      x.lineJoin='round';x.lineCap='round';x.strokeStyle=C.ink;
      x.lineWidth=20;x.stroke(new Path2D(HORN.glasses));
      x.beginPath();x.arc(282,266,9,0,Math.PI*2);x.fillStyle=C.ink;x.fill();
      x.lineWidth=12;x.stroke(new Path2D(HORN.smile));
    }
    x.restore();
  }
  // the receipt's torn top and bottom edges
  function paperPath(x,l,t,r,b,dx,dy){
    const tw=30,th=14,n=Math.round((r-l)/tw);
    x.beginPath();x.moveTo(l+dx,t+th+dy);
    for(let i=1;i<=n;i++)x.lineTo(l+i*(r-l)/n+dx,t+(i%2?0:th)+dy);
    x.lineTo(r+dx,b-th+dy);
    for(let i=n-1;i>=0;i--)x.lineTo(l+i*(r-l)/n+dx,b-((n-i)%2?0:th)+dy);
    x.closePath();
  }
  // small deterministic barcode from the result text (decoration only)
  function barcode(x,cx,y,w,h,seed){
    let s=0;for(let i=0;i<seed.length;i++)s=(s*31+seed.charCodeAt(i))>>>0;
    const bars=[];let tot=0;
    while(tot<w){s=(s*1103515245+12345)>>>0;const bw=2+(s>>>16)%7,gap=3+(s>>>8)%5;bars.push([tot,bw]);tot+=bw+gap;}
    const l=cx-tot/2;x.fillStyle=C.ink;bars.forEach(([o,bw])=>x.fillRect(l+o,y,bw,h));
  }

  /* spec = { kicker, lines:[[label,value],...], totalLabel, big, unit, sub, meter (0..1 or null), note, fine } */
  function draw(spec){
    const cv=document.createElement('canvas');cv.width=W;cv.height=H;
    const x=cv.getContext('2d');x.textBaseline='alphabetic';
    // night sky + the yellow ring in the corner (look A)
    x.fillStyle=C.navy;x.fillRect(0,0,W,H);
    x.fillStyle=C.star;[[80,90,3],[300,60,2.4],[520,120,2.8],[760,70,2],[980,300,2.6],[60,700,2.2],[1030,900,2.4],[50,1300,2.8],[1020,1500,2.2],[200,1820,2.4],[880,1860,2.8]]
      .forEach(([a,b,r])=>{x.beginPath();x.arc(a,b,r,0,Math.PI*2);x.fill();});
    x.save();x.beginPath();x.arc(W+30,-30,250,0,Math.PI*2);x.lineWidth=64;x.strokeStyle=C.yellow;x.stroke();
    x.lineWidth=7;x.strokeStyle=C.ink;x.beginPath();x.arc(W+30,-30,282,0,Math.PI*2);x.stroke();x.beginPath();x.arc(W+30,-30,218,0,Math.PI*2);x.stroke();x.restore();

    // the paper: ink drop shadow, paper fill, ink outline
    const PL=110,PR=970,PT=150,PB=1650,L=170,R=910,MW=R-L;
    x.fillStyle=C.ink;paperPath(x,PL,PT,PR,PB,18,24);x.fill();
    x.fillStyle=C.paper;paperPath(x,PL,PT,PR,PB,0,0);x.fill();
    x.lineWidth=6;x.lineJoin='round';x.strokeStyle=C.ink;x.stroke();

    // header
    x.textAlign='center';x.fillStyle=C.ink;
    fit(x,"RHINO'S LAB",800,FAM.head,76,MW,40);x.fillText("RHINO'S LAB",W/2,262);
    x.fillStyle=C.cobalt;x.font=font(48,700,FAM.note);x.fillText('your body receipt',W/2,324);
    dashed(x,L,R,368);
    // kicker + date
    x.textAlign='left';x.fillStyle=C.cobalt;fit(x,spec.kicker.toUpperCase(),700,FAM.head,32,MW-300,22);x.fillText(spec.kicker.toUpperCase(),L,428);
    const date=new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    x.textAlign='right';x.fillStyle=C.muted;x.font=font(28,600,FAM.body);x.fillText(date,R,428);

    // line items with dotted leaders
    let y=500;
    (spec.lines||[]).slice(0,7).forEach(([lab,val])=>{
      x.textAlign='right';x.fillStyle=C.ink;fit(x,val,700,FAM.body,36,MW*.5,24);const vw=x.measureText(val).width;x.fillText(val,R,y);
      x.textAlign='left';fit(x,lab,500,FAM.body,34,MW-vw-60,22);const lw=x.measureText(lab).width;x.fillText(lab,L,y);
      x.fillStyle=C.rule;for(let d=L+lw+14;d<R-vw-14;d+=16){x.beginPath();x.arc(d,y-8,2.6,0,Math.PI*2);x.fill();}
      y+=56;
    });
    y+=4;dashed(x,L,R,y-30);

    // the total
    x.textAlign='left';x.fillStyle=C.ink;fit(x,spec.totalLabel.toUpperCase(),800,FAM.head,36,MW,24);x.fillText(spec.totalLabel.toUpperCase(),L,y+30);
    const pillT=y+58,pillH=180;
    let bigPx=fit(x,spec.big,800,FAM.head,166,MW-260,90);const bw=x.measureText(spec.big).width;
    x.font=font(64,800,FAM.head);const uw=x.measureText(spec.unit||'').width;
    const pillW=bw+64;
    x.fillStyle=C.ink;rrect(x,L+10,pillT+12,pillW,pillH,30);x.fill();
    x.fillStyle=C.yellow;rrect(x,L,pillT,pillW,pillH,30);x.fill();x.lineWidth=6;x.strokeStyle=C.ink;x.stroke();
    x.fillStyle=C.ink;x.font=font(bigPx,800,FAM.head);x.fillText(spec.big,L+32,pillT+pillH/2+bigPx*.36);
    if(spec.unit){x.font=font(64,800,FAM.head);x.fillText(spec.unit,L+pillW+28,pillT+pillH/2+24);}
    y=pillT+pillH+62;
    if(spec.sub){x.fillStyle=C.muted;x.font=font(32,500,FAM.body);wrap(x,spec.sub,MW).slice(0,3).forEach(ln=>{x.fillText(ln,L,y);y+=44;});}
    if(spec.meter!=null&&isFinite(spec.meter)){
      y+=4;const m=Math.max(0,Math.min(1,spec.meter));
      x.fillStyle=C.track;rrect(x,L,y,MW,36,18);x.fill();
      if(m>0){x.save();rrect(x,L,y,MW,36,18);x.clip();x.fillStyle=C.yellow;x.fillRect(L,y,MW*m,36);x.fillStyle=C.ink;x.fillRect(L+MW*m-2,y,4,36);x.restore();}
      rrect(x,L,y,MW,36,18);x.lineWidth=5;x.strokeStyle=C.ink;x.stroke();y+=80;
    }
    // Rhino's note, handwritten
    if(spec.note){y+=20;x.save();x.translate(W/2,y);x.rotate(-0.03);x.textAlign='center';x.fillStyle=C.cobalt;fit(x,spec.note,700,FAM.note,54,MW,30);x.fillText(spec.note,0,0);x.restore();y+=56;}
    if(spec.fine){x.textAlign='left';x.fillStyle=C.muted;x.font=font(25,400,FAM.body);wrap(x,spec.fine,MW).slice(0,3).forEach(ln=>{x.fillText(ln,L,y);y+=34;});}

    // footer: barcode, sign-off, horn mark + the site
    const FB=PB-40;
    // the sign-off only when the flow above left room for it (y is the next free baseline)
    if(y-30<FB-250){x.fillStyle=C.ink;x.textAlign='center';x.font=font(30,700,FAM.head);x.fillText("TAKE CARE, Y'ALL. RHINO OUT!",W/2,FB-220);}
    barcode(x,W/2,FB-196,560,56,spec.kicker+spec.big+spec.totalLabel);
    dashed(x,L,R,FB-118);
    const site='heyrhinotv.github.io';x.font=font(44,800,FAM.head);const sw=x.measureText(site).width;
    const hs=96,gx=W/2-(hs+22+sw)/2;
    horn(x,gx+hs/2,FB-58,hs);
    x.textAlign='left';x.fillStyle=C.ink;x.fillText(site,gx+hs+22,FB-42);

    // under the paper, on the sky
    x.textAlign='center';x.fillStyle=C.sky;x.font=font(26,500,FAM.body);
    x.fillText('From your own numbers. For learning, not medical advice.',W/2,1752);
    return cv;
  }

  function dataUrlToBlob(u){
    const [head,b64]=u.split(',');const bin=atob(b64);const a=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);
    return new Blob([a],{type:(head.match(/data:([^;]+)/)||[])[1]||'image/png'});
  }
  function warmFonts(){
    if(!document.fonts||!document.fonts.load)return;
    ['800 76px Poppins','700 32px Poppins','500 34px Inter','700 36px Inter','400 25px Inter','600 28px Inter','700 48px Kalam']
      .forEach(f=>{try{document.fonts.load(f).catch(()=>{});}catch(e){}});
  }

  /* attach({button, preview, img, hint, filename, getSpec}) wires the button.
     Everything on click runs synchronously so the browser still counts it as the tap that started the download. */
  function attach(o){
    warmFonts();
    const touch=window.matchMedia&&matchMedia('(pointer:coarse)').matches;
    o.button.addEventListener('click',()=>{
      const spec=o.getSpec();if(!spec)return;
      let url;
      try{
        const u=draw(spec).toDataURL('image/png');
        o.img.src=u;o.preview.hidden=false;
        o.hint.textContent=touch?'Didn’t save? Press and hold the receipt, then tap Save to Photos.':'Didn’t download? Right-click the receipt and save the image.';
        url=URL.createObjectURL(dataUrlToBlob(u));
        const a=document.createElement('a');a.href=url;a.download=o.filename;a.rel='noopener';
        document.body.appendChild(a);a.click();a.remove();
      }catch(e){o.hint.textContent='Your browser couldn’t make the file. Press and hold (or right-click) the receipt to save it.';}
      if(url)setTimeout(()=>URL.revokeObjectURL(url),60000);
    });
  }
  window.RhinoReceipt={draw,attach};
})();
