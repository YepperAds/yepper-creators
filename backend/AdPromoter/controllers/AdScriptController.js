// AdScriptController.js
// Universal one-script ad loader — works on any framework/language.
// Supports multiple spaces per site, smart auto-placement by spaceType,
// and ad-blocker evasion via neutral class names and randomized identifiers.

const AdCategory = require('../models/CreateCategoryModel');
const { notifyDomainMismatch } = require('../../creators/utils/notificationUtils');
const { placementCSS } = require('../utils/adSpaceLayout');

// Only Floating and Modal are truly position-independent (position:fixed,
// appended straight to <body>). Everything else now ships as a
// precise-placement iframe instead (see serveAdEmbed / codeDisplay.tsx) —
// this script must not also auto-guess a spot for those, or the owner ends
// up with a duplicate ad next to the iframe they placed.
const AUTO_RELIABLE = ['floating', 'modalpic'];

function extractDomain(url) {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '');
  } catch { return null; }
}

// ── Ad-blocker evasion: rotate neutral wrapper names ──────────
const WRAPPER_ALIASES = [
  'content-widget', 'page-module', 'site-section',
  'layout-block', 'view-unit', 'frame-item',
  'display-zone', 'content-box', 'media-section',
  'page-element', 'render-block', 'ui-widget',
];

function neutralClass(scriptId) {
  const idx = parseInt(scriptId.slice(-2), 16) % WRAPPER_ALIASES.length;
  return WRAPPER_ALIASES[idx];
}

// ── Position CSS per spaceType ────────────────────────────────
// Delegates to the shared table in utils/adSpaceLayout.js (also used by
// SiteScriptController.js) instead of keeping its own hand-copied variant —
// this file previously drifted out of sync with the site-wide script's
// version of the same sizing rules.
function placementStyles(spaceType, prefix) {
  return placementCSS(spaceType, prefix);
}

// ─────────────────────────────────────────────────────────────
exports.serveAdScript = async (req, res) => {
  try {
    const { scriptId } = req.params;

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(scriptId)) {
      res.setHeader('Content-Type', 'application/javascript');
      return res.status(400).send('// Invalid ad space ID');
    }

    const adCategory = await AdCategory.findById(scriptId);
    if (!adCategory) return res.status(404).send('// Ad space not found');

    const { query } = require('../../config/db');
    const { rows: wsRows } = await query(
      `SELECT * FROM websites WHERE id = $1`, [adCategory.website_id]
    );
    adCategory.websiteId = wsRows[0] || null;

    const registeredDomain = adCategory.websiteId?.website_link
      ? extractDomain(adCategory.websiteId.website_link)
      : null;

    // Server-side referer check (first layer)
    if (registeredDomain) {
      const referer = req.headers.referer || req.headers.origin || '';
      const incoming = referer ? extractDomain(referer) : null;
      if (incoming && incoming !== registeredDomain) {
        notifyDomainMismatch(adCategory.websiteId.owner_id, adCategory.websiteId.id, registeredDomain, incoming).catch(() => {});
        res.setHeader('Content-Type', 'application/javascript');
        return res.send('/* invalid domain */');
      }
    }

    const BACKEND  = process.env.BACKEND_URL || '';
    const FRONTEND = process.env.FRONTEND_URL || '';

    // Use stealth API paths (/api/p, /api/c) so generated URLs don't match
    // common ad-blocker filter patterns like "/api/ads/" or "/ad-categories/"
    const API_BASE  = `${BACKEND}/api/p`;
    const CAT_BASE  = `${BACKEND}/api/c`;

    const categoryPrice   = adCategory.price;
    const defaultLanguage = adCategory.default_language || 'english';
    const websiteId       = adCategory.websiteId.id;
    const websiteName     = adCategory.websiteId.website_name || 'This website';
    const categoryName    = adCategory.category_name || 'ad space';
    const spaceType       = adCategory.space_type || 'Inline Content';

    // Evasion: neutral wrapper alias based on category id
    const wrapAlias = neutralClass(scriptId);
    // Unique prefix per category — avoids collision when multiple spaces on same page
    const prefix = 'yw' + scriptId.slice(-6);
    const timestamp = Date.now();

    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('ETag', `"${scriptId}-${timestamp}"`);

    const script = `
(function(){
  var _allowed = "${registeredDomain || ''}";
  if (_allowed) {
    var _current = window.location.hostname.replace(/^www\\./, '');
    if (_current !== _allowed) return; // wrong site — bail, nothing runs
  }

  /* Yepper display unit — ${categoryName} */
  var D=document,
      _i="${scriptId}",
      _w="${websiteId}",
      _b="${API_BASE}",
      _c="${CAT_BASE}",
      _f="${FRONTEND}",
      _p=${categoryPrice},
      _l="${defaultLanguage}",
      _tAd=7000,
      _tEmpty=3000,
      _sp="${spaceType}",
      _name=${JSON.stringify(categoryName)},
      _px="${prefix}",
      _wa="${wrapAlias}",
      _pageLoadTs=Date.now();

  /* ── Genie show/hide animation for floating ads ───────── */
  function injectAnimCSS(){
    if(D.getElementById('_ys_anim'))return;
    var s=D.createElement('style');
    s.id='_ys_anim';
    s.textContent=
      '@keyframes ywGenieIn{'+
        '0%{opacity:0;transform:scale(.4) translate(18%,18%);}'+
        '60%{opacity:1;transform:scale(1.03) translate(-1%,-1%);}'+
        '100%{opacity:1;transform:scale(1) translate(0,0);}'+
      '}'+
      '@keyframes ywGenieOut{'+
        '0%{opacity:1;transform:scale(1) translate(0,0);}'+
        '100%{opacity:0;transform:scale(.4) translate(18%,18%);}'+
      '}'+
      '@keyframes ywFloatBob{0%,100%{transform:translateY(0);}50%{transform:translateY(-8px);}}'+
      '.yw-genie-pre{opacity:0;transform:scale(.4) translate(18%,18%);}'+
      '.yw-genie-in{animation:ywGenieIn .45s cubic-bezier(.16,1,.3,1) forwards;}'+
      '.yw-genie-out{animation:ywGenieOut .32s cubic-bezier(.7,0,.84,0) forwards;}'+
      '.yw-float-bob{animation:ywFloatBob 4.5s ease-in-out infinite;}';
    D.head.appendChild(s);
  }

  function revealFloating(host){
    host.classList.remove('yw-genie-out');
    host.classList.remove('yw-genie-pre');
    host.style.display='block';
    void host.offsetWidth; /* force reflow so the browser registers the class swap */
    host.classList.add('yw-genie-in');
    var onIn=function(e){
      if(e.target!==host||e.animationName!=='ywGenieIn')return;
      host.removeEventListener('animationend',onIn);
      host.classList.remove('yw-genie-in');
      host.classList.add('yw-float-bob');
    };
    host.addEventListener('animationend',onIn);
  }

  function hideFloating(host){
    host.classList.remove('yw-float-bob');
    host.classList.remove('yw-genie-in');
    host.classList.add('yw-genie-out');
    var onOut=function(e){
      if(e.target!==host||e.animationName!=='ywGenieOut')return;
      host.removeEventListener('animationend',onOut);
      host.classList.remove('yw-genie-out');
      host.classList.add('yw-genie-pre');
      host.style.display='none';
    };
    host.addEventListener('animationend',onOut);
  }

  function scheduleFloatingIntro(host){
    if(host.dataset.ywIntroScheduled)return;
    host.dataset.ywIntroScheduled='1';
    var wait=Math.max(0,3000-(Date.now()-_pageLoadTs));
    setTimeout(function(){revealFloating(host);},wait);
  }

  /* ── 1. Inject styles ──────────────────────────────────── */
  /* Each ad slot in this category is styled independently — slot 0's
     template/color/font never bleeds into slot 1. \`data\` is the resolved
     response from /ads/customization (one fully-resolved bundle per slot,
     already defaulted to plain white+shadow — no dark-mode auto-adaptation,
     that's gone for good). */
  function injectStyles(data){
    var sid='_ys_'+_i;
    var el=D.getElementById(sid);
    if(!el){el=D.createElement('style');el.id=sid;D.head.appendChild(el);}

    var placementCss="${placementStyles(spaceType, prefix).replace(/\n/g,' ').replace(/"/g,'\\"')}";

    var fontCss='';
    (data.fontImports||[]).forEach(function(fi){
      fontCss+='@import url(https://fonts.googleapis.com/css2?'+fi+'&display=swap);';
    });

    var slots=data.slots||[];
    /* Safety net for any item whose slot index has no resolved bundle
       (customization fetch failed, or more items than configured slots) —
       plain white+shadow, same as the system default, instead of unstyled. */
    var rulesCss='.'+_px+'-ad{display:block;width:100%;overflow:hidden;background:#fff;border:1px solid rgba(0,0,0,0.08);border-radius:16px;box-shadow:0 8px 32px rgba(31,38,135,0.18);box-sizing:border-box;text-decoration:none;color:inherit;}';
    slots.forEach(function(s,si){
      var isH=s.imagePosition==='left';
      var flexDir=isH?'row':'column';
      var sel='.'+_px+'-ad[data-slot="'+si+'"]';
      rulesCss+=\`
        \${sel}{
          display:block;
          width:\${s.width?s.width+'px':'100%'};
          max-width:\${s.maxWidth||100}%;
          height:\${s.height?s.height+'px':'auto'};
          text-decoration:none;
          overflow:hidden;
          background:\${s.backgroundColor};
          border:\${s.borderWidth}px solid \${s.borderColor};
          border-radius:\${s.borderRadius||16}px;
          box-shadow:\${s.shadowCss};
          transition:all 0.3s ease;
          position:relative;
          color:inherit;
          padding:\${s.padding||0}px;
          box-sizing:border-box;
          font-family:\${s.fontStack};
        }
        \${sel}:hover{transform:translateY(-2px);box-shadow:0 12px 36px rgba(31,38,135,0.28);}
        \${sel} .\${_px}-inner{display:flex;flex-direction:\${flexDir};gap:16px;align-items:\${isH?'center':'stretch'};padding:14px;}
        \${sel} .\${_px}-img-wrap{overflow:hidden;border-radius:10px;flex-shrink:0;\${isH?'flex:0 0 '+(s.imageWidthPercent||40)+'%;min-width:120px;':'width:'+(s.topImageWidthPercent||100)+'%;margin:0 auto;height:'+(s.imageHeight||160)+'px;'}\${s.showImage===false?'display:none;':''}}
        \${sel} .\${_px}-text{flex:1;display:flex;flex-direction:column;justify-content:center;min-width:0;}
        \${sel} .\${_px}-title{font-size:\${s.titleSize||16}px;font-weight:600;color:\${s.titleColor};margin:0 0 8px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
        \${sel} .\${_px}-desc{font-size:\${s.descriptionSize||14}px;color:\${s.descriptionColor};line-height:1.5;margin:0 0 12px;display:-webkit-box;-webkit-line-clamp:\${isH?2:3};-webkit-box-orient:vertical;overflow:hidden;\${s.showDescription===false?'display:none;':''}}
        \${sel} .\${_px}-cta{display:inline-flex;align-items:center;align-self:flex-start;background:\${s.ctaBackground};color:\${s.ctaColor};padding:8px 22px;border-radius:8px;font-size:\${s.ctaSize||14}px;font-weight:500;transition:all 0.2s ease;\${s.showCTA===false?'display:none;':''}}
        \${sel} .\${_px}-cta:hover{opacity:0.85;}
      \`;
      if(s.customCSS){
        rulesCss+=s.customCSS
          .replace(/\\.ad-container/g,sel)
          .replace(/\\.ad-title/g,sel+' .'+_px+'-title')
          .replace(/\\.ad-description/g,sel+' .'+_px+'-desc')
          .replace(/\\.ad-cta/g,sel+' .'+_px+'-cta')
          .replace(/\\.ad-image/g,sel+' .'+_px+'-img');
      }
    });

    /* Floating's host has a fixed width baked into placementStyles() so it
       looks right with zero configuration — override it once the first
       slot sets a custom width, so the size control actually has an effect. */
    var hostOverride='';
    if(_sp.toLowerCase()==='floating'&&slots[0]&&slots[0].width){
      hostOverride='.'+_px+'-host{width:'+slots[0].width+'px;}';
    }

    el.textContent=placementCss+fontCss+rulesCss+hostOverride+\`
      .\${_px}-img{width:100%;height:100%;object-fit:cover;display:block;transition:transform 0.3s ease;}
      .\${_px}-ad:hover .\${_px}-img{transform:scale(1.03);}
      .\${_px}-credit{font-size:9px;color:rgba(0,0,0,0.4);padding:4px 8px;text-align:right;}
      .\${_px}-credit a{color:inherit;text-decoration:none;}
      .\${_px}-empty{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:12px 20px;padding:14px 20px;text-align:center;background:#fff;box-shadow:0 8px 32px rgba(31,38,135,0.18);border-radius:12px;}
      .\${_px}-empty-name{flex-basis:100%;font-size:10px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#999;margin:0;}
      .\${_px}-empty-title{font-size:14px;font-weight:600;margin:0;}
      .\${_px}-empty-price{font-size:12px;color:#555;margin:0;}
      .\${_px}-empty-cta{display:inline-flex;align-items:center;flex-shrink:0;background:#000;color:#fff;padding:8px 20px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;transition:background 0.2s;}
      .\${_px}-empty-cta:hover{background:#e84118;}
    \`;
  }

  /* ── 2. Find or create host container ──────────────────── */
  var _AUTO=${JSON.stringify(AUTO_RELIABLE)};
  function getHost(){
    var existing=D.querySelector('[data-yid="'+_i+'"]');
    if(existing)return existing;

    var host=D.createElement('div');
    /* neutral class name to evade simple block-lists */
    host.className=_px+'-host '+_wa;
    host.setAttribute('data-yid',_i);

    /* An explicit placeholder div always wins, for any spaceType. */
    var ph=D.querySelector('[data-yepper-space="'+_i+'"]')||
           D.querySelector('[data-yepper-ad="'+_i+'"]');
    if(ph){ph.appendChild(host);return host;}

    /* No placeholder: only Floating/Modal auto-place. Everything else ships
       as a precise-placement iframe — bail instead of guessing a spot, so
       this script doesn't render a duplicate next to that iframe. */
    var sp=_sp.toLowerCase();
    if(_AUTO.indexOf(sp)===-1)return null;

    if(sp==='floating'){
      host.style.transformOrigin='bottom right';
      host.classList.add('yw-genie-pre');
    }

    D.body.appendChild(host);
    return host;
  }

  /* ── 3. Render translations ────────────────────────────── */
  var TR={
    english:{title:'Available Advertising Space',price:'Price',cta:'Advertise Here'},
    french:{title:'Espace Publicitaire Disponible',price:'Prix',cta:'Annoncez Ici'},
    kinyarwanda:{title:'Kwamamaza',price:"Igiciro cy'ukwezi",cta:'Kanda Hano'},
    kiswahili:{title:'Nafasi ya Matangazo',price:'Bei',cta:'Tangaza Hapa'},
    chinese:{title:'可用广告空间',price:'价格',cta:'在此广告'},
    spanish:{title:'Espacio Publicitario Disponible',price:'Precio',cta:'Anuncie Aquí'}
  };

  function getLang(){
    var l=_l;
    if(!TR[l]){
      var ul=(navigator.language||'en').toLowerCase().split('-')[0];
      l={fr:'french',rw:'kinyarwanda',sw:'kiswahili',zh:'chinese',es:'spanish'}[ul]||'english';
    }
    return TR[l];
  }

  function escHtml(s){
    return String(s==null?'':s).replace(/[&<>"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function emptyState(host){
    var lang=getLang();
    host.innerHTML=
      '<div class="'+_px+'-empty">'+
        '<p class="'+_px+'-empty-name">'+escHtml(_name)+'</p>'+
        '<p class="'+_px+'-empty-title">'+lang.title+'</p>'+
        '<p class="'+_px+'-empty-price">'+lang.price+': RWF'+_p+'/month</p>'+
        '<a class="'+_px+'-empty-cta" href="'+_f+'/ad-owner/pages/direct-ad?websiteId='+_w+'&categoryId='+_i+'" target="_blank" rel="noopener">'+lang.cta+'</a>'+
      '</div>';
    addDismissButton(host);
    if(_sp==='Floating')scheduleFloatingIntro(host);
  }

  /* ── Dismiss button (floating reappears after 40s) ─────── */
  function addDismissButton(host){
    if(_sp==='overlay'||_sp==='modalPic'){
      var btn=D.createElement('button');
      btn.textContent='×';
      btn.style.cssText='position:absolute;top:12px;right:16px;font-size:28px;background:none;border:none;cursor:pointer;color:#fff;z-index:1;';
      btn.onclick=function(){host.style.display='none';};
      host.style.position='fixed';
      host.appendChild(btn);
    }
    if(_sp==='Floating'){
      var fbtn=D.createElement('button');
      fbtn.textContent='×';
      fbtn.style.cssText='position:absolute;top:-10px;right:-10px;width:24px;height:24px;border-radius:50%;background:#000;color:#fff;font-size:15px;line-height:24px;text-align:center;border:none;cursor:pointer;z-index:2;padding:0;box-shadow:0 1px 4px rgba(0,0,0,0.3);';
      fbtn.onclick=function(){
        hideFloating(host);
        setTimeout(function(){revealFloating(host);},40000);
      };
      host.appendChild(fbtn);
    }
  }

  function credit(){
    return '<div class="'+_px+'-credit">Ad by <a href="'+_f+'" target="_blank" rel="noopener">Yepper</a> · '+escHtml(_name)+'</div>';
  }

  /* ── 4. Render ads ─────────────────────────────────────── */
  function renderAds(host,data){
    if(!data||!data.html){emptyState(host);return;}

    /* Remap generic class names to scoped prefix */
    var html=data.html
      .replace(/sp-container/g,_px+'-wrap')
      .replace(/sp-item/g,_px+'-ad')
      .replace(/sp-link/g,_px+'-link')
      .replace(/sp-content/g,_px+'-inner')
      .replace(/sp-image-wrapper/g,_px+'-img-wrap')
      .replace(/sp-image/g,_px+'-img')
      .replace(/sp-text-content/g,_px+'-text')
      .replace(/sp-business-name/g,_px+'-title')
      .replace(/sp-description/g,_px+'-desc')
      .replace(/sp-cta/g,_px+'-cta');

    host.innerHTML=credit()+html;

    var items=Array.from(host.querySelectorAll('.'+_px+'-ad'));
    if(!items.length){emptyState(host);return;}

    /* Hide all except first; tag each with its slot index so injectStyles'
       per-slot rules (background/colors/font/size) apply to the right one. */
    items.forEach(function(el,idx){
      el.style.display=idx===0?'block':'none';
      el.setAttribute('data-slot',idx);
    });

    /* Track views + clicks */
    function trackView(adId){
      if(!adId||adId==='undefined')return;
      try{
        navigator.sendBeacon(_b+'/ev/'+adId+'?cid='+_i,'{}');
      }catch(e){
        fetch(_b+'/ev/'+adId+'?cid='+_i,{method:'POST',mode:'cors',credentials:'omit'}).catch(function(){});
      }
    }

    items.forEach(function(el){
      var adId=el.dataset.adId;
      var lnk=el.querySelector('.'+_px+'-link')||el.querySelector('a');
      if(!lnk)return;
      var href=lnk.href;
      lnk.removeAttribute('href');
      lnk.style.cursor='pointer';
      lnk.addEventListener('click',function(ev){
        ev.preventDefault();
        if(adId&&adId!=='undefined'){try{navigator.sendBeacon(_b+'/ec/'+adId+'?cid='+_i,'{}');}catch(e){}}
        setTimeout(function(){window.open(href,'_blank','noopener');},80);
      });
    });

    addDismissButton(host);
    if(_sp==='Floating')scheduleFloatingIntro(host);

    if(items.length>1){
      var cur=0;
      var firstAdId = items[cur].dataset.adId;
      if(firstAdId && firstAdId !== 'undefined') trackView(firstAdId);
      /* Real ads get more time on screen than the "Available Ad Space"
         filler — a recursive setTimeout (not setInterval) so each item's
         own dwell time decides the next swap, instead of one fixed period
         for everything. */
      (function scheduleNext(){
        var curAdId=items[cur].dataset.adId;
        var dwell=(curAdId && curAdId!=='undefined')?_tAd:_tEmpty;
        setTimeout(function(){
          items[cur].style.display='none';
          cur=(cur+1)%items.length;
          items[cur].style.display='block';
          var rotId = items[cur].dataset.adId;
          if(rotId && rotId !== 'undefined') trackView(rotId);
          scheduleNext();
        },dwell);
      })();
    } else {
      var firstId = items[0] && items[0].dataset && items[0].dataset.adId;
      if (firstId && firstId !== 'undefined') trackView(firstId);
    }
  }

  /* ── 5. Load customization then ads ───────────────────── */
  function placeSpace(){
    /* Already live? (querySelector only matches nodes still attached to the
       document, so this is false if an SPA re-render wiped the host out.) */
    if(D.querySelector('[data-yid="'+_i+'"]'))return;

    /* Use a neutral param name to avoid common blocker rules */
    var ck='?z='+_i+'&r='+Math.random().toString(36).slice(2);

    fetch(_c+'/ads/customization/'+_i+ck,{cache:'no-store'})
      .then(function(r){return r.ok?r.json():Promise.resolve({slots:[],fontImports:[]});})
      .then(function(d){
        injectStyles(d);
        var host=getHost();
        if(!host)return; /* not auto-reliable and no placeholder — skip, the iframe is the intended path */

        fetch(_b+'/feed?categoryId='+_i+'&path='+encodeURIComponent(location.pathname)+'&r='+Date.now(),{cache:'no-store'})
          .then(function(r){return r.ok?r.json():null;})
          .then(function(data){renderAds(host,data);})
          .catch(function(){emptyState(host);});
      })
      .catch(function(){
        injectStyles({slots:[],fontImports:[]});
        var host=getHost();
        if(!host)return;
        fetch(_b+'/feed?categoryId='+_i+'&path='+encodeURIComponent(location.pathname),{cache:'no-store'})
          .then(function(r){return r.ok?r.json():null;})
          .then(function(data){renderAds(host,data);})
          .catch(function(){emptyState(host);});
      });
  }

  /* ── SPA route-change support ─────────────────────────── */
  /* Single-page apps (Next.js, React Router, Vue Router, etc.) navigate
     without a full reload, so a one-shot DOMContentLoaded init() only ever
     runs on the very first page, and a framework re-render can wipe the
     host out without this script ever knowing. Wrapping pushState/
     replaceState + listening for popstate catches both. */
  function hookSpaNavigation(){
    try{
      var onRouteChange=function(){ setTimeout(placeSpace,80); };
      window.addEventListener('popstate',onRouteChange);
      var _push=history.pushState,_replace=history.replaceState;
      history.pushState=function(){ var r=_push.apply(history,arguments); onRouteChange(); return r; };
      history.replaceState=function(){ var r=_replace.apply(history,arguments); onRouteChange(); return r; };
    }catch(e){}
  }

  function init(){
    injectAnimCSS();
    placeSpace();
    hookSpaNavigation();

    /* Listen for live customization refreshes */
    try{
      var bc=new BroadcastChannel('yepper_ads');
      bc.onmessage=function(ev){
        if(ev.data&&ev.data.categoryId===_i)location.reload();
      };
    }catch(e){}
  }

  D.readyState==='loading'?D.addEventListener('DOMContentLoaded',init):init();
})();
`;

    res.send(script);
  } catch (err) {
    console.error('AdScriptController error:', err);
    res.status(500).send('// Error loading ad unit');
  }
};

// ── Iframe embed (for spaceTypes the script can't reliably auto-place — sidebar,
// inline content, in-feed, etc.) ─────────────────────────────────────────────
// The owner drops <iframe src="…"> exactly where they want the ad. Because an
// iframe is a separate document, it can't be touched by the host page's own
// framework re-renders (React/Vue own the <iframe> element itself, never its
// contents) and doesn't depend on querySelector finding a placeholder div —
// see the integration-format discussion this came out of.
function blankEmbedPage() {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0"></body></html>';
}

// Each ad slot is styled independently (slot 0's template/color/font never
// bleeds into slot 1's) — `slots` is the fully-resolved per-slot bundle list
// from resolveAllSlots, already defaulted to plain white+shadow with no
// dark-mode auto-adaptation.
function buildEmbedCardCss(prefix, slots, fontImports) {
  let css = `
    html,body{margin:0;padding:0;height:100%;}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
    .${prefix}-ad{display:block;width:100%;height:100%;text-decoration:none;overflow:hidden;background:#fff;border:1px solid rgba(0,0,0,0.1);border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);position:relative;color:inherit;box-sizing:border-box;}
    .${prefix}-img{width:100%;height:100%;object-fit:cover;display:block;}
    .${prefix}-credit{position:absolute;bottom:2px;right:6px;font-size:8px;color:rgba(0,0,0,0.35);}
    .${prefix}-credit a{color:inherit;text-decoration:none;}
    .${prefix}-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.08);border-radius:12px;padding:10px;box-sizing:border-box;}
    .${prefix}-empty-name{font-size:9px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#999;margin:0 0 4px;}
    .${prefix}-empty-title{font-size:13px;font-weight:600;margin:0 0 4px;}
    .${prefix}-empty-price{font-size:11px;color:#555;margin:0 0 10px;}
    .${prefix}-empty-cta{display:inline-flex;align-items:center;background:#000;color:#fff;padding:6px 16px;border-radius:6px;font-size:11px;font-weight:600;text-decoration:none;}
  `;

  (fontImports || []).forEach(fi => {
    css += `@import url(https://fonts.googleapis.com/css2?${fi}&display=swap);`;
  });

  (slots || []).forEach((s, si) => {
    const isH = s.imagePosition === 'left';
    const flexDir = isH ? 'row' : 'column';
    const sel = `.${prefix}-ad[data-slot="${si}"]`;
    // The iframe is a fixed size set by its own width/height attributes (not
    // this customization), so imageHeight (a px value meant for a free-standing
    // card) gets translated into a proportional share of whatever room the
    // iframe actually has, instead of being applied as a literal pixel height
    // that could overflow a short iframe like a 728x90 leaderboard.
    const topImageShare = Math.round(Math.min(75, Math.max(25, (s.imageHeight / (s.imageHeight + 140)) * 100)));
    css += `
      ${sel}{background:${s.backgroundColor};border:${s.borderWidth}px solid ${s.borderColor};border-radius:${s.borderRadius ?? 12}px;box-shadow:${s.shadowCss};font-family:${s.fontStack};}
      ${sel} .${prefix}-inner{display:flex;flex-direction:${flexDir};gap:10px;align-items:${isH ? 'center' : 'stretch'};height:100%;padding:10px;box-sizing:border-box;}
      ${sel} .${prefix}-img-wrap{overflow:hidden;border-radius:8px;flex-shrink:0;${isH ? `flex:0 0 ${s.imageWidthPercent || 40}%;min-width:80px;` : `width:${s.topImageWidthPercent || 100}%;margin:0 auto;flex:0 0 ${topImageShare}%;`}${s.showImage === false ? 'display:none;' : ''}}
      ${sel} .${prefix}-text{flex:1;display:flex;flex-direction:column;justify-content:center;min-width:0;}
      ${sel} .${prefix}-title{font-size:${s.titleSize || 14}px;font-weight:600;color:${s.titleColor};margin:0 0 4px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      ${sel} .${prefix}-desc{font-size:${s.descriptionSize || 12}px;color:${s.descriptionColor};line-height:1.4;margin:0 0 8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;${s.showDescription === false ? 'display:none;' : ''}}
      ${sel} .${prefix}-cta{display:inline-flex;align-items:center;align-self:flex-start;background:${s.ctaBackground};color:${s.ctaColor};padding:5px 14px;border-radius:6px;font-size:${s.ctaSize || 12}px;font-weight:500;${s.showCTA === false ? 'display:none;' : ''}}
    `;
    if (s.customCSS) {
      css += s.customCSS
        .replace(/\.ad-container/g, sel)
        .replace(/\.ad-title/g, `${sel} .${prefix}-title`)
        .replace(/\.ad-description/g, `${sel} .${prefix}-desc`)
        .replace(/\.ad-cta/g, `${sel} .${prefix}-cta`)
        .replace(/\.ad-image/g, `${sel} .${prefix}-img`);
    }
  });

  return css;
}

exports.serveAdEmbed = async (req, res) => {
  try {
    const { categoryId } = req.params;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(categoryId)) return res.status(400).send(blankEmbedPage());

    const { resolveCategoryAndAds, escapeHtml } = require('./AdDisplayController');
    const { resolveAllSlots, truncateWords } = require('../utils/adCustomization');
    const { adCategory, ads } = await resolveCategoryAndAds(categoryId, req);
    if (!adCategory) return res.status(404).send(blankEmbedPage());

    const BACKEND  = process.env.BACKEND_URL || '';
    const FRONTEND = process.env.FRONTEND_URL || '';
    const API_BASE = `${BACKEND}/api/p`;
    const prefix = 'ye' + categoryId.slice(-6);
    const websiteId = adCategory.website_id;
    const categoryPrice = adCategory.price;
    const categoryName = escapeHtml(adCategory.category_name || 'Ad Space');
    const { slots, fontImports } = resolveAllSlots(adCategory.customization, adCategory.user_count);
    const cardCss = buildEmbedCardCss(prefix, slots, fontImports);

    let bodyHtml;
    if (!ads.length) {
      bodyHtml = `
        <div class="${prefix}-empty">
          <p class="${prefix}-empty-name">${categoryName}</p>
          <p class="${prefix}-empty-title">Available Advertising Space</p>
          <p class="${prefix}-empty-price">Price: RWF ${categoryPrice}/month</p>
          <a class="${prefix}-empty-cta" href="${FRONTEND}/ad-owner/pages/direct-ad?websiteId=${websiteId}&categoryId=${categoryId}" target="_blank" rel="noopener">Advertise Here</a>
        </div>`;
    } else {
      const adCards = ads.map(ad => {
        const imageUrl = escapeHtml(ad.image_url || '');
        const targetUrl = escapeHtml((ad.business_link || '').startsWith('http') ? ad.business_link : `https://${ad.business_link}`);
        const businessName = escapeHtml(ad.business_name || '');
        const description = escapeHtml(truncateWords(ad.ad_description, 10));
        return {
          adId: ad.id,
          href: targetUrl,
          inner: `
            <div class="${prefix}-img-wrap"><img class="${prefix}-img" src="${imageUrl}" alt="" loading="lazy"></div>
            <div class="${prefix}-text">
              <p class="${prefix}-title">${businessName}</p>
              <p class="${prefix}-desc">${description}</p>
              <span class="${prefix}-cta">Visit Website</span>
            </div>`,
          credit: `<span class="${prefix}-credit">Ad by Yepper · ${categoryName}</span>`,
        };
      });

      // Owner configured more slots than are sold — rotate an "available"
      // card in too, so it isn't just dropped from the loop.
      if (ads.length < (adCategory.user_count || ads.length)) {
        adCards.push({
          adId: '',
          href: `${FRONTEND}/ad-owner/pages/direct-ad?websiteId=${websiteId}&categoryId=${categoryId}`,
          inner: `
            <div class="${prefix}-text" style="width:100%;text-align:center;justify-content:center;">
              <p class="${prefix}-title">Available Advertising Space</p>
              <p class="${prefix}-desc">Price: RWF ${categoryPrice}/month</p>
              <span class="${prefix}-cta">Advertise Here</span>
            </div>`,
          credit: '',
        });
      }

      const items = adCards.map((card, idx) => `
          <a class="${prefix}-ad" data-ad-id="${card.adId}" data-slot="${idx}" href="${card.href}" target="_blank" rel="noopener" style="display:${idx === 0 ? 'block' : 'none'}">
            <div class="${prefix}-inner">${card.inner}</div>
            ${card.credit}
          </a>`).join('');
      bodyHtml = `<div class="${prefix}-wrap" style="position:relative;width:100%;height:100%;">${items}</div>`;
    }

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${cardCss}</style>
</head>
<body>
${bodyHtml}
<script>
(function(){
  var items=Array.prototype.slice.call(document.querySelectorAll('.${prefix}-ad'));
  var _b="${API_BASE}",_i="${categoryId}";
  function track(kind,adId){
    if(!adId||adId==='undefined')return;
    var url=_b+(kind==='view'?'/ev/':'/ec/')+adId+'?cid='+_i;
    try{navigator.sendBeacon(url,'{}');}catch(e){fetch(url,{method:'POST',mode:'cors',credentials:'omit'}).catch(function(){});}
  }
  items.forEach(function(el){
    el.addEventListener('click',function(){track('click',el.dataset.adId);});
  });
  if(items.length){
    track('view',items[0].dataset.adId);
    if(items.length>1){
      var cur=0;
      /* Real ads dwell longer than the "Available Ad Space" filler. */
      (function scheduleNext(){
        var curAdId=items[cur].dataset.adId;
        var dwell=(curAdId&&curAdId!=='undefined')?7000:3000;
        setTimeout(function(){
          items[cur].style.display='none';
          cur=(cur+1)%items.length;
          items[cur].style.display='block';
          track('view',items[cur].dataset.adId);
          scheduleNext();
        },dwell);
      })();
    }
  }
})();
</script>
</body>
</html>`;

    res.send(html);
  } catch (err) {
    console.error('AdScriptController serveAdEmbed error:', err);
    res.status(500).send(blankEmbedPage());
  }
};