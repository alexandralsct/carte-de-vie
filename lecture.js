/* ===== Lecture, en simple (v230) : un seul écran pour un espace dont disp.lecture est actif. Chargé à la demande (comme monde.js).
   En haut une recherche ; « Mes fiches » : chaque élément de rubrique qui porte une fiche ({fiche:"fiches/<id>.md"}) s'ouvre en grand,
   lisible et annotable (lecteur FICHE) ; dessous, « En cours de lecture » et « À lire » repliés ; un seul bouton, « + Ajouter un livre ».
   Aucun nom ni contenu personnel : tout vient des données de l'espace. ===== */
(function(){
  if(!document.getElementById("lectCss")){ const st=document.createElement("style"); st.id="lectCss"; st.textContent=
    ".lectr{display:grid;gap:14px}.lectr h3{margin:0}.lectr .lrech{width:100%;box-sizing:border-box;font:inherit;padding:12px 14px;border-radius:14px}"+
    ".lectr .lcols{display:grid;gap:14px}.lectr .lfiche{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;text-align:left;padding:12px 4px;background:none;border:0;border-top:1px solid var(--line,rgba(127,127,127,.3));color:inherit;font:inherit;cursor:pointer;min-height:44px}"+
    ".lectr .lfiche b{font-weight:700}.lectr .lfiche small{opacity:.8}.lectr details summary{cursor:pointer;font-weight:700;padding:8px 0;min-height:24px}.lectr details ul{margin:4px 0 0;padding-left:18px}.lectr .lform{display:grid;gap:8px}"+
    "@media (min-width:900px) and (pointer:fine){.lectr .lcols{grid-template-columns:minmax(0,3fr) minmax(0,2fr);align-items:start}.lectr .lfiche{padding:10px 6px}.lectr .lfiche:hover{background:color-mix(in srgb,currentColor 7%,transparent)}}";
    document.head.appendChild(st); }
  const norm=t=>String(t||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
  /* « Titre — Auteur · 8/10 (Catégorie) » : titre, auteur, note et catégorie quand ils y sont */
  const lit=k=>{ let t=String(k.text||""), cat="", note=""; let m=/\s*\(([^()]*)\)\s*$/.exec(t); if(m){ cat=m[1]; t=t.slice(0,m.index); } m=/\s*·\s*(\d+\/10)\s*$/.exec(t); if(m){ note=m[1]; t=t.slice(0,m.index); }
    const i=t.indexOf(" — "); return { titre:i>=0?t.slice(0,i):t, auteur:i>=0?t.slice(i+3):"", note, cat }; };
  const rubs=c=>Array.isArray(c.rub)?c.rub:[], enCours=r=>/en cours/.test(norm(r.name)), aLire=r=>/^a lire/.test(norm(r.name).trim());
  /* A : ce que l'app prête à cet écran ({cats, el, FICHE, majRub}) ; il ne touche à rien d'autre */
  window.lectureRend=function(A,c){ const {cats,el,FICHE,majRub}=A, pane=document.getElementById("pane"), help=t=>el("p",{className:"help",textContent:t}), uid=()=>Array.from(crypto.getRandomValues(new Uint8Array(11)),b=>"abcdefghijklmnopqrstuvwxyz0123456789"[b%36]).join(""); const cur=cats.get(c.id)||c; [...pane.children].forEach(x=>{ x.hidden=true; });
    const old=pane.querySelector(".lectr"); if(old) old.remove();
    const z=el("div",{className:"lectr"}), rech=el("input",{type:"search",className:"lrech",placeholder:"Chercher un livre ou un auteur…",autocomplete:"off"}); rech.setAttribute("aria-label","Chercher un livre ou un auteur");
    const fich=el("section",{className:"card lfiches"}), cote=el("div",{className:"lcote"}), cols=el("div",{className:"lcols"});
    const tout=[]; rubs(cur).forEach(r=>(r.items||[]).forEach(k=>{ if(k&&k.text&&FICHE.ok(k)) tout.push({r,k,v:lit(k)}); }));
    const rend=()=>{ const q=norm(rech.value).trim(), F=tout.filter(x=>!q||norm(x.k.text).includes(q)); fich.textContent=""; fich.appendChild(el("h3",{textContent:"Mes fiches · "+F.length}));
      if(!F.length) fich.appendChild(help(tout.length?"Aucune fiche ne correspond.":"Pas encore de fiche de lecture : elles arrivent ici dès qu'un livre est lu en entier."));
      const ligne=x=>{ const b=el("button",{type:"button",className:"lfiche"},el("b",{textContent:x.v.titre}),el("small",{textContent:[x.v.auteur,x.v.note,x.v.cat,x.k.lu?"lu le "+x.k.lu:""].filter(Boolean).join(" · ")}));
        b.setAttribute("aria-label","Ouvrir la fiche : "+x.v.titre); b.onclick=()=>FICHE.ouvre(cur,x.r,x.k); return b; };
      /* app téléphone : 10 fiches, le reste replié, pour que « En cours », « À lire » et le bouton restent à portée ; app ordinateur : toutes */
      const tel=!matchMedia("(min-width:900px) and (pointer:fine)").matches, n0=!q&&tel&&F.length>12?10:F.length;
      F.slice(0,n0).forEach(x=>fich.appendChild(ligne(x)));
      if(n0<F.length){ const d=el("details",{className:"lplus"},el("summary",{textContent:"Voir les "+(F.length-n0)+" autres"})); F.slice(n0).forEach(x=>d.appendChild(ligne(x))); fich.appendChild(d); }
      cote.querySelectorAll("li[data-t]").forEach(li=>{ li.hidden=!!q&&!norm(li.dataset.t).includes(q); }); };
    const liste=(titre,F,vide)=>{ const d=el("details",{className:"card"}), n=F.length; d.appendChild(el("summary",{textContent:titre+(n?" · "+n:"")})); const ul=el("ul",{});
      F.forEach(k=>{ const li=el("li",{textContent:lit(k).titre+(lit(k).auteur?" — "+lit(k).auteur:"")}); li.dataset.t=k.text; ul.appendChild(li); }); if(!n) d.appendChild(help(vide)); else d.appendChild(ul); return d; };
    const items=f=>rubs(cur).filter(f).flatMap(r=>(r.items||[]).filter(k=>k&&k.text&&!k.done));
    cote.append(liste("En cours de lecture",items(enCours),"Rien en cours."),liste("À lire",items(aLire),"Rien à lire pour l'instant."));
    /* un seul bouton : « + Ajouter un livre » */
    const add=el("button",{type:"button",className:"btn",textContent:"+ Ajouter un livre"}), form=el("form",{className:"lform card",hidden:true});
    const ti=el("input",{placeholder:"Titre (et auteur si tu veux)",maxLength:160,required:true}), qu=el("select",{}), ok=el("button",{type:"submit",className:"btn",textContent:"Ajouter"});
    ti.setAttribute("aria-label","Titre du livre"); qu.setAttribute("aria-label","Où le ranger"); [["a","À lire"],["e","En cours de lecture"]].forEach(([v,n])=>qu.appendChild(el("option",{value:v,textContent:n})));
    form.append(ti,qu,ok); add.onclick=()=>{ form.hidden=!form.hidden; if(!form.hidden) ti.focus(); };
    form.onsubmit=e=>{ e.preventDefault(); const v=ti.value.trim(); if(!v) return; const cc=cats.get(c.id)||cur, f=qu.value==="e"?enCours:aLire, r=rubs(cc).find(f)||rubs(cc).find(aLire);
      if(r){ majRub(cc,r,q=>Object.assign({},q,{items:[...(q.items||[]),{id:uid(),text:v,done:false}]})); window.lectureRend(A,c); } };
    cote.append(add,form); cols.append(fich,cote); z.append(rech,cols); rech.oninput=rend; rend(); pane.appendChild(z); };
})();
