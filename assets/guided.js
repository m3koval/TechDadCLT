'use strict';
(() => {
  const app = document.querySelector('.guided');
  if (!app) return;
  if(app.dataset.flow==='intake'&&app.querySelector('#intake').dataset.transportReady!=='true')return;
  const el = (tag, text, parent, cls) => { const n=document.createElement(tag); if(text) n.textContent=text; if(cls)n.className=cls; if(parent)parent.append(n); return n; };
  const anchor = (text, href, parent) => { const n=el('a',text,parent);n.href=href;return n; };
  // Enhance only after setup: the ordinary document remains usable on script failure.
  document.body.classList.add('guided-page');
  const dialog=el('dialog','',document.body,'flow-details');
  dialog.setAttribute('aria-label','Plan details and site information');
  const close=el('button','Close',dialog,'button light');close.type='button';close.onclick=()=>dialog.close();
  const detailBody=el('div','',dialog);
  const openDetails = (build) => {detailBody.replaceChildren();build(detailBody);dialog.showModal();close.focus();};
  document.querySelector('[data-site-info]').onclick=()=>openDetails(parent=>parent.append(document.querySelector('.footer')));
  dialog.addEventListener('close',()=>{const footer=dialog.querySelector('.footer');if(footer)document.body.append(footer);});
  if(app.dataset.flow==='intake') {
    document.querySelector('#intake-fallback').hidden=true;
    const form=document.querySelector('#intake'), steps=[...form.querySelectorAll('.intake-step')];
    const next=document.querySelector('#intake-next'), back=document.querySelector('#intake-back'), send=document.querySelector('#send-request'), review=document.querySelector('#intake-review');
    let index=0;
    steps.forEach(s=>{const c=s.querySelector('input,select,textarea');c.setAttribute('aria-describedby',`${c.id}-hint`);});
    const valid=()=>{const c=steps[index]?.querySelector('input,select,textarea');if(!c)return true;c.setCustomValidity(c.required&&!c.value.trim()?'Please enter a value, not only spaces.':'');return c.reportValidity();};
    form.addEventListener('input',e=>e.target.setCustomValidity?.(''));
    form.addEventListener('keydown',e=>{if(e.key==='Enter'&&index<6&&e.target.tagName!=='TEXTAREA'&&e.target.tagName!=='BUTTON'){e.preventDefault();if(valid()){index++;render();}}});
    const render=()=>{
      steps.forEach((s,i)=>s.hidden=i!==index);review.hidden=index<steps.length;
      document.querySelector('#intake-progress').textContent=index<6?`Free assessment · ${index+1} of 6`:'Review before sending';
      document.querySelector('#intake-title').textContent=index<6?steps[index].querySelector('label').textContent:'Ready to reach out?';
      steps.forEach(s=>s.querySelector('label').classList.add('sr-only'));
      back.hidden=index===0;next.hidden=index===6;send.hidden=index!==6;
      next.textContent=index===5?'Review request':'Next';
      if(index===6){review.replaceChildren();el('p','Free onsite assessment · About 45 minutes. We’ll discuss fit and scheduling—not a confirmed booking. Setup quoted separately.',review);
        const dl=el('dl','',review,'review-list');steps.forEach(s=>{const c=s.querySelector('input,select,textarea');el('dt',({name:'Name',email:'Email',area:'Area',who:'Help for',concern:'Concern',phone:'Phone'})[c.id],dl);el('dd',c.value||'Not provided',dl);});
        el('p','Send to TechDad CLT via Formspark. No quiz answers attached. No sensitive records, please. Not an emergency channel.',review,'small');
      }
      document.querySelector('#intake-title').focus({preventScroll:true});
    };
    next.onclick=()=>{if(valid()){index++;render();}};back.onclick=()=>{if(send.disabled)return;index--;render();};
    form.addEventListener('submit',e=>{if(index!==6){e.preventDefault();e.stopImmediatePropagation();if(valid()){index++;render();}}},true);
    render();return;
  }
  const screen=document.querySelector('#flow-screen'), progress=document.querySelector('#flow-progress'), status=document.querySelector('#flow-status');
  const back=document.querySelector('#flow-back'),next=document.querySelector('#flow-next');
  document.querySelector('.app-controls').hidden=false;
  let answers={},index=0,resultIndex=null,facts=null,loading=false;
  const kids=()=>answers.household!=='adult';
  const has=id=>(answers.devices||[]).includes(id);
  const q=(id,title,hint,options,multi=false)=>({id,title,hint,options,multi});
  const questions=()=>{
    const list=[q('household','Who is this plan for?','Start with the people, not a shopping list of apps.',[['kids','A child or children'],['adult','Myself / an independent adult'],['both','Children and adults']])];
    list.push(q('devices',kids()?'Which devices do the children use?':'Which devices need attention?','Select all that apply. Choose the user’s devices, not just a helper’s phone.',[['ios','iPhone / iPad'],['mac','Mac'],['android','Android'],['chrome','Chromebook'],['windows','Windows PC'],['xbox','Xbox'],['other','Other / not sure']],true));
    list.push(q('os','Are those devices up to date?','Exact OS support matters. No version numbers or account details needed.',[['current','Updates checked recently'],['older','Some are older / cannot update'],['unknown','I’m not sure']]));
    list.push(q('protection','What’s already in place?','We’ll build on what you have, rather than add another layer by default.',[['none','Nothing set up yet'],['native','Built-in settings only'],['paid','A paid safety or filtering tool'],['unknown','I’m not sure']]));
    list.push(kids()?q('goal','What matters most for the children?','Choose one priority for this starting plan.',[['routine','Time limits & app approvals'],['web','Explicit web content'],['messages','Concerning messages'],['scams','Safer accounts & scam awareness']]):q('goal','What would help most?','The adult stays in control of their accounts and any sharing.',[['scams','Suspicious calls & messages'],['accounts','Safer accounts & recovery'],['finance','Unusual financial activity'],['web','Self-chosen web restrictions']]));
    if(answers.household==='both')list.push(q('adultGoal','And the adults’ priority?','Separate support from the children’s supervision rules.',[['scams','Suspicious calls & messages'],['accounts','Safer accounts & recovery'],['finance','Unusual financial activity']]));
    if(kids()&&['web','messages','routine'].includes(answers.goal)&&['ios','android','mac','windows','chrome'].some(has))list.push(q('away','Are devices used away from home?','Home-router controls don’t automatically follow them.',[['yes','Yes, other Wi-Fi or cellular'],['no','Mostly at home'],['unknown','Not sure']]));
    if(kids()&&answers.goal==='messages'&&has('ios'))list.push(q('sync','Is a computer available for iOS scans?','Supported message scans need a collection method. They are not live access to every chat.',[['yes','Yes, we can check compatibility'],['no','No computer available'],['unknown','Not sure yet']]));
    return list;
  };
  const normalize=()=>{const ids=new Set(questions().map(x=>x.id));Object.keys(answers).forEach(k=>{if(!ids.has(k))delete answers[k];});};
  const adultAdvice=goal=>goal==='finance'?'Enable bank-native transaction alerts with the account owner. Agree who may see them; never share banking passwords.':goal==='accounts'?'Review recovery options, unique passwords and suitable passkeys or two-step verification with the account owner.':goal==='web'?'Agree on the adult’s own browsing goals and review browser safety settings. Any restrictions must be chosen with their informed consent.':'Practice a known-number callback routine. Review supported spam controls without silencing important calls.';
  const plan=()=>{
    const map={ios:'apple',mac:'apple',android:'google',chrome:'google',windows:'microsoft',xbox:'microsoft'};
    const nativeIds=kids()?[...new Set((answers.devices||[]).map(d=>map[d]).filter(Boolean))]:[];
    const native=nativeIds.map(id=>facts.products.find(p=>p.id===id));
    let candidate=null;
    // Conservative eligibility: a mixed/unknown/older inventory needs verification first.
    if(kids()&&answers.protection!=='paid'&&answers.protection!=='unknown'&&answers.os==='current') {
      if(answers.goal==='messages'&&(has('ios')||has('android'))&&!has('other'))candidate=facts.products.find(p=>p.id==='bark');
      // Source ledger does not certify exact Canopy OS versions: defer to compatibility review.
    }
    const baseline=kids()&&answers.goal==='scams'?'Review account recovery, unique passwords and suitable two-step verification. Practice a known-number callback routine together.':kids()?`${answers.protection==='none'?'Set up':'Review'} ${native.length?native.map(p=>p.name).join(', '):'the manufacturer’s family controls'}. Use child accounts, app/content rules and schedules; test each device.`:adultAdvice(answers.goal);
    const gap=answers.protection==='paid'?'Review the tool you already use before adding anything. Confirm its exact coverage and avoid overlapping VPN-based filters.':answers.protection==='unknown'?'Identify the existing settings and subscriptions first. We cannot tell what is missing until they are checked.':answers.os!=='current'?'Check OS versions and update support before choosing software. An unsupported device may need a separate plan.':answers.goal==='messages'?'Native controls do not read every conversation. Message-alert coverage depends on the exact app, OS and scan method.':answers.goal==='web'?'Web restrictions do not cover every app or encrypted conversation. Check the exact device and browser before choosing an additional filter.':'Try the baseline first. No paid filter is needed by default for this priority.';
    return {native,candidate,baseline,gap};
  };
  const heading=(text)=>{const h=el('h1',text,screen);h.tabIndex=-1;return h;};
  const focus=()=>screen.querySelector('h1').focus({preventScroll:true});
  const restart=()=>{answers={};index=0;resultIndex=null;render();};
  const detail=()=>openDetails(parent=>{const p=plan();el('h2','Your plan, with the details',parent);el('p',p.baseline,parent);el('p',p.gap,parent);if(answers.household==='both')el('p',adultAdvice(answers.adultGoal),parent);[...p.native,...(p.candidate?[p.candidate]:[])].forEach(product=>{el('h3',product.name,parent);['price','billing','devices','coverage','limits'].forEach(k=>el('p',product[k],parent));anchor('Official product details',product.source,parent);if(product.support)anchor('Official support',product.support,parent);});el('p',`Product facts reviewed ${facts.checked}. ${facts.basis}`,parent);el('p','No tool guarantees protection. Confirm exact installed OS and app support before buying. Never combine VPN-based filters without explicit vendor support. Keep existing hardware unless a specific gap requires a change.',parent);});
  const download=()=>{const p=plan();const text=['TechDad CLT — starting plan',p.baseline,p.gap,answers.household==='both'?adultAdvice(answers.adultGoal):'',p.candidate?`${p.candidate.name}: ${p.candidate.coverage}\n${p.candidate.price}\n${p.candidate.billing}\n${p.candidate.limits}\n${p.candidate.source}`:'No paid tool selected.',...p.native.map(n=>`${n.name}: ${n.limits}\n${n.source}`),'Test the settings on each device. No tool guarantees protection. Implementation is quoted separately.',`Source review: ${facts.checked}. ${facts.basis}`].filter(Boolean).join('\n\n');const url=URL.createObjectURL(new Blob([text],{type:'text/plain'}));const a=anchor('',url,document.body);a.download='techdad-starting-plan.txt';a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const render=()=>{
    status.textContent='';screen.replaceChildren();back.disabled=index===0&&resultIndex===null;next.disabled=false;
    if(resultIndex!==null){const p=plan();const pages=p.candidate?['baseline','tool','next']:['baseline','next'];const key=pages[resultIndex];progress.textContent=`Your plan · ${resultIndex+1} of ${pages.length}`;
      if(key==='baseline'){heading('Your free starting point.');el('p',p.baseline,screen,'result-lead');el('h2','The remaining gap',screen);el('p',p.gap,screen);if(answers.household==='both')el('p',adultAdvice(answers.adultGoal),screen,'small');}
      if(key==='tool'){heading('One optional candidate.');el('h2',p.candidate.name,screen);el('p','For supported content-risk alerts—not a transcript of every conversation. Confirm your exact apps and OS before buying.',screen);el('p',p.candidate.price,screen,'result-lead');el('p',has('ios')?(answers.sync==='yes'?'Check your existing computer first. iOS scans need a supported method and alerts can be delayed.':'Without a confirmed computer, review a supported method such as optional Bark Sync and its separate cost. Don’t buy hardware until fit is confirmed.'):'Check Android permissions and the current app-coverage matrix. Not every message or app is supported.',screen);el('p',answers.away==='yes'?'Away from home: test supported filtering and scan timing separately. No instant-alert promise.':'Test scan timing and alert delivery. No tool replaces conversations.',screen,'small');}
      if(key==='next'){heading('Make one useful change.');el('ol','',screen,'next-steps');const list=screen.querySelector('ol');[kids()?'Agree on one rule. Test each device.':'Choose one change with permission.',answers.away==='yes'?'Test at home, away and after a restart.':'Recheck after restarts and updates.','Note what works and what needs help.'].forEach(t=>el('li',t,list));el('p','Keep your router. Any setup help is quoted separately.',screen,'small');const links=el('div','',screen,'result-actions');anchor('Contact TechDad (optional)','/Intakeform.html',links);const d=el('button','Download local summary',links,'plain-button');d.type='button';d.onclick=download;el('p','Separate contact form. No quiz answers attached.',screen,'small');}
      const details=el('button','Details & sources',screen,'plain-button');details.type='button';details.onclick=detail;
      next.textContent=key==='next'?'Start again':'Next';focus();return;
    }
    const list=questions(),question=list[index];progress.textContent=`Question ${index+1} of ${list.length}${index<4?' · adapts to your answers':''}`;
    heading(question.title);el('p',question.hint,screen,'question-hint');const group=el('fieldset','',screen,'choices');const legend=el('legend',question.title,group,'sr-only');
    question.options.forEach(([value,label])=>{const tile=el('label','',group,'choice');const input=el('input','',tile);input.type=question.multi?'checkbox':'radio';input.name=question.id;input.value=value;input.checked=question.multi?(answers[question.id]||[]).includes(value):answers[question.id]===value;el('span',label,tile);input.onchange=()=>{const previous=answers[question.id];answers[question.id]=question.multi?[...group.querySelectorAll('input:checked')].map(i=>i.value):value;if(question.id==='household'&&previous!==value){delete answers.goal;delete answers.adultGoal;if(previous==='adult'||value==='adult'){delete answers.devices;delete answers.os;delete answers.protection;}}normalize();next.textContent=index===questions().length-1?'See my plan':'Next';progress.textContent=`Question ${index+1} of ${questions().length} · adapts to your answers`;};});
    next.textContent=index===list.length-1?'See my plan':'Next';focus();
  };
  back.onclick=()=>{if(loading)return;if(resultIndex!==null){if(resultIndex>0)resultIndex--;else{resultIndex=null;index=questions().length-1;}}else index--;render();};
  next.onclick=async()=>{
    if(loading)return;
    if(resultIndex!==null){const last=plan().candidate?2:1;if(resultIndex===last)restart();else{resultIndex++;render();}return;}
    const question=questions()[index];if(!answers[question.id]||(question.multi&&!answers[question.id].length)){status.textContent='Choose an option to continue.';screen.querySelector('input')?.focus();return;}
    if(index<questions().length-1){index++;render();return;}
    loading=true;next.disabled=true;back.disabled=true;status.textContent='Preparing your starting plan…';
    try {if(!facts){const response=await fetch('/assets/products.json',{credentials:'omit'});if(!response.ok)throw Error();facts=await response.json();if(!Array.isArray(facts.products)||!['apple','google','microsoft','bark'].every(id=>facts.products.some(p=>p.id===id&&['name','price','billing','coverage','limits','source'].every(k=>typeof p[k]==='string'))))throw Error();}resultIndex=0;render();}
    catch(_){facts=null;resultIndex=null;status.textContent='The product details could not load. Your answers are still here. Try again or use the assessment guide.';next.disabled=false;back.disabled=false;}
    finally{loading=false;}
  };
  render();
})();
