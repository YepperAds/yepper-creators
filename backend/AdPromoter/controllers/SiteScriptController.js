// SiteScriptController.js
// Serves ONE script per website that handles ALL ad spaces —
// auto-placed and manual-placed — from a single <script> tag.

const AdCategory = require('../models/CreateCategoryModel');
const Website    = require('../models/CreateWebsiteModel');
const { notifyDomainMismatch } = require('../../creators/utils/notificationUtils');

// Neutral wrapper aliases for ad-blocker evasion
const WRAPPERS = [
  'content-widget','page-module','site-section','layout-block',
  'view-unit','frame-item','display-zone','content-box',
  'media-section','page-element','render-block','ui-widget',
];

function neutralClass(id) {
  return WRAPPERS[parseInt(id.slice(-2), 16) % WRAPPERS.length];
}

// Only Floating and Modal are truly position-independent (position:fixed,
// appended straight to <body>). Everything else now ships as a
// precise-placement iframe instead (see AdScriptController.serveAdEmbed /
// codeDisplay.tsx) — the script must NOT also try to auto-guess a spot for
// those via querySelector('header')/('footer')/etc., or the owner ends up
// with two ads: one from this guess, one from the iframe they placed.
const AUTO_RELIABLE = ['floating', 'modalpic'];

// CSS per spaceType (scoped to each category prefix)
function placementCSS(spaceType, px) {
  const base = `.${px}-host{display:block;width:100%;box-sizing:border-box;position:relative;overflow:visible;}`;
  const map = {
    'header':              `.${px}-host{width:100%;top:0;left:0;z-index:900;max-height:120px;}`,
    'above the fold':      `.${px}-host{width:100%;margin:0 0 16px 0;}`,
    'beneath title':       `.${px}-host{width:100%;margin:12px 0 20px 0;}`,
    'in feed':             `.${px}-host{width:100%;margin:16px 0;border-radius:12px;overflow:hidden;}`,
    'inline content':      `.${px}-host{float:right;width:300px;margin:0 0 12px 20px;}@media(max-width:600px){.${px}-host{float:none;width:100%;margin:12px 0;}}`,
    'sidebar':             `.${px}-host{width:100%;margin:0 0 16px 0;max-width:300px;}`,
    'left rail':           `.${px}-host{width:160px;position:sticky;top:80px;margin-right:16px;}@media(max-width:768px){.${px}-host{width:100%;position:static;}}`,
    'rightrail':           `.${px}-host{width:160px;position:sticky;top:80px;margin-left:16px;}@media(max-width:768px){.${px}-host{width:100%;position:static;}}`,
    'stickysidebar':       `.${px}-host{position:sticky;top:80px;width:100%;max-width:300px;z-index:100;}`,
    'floating':            `.${px}-host{position:fixed;bottom:24px;right:24px;width:320px;z-index:9999;filter:drop-shadow(0 8px 24px rgba(0,0,0,0.18));}@media(max-width:480px){.${px}-host{width:calc(100% - 32px);left:16px;right:16px;bottom:16px;}}`,
    'bottom':              `.${px}-host{width:100%;margin:24px 0 0 0;}`,
    'profooter':           `.${px}-host{width:100%;padding:16px 0;border-top:1px solid rgba(0,0,0,0.08);margin-top:24px;}`,
    'overlay':             `.${px}-host{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(2px);}`,
    'modalpic':            `.${px}-host{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);}`,
    'mobile interstitial': `.${px}-host{position:fixed;bottom:0;left:0;right:0;z-index:9999;width:100%;}@media(min-width:769px){.${px}-host{display:none;}}`,
  };
  return base + (map[spaceType.toLowerCase()] || '');
}

function extractDomain(url) {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '');
  } catch { return null; }
}

exports.serveSiteScript = async (req, res) => {
  try {
    const { websiteId } = req.params;

  // Validate UUID format before hitting PostgreSQL
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(websiteId)) {
    res.setHeader('Content-Type', 'application/javascript');
    return res.status(400).send('// Invalid website ID format');
  }

    const [website, categories] = await Promise.all([
      Website.findById(websiteId),
      AdCategory.findByWebsite(websiteId),
    ]);

    if (!website) return res.status(404).send('// Website not found');
    if (!categories.length) return res.status(200).send('// No ad spaces configured yet');

    // ── Domain verification ──────────────────────────────────────
    const registeredDomain = website.website_link||website.websiteLink
      ? extractDomain(website.website_link||website.websiteLink)
      : null;

    if (registeredDomain) {
      const referer = req.headers.referer || req.headers.origin || '';
      const incoming = referer ? extractDomain(referer) : null;
      if (incoming && incoming !== registeredDomain) {
        notifyDomainMismatch(website.owner_id, website.id, registeredDomain, incoming).catch(() => {});
        res.setHeader('Content-Type', 'application/javascript');
        return res.send('/* invalid domain */');
      }
    }
    // ────────────────────────────────────────────────────────────

    const BACKEND  = process.env.BACKEND_URL  || '';
    const FRONTEND = process.env.FRONTEND_URL || '';

    // Stealth paths to avoid ad-blocker filter lists
    const API_BASE = `${BACKEND}/api/p`;
    const CAT_BASE = `${BACKEND}/api/c`;

    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');

    // Build per-category config
    const spaces = categories.map(cat => ({
      id:            ((cat.id||cat._id).toString()),
      name:          (cat.category_name||cat.categoryName),
      spaceType:     (cat.space_type||cat.spaceType) || 'inline content',
      mode:          (cat.placement_mode||cat.placementMode) || 'auto',
      price:         cat.price,
      lang:          (cat.default_language||cat.defaultLanguage) || 'english',
      px:            'yw' + ((cat.id||cat._id).toString()).slice(-6),
      wrap:          neutralClass(((cat.id||cat._id).toString())),
      css:           placementCSS((cat.space_type||cat.spaceType) || 'inline content', 'yw' + ((cat.id||cat._id).toString()).slice(-6)),
    }));

    const spacesJSON = JSON.stringify(spaces);

    // Analytics tracking snippet — fires once per page load, fire-and-forget
    const trackingSnippet = `
  /* ── Yepper Analytics tracker ──────────────────────────────── */
  (function(){
    try {
      var _ref = document.referrer || '';
      var _path = location.pathname || '/';
      var _payload = JSON.stringify({ websiteId: _wid, path: _path, referrer: _ref });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          _b + '/analytics/track',
          new Blob([JSON.stringify(_pv)], { type: 'application/json' })
        );
      } else {
        fetch(_b + '/analytics/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(_pv),
          mode: 'cors',
          credentials: 'omit'
        }).catch(function(){});
      }
    } catch(e) { /* tracking failure is non-fatal */ }
  })();
  /* ──────────────────────────────────────────────────────────── */
`;

    const script = `
(function(){
  /* Yepper Site Script — ${website.website_name||website.websiteName} */
  var _allowed="${registeredDomain || ''}";
  if(_allowed){
    var _cur=window.location.hostname.replace(/^www\\./, '');
    if(_cur!==_allowed)return;
  }

  var D=document,
      _wid="${websiteId}",
      _b="${API_BASE}",
      _c="${CAT_BASE}",
      _f="${FRONTEND}",
      _spaces=${spacesJSON},
      _rot=4000,
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

  var TR={
    english:    {title:'Available Advertising Space',price:'Price',cta:'Advertise Here'},
    french:     {title:'Espace Publicitaire Disponible',price:'Prix',cta:'Annoncez Ici'},
    kinyarwanda:{title:'Kwamamaza',price:"Igiciro cy'ukwezi",cta:'Kanda Hano'},
    kiswahili:  {title:'Nafasi ya Matangazo',price:'Bei',cta:'Tangaza Hapa'},
    chinese:    {title:'可用广告空间',price:'价格',cta:'在此广告'},
    spanish:    {title:'Espacio Publicitario Disponible',price:'Precio',cta:'Anuncie Aquí'}
  };

  function getLang(l){
    if(TR[l])return TR[l];
    var ul=(navigator.language||'en').toLowerCase().split('-')[0];
    return TR[{fr:'french',rw:'kinyarwanda',sw:'kiswahili',zh:'chinese',es:'spanish'}[ul]||'english'];
  }

  /* ── Inject styles for a space ───────────────────────── */
  function injectStyles(sp, custom){
    var sid='_ys_'+sp.id;
    if(D.getElementById(sid))return;
    var el=D.createElement('style');
    el.id=sid;
    var isH=custom.imagePosition==='left';
    var flexDir=isH?'row':'column';
    el.textContent=sp.css+\`
      .\${sp.px}-ad{display:block;width:\${custom.width?custom.width+'px':'100%'};max-width:\${custom.maxWidth||100}%;text-decoration:none;overflow:hidden;background:\${custom.backgroundColor||'#f1f1f1'};border:\${custom.borderWidth||1}px solid \${custom.borderColor||'rgba(255,255,255,0.18)'};border-radius:\${custom.borderRadius||16}px;box-shadow:\${custom.shadow==='none'?'none':custom.shadow==='small'?'0 2px 4px rgba(0,0,0,0.1)':custom.shadow==='large'?'0 20px 50px rgba(0,0,0,0.3)':'0 8px 32px rgba(31,38,135,0.18)'};transition:all 0.3s ease;position:relative;color:inherit;box-sizing:border-box;}
      .\${sp.px}-ad:hover{transform:translateY(-2px);}
      .\${sp.px}-inner{display:flex;flex-direction:\${flexDir};gap:16px;align-items:\${isH?'center':'stretch'};padding:14px;}
      .\${sp.px}-img-wrap{overflow:hidden;border-radius:10px;\${isH?'flex:0 0 40%;min-width:120px;':'width:100%;'}\${custom.showImage===false?'display:none;':''}}
      .\${sp.px}-img{width:100%;height:100%;object-fit:cover;display:block;transition:transform 0.3s;}
      .\${sp.px}-ad:hover .\${sp.px}-img{transform:scale(1.03);}
      .\${sp.px}-text{flex:1;display:flex;flex-direction:column;justify-content:center;min-width:0;}
      .\${sp.px}-title{font-size:\${custom.titleSize||16}px;font-weight:600;color:\${custom.titleColor||'rgba(0,0,0,0.9)'};margin:0 0 8px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
      .\${sp.px}-desc{font-size:\${custom.descriptionSize||14}px;color:\${custom.descriptionColor||'rgba(0,0,0,0.6)'};line-height:1.5;margin:0 0 12px;\${custom.showDescription===false?'display:none;':''}}
      .\${sp.px}-cta{display:inline-flex;align-items:center;align-self:flex-start;background:\${custom.ctaBackground||'#000'};color:\${custom.ctaColor||'#fff'};padding:8px 22px;border-radius:8px;font-size:\${custom.ctaSize||14}px;font-weight:500;\${custom.showCTA===false?'display:none;':''}}
      .\${sp.px}-credit{font-size:9px;color:rgba(0,0,0,0.4);padding:4px 8px;text-align:right;}
      .\${sp.px}-credit a{color:inherit;text-decoration:none;}
      .\${sp.px}-empty{padding:20px;text-align:center;background:#f5f5f5;border-radius:12px;}
      .\${sp.px}-empty-title{font-size:15px;font-weight:600;margin:0 0 6px;}
      .\${sp.px}-empty-price{font-size:13px;color:#555;margin:0 0 14px;}
      .\${sp.px}-empty-cta{display:inline-flex;align-items:center;background:#000;color:#fff;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;}
    \`;
    D.head.appendChild(el);
  }

  /* ── Find or create host for a space ─────────────────── */
  var _AUTO=${JSON.stringify(AUTO_RELIABLE)};
  function getHost(sp){
    var existing=D.querySelector('[data-yid="'+sp.id+'"]');
    if(existing)return existing;

    var host=D.createElement('div');
    host.className=sp.px+'-host '+sp.wrap;
    host.setAttribute('data-yid',sp.id);

    /* An explicit placeholder div always wins, for any spaceType — this is
       what makes data-yepper-space work as a manual-placement option too. */
    var ph=D.querySelector('[data-yepper-space="'+sp.id+'"]');
    if(ph){ph.appendChild(host);return host;}

    /* No placeholder: only Floating/Modal auto-place (position:fixed,
       independent of the page's DOM). Everything else (Header, Overlay,
       Mobile Interstitial, Bottom, proFooter, sidebar, etc.) ships as a
       precise-placement iframe — skip here so it doesn't also get a guessed
       duplicate inserted next to the iframe the owner already placed. */
    var st=sp.spaceType.toLowerCase();
    if(_AUTO.indexOf(st)===-1){return null;}

    if(st==='floating'){
      host.style.transformOrigin='bottom right';
      host.classList.add('yw-genie-pre');
    }

    D.body.appendChild(host);
    return host;
  }

  /* ── Dismiss button for a host (floating reappears after 40s) ── */
  function addDismissButton(host, spaceType){
    var stLower=spaceType.toLowerCase();
    if(stLower==='overlay'||stLower==='modalpic'){
      var btn=D.createElement('button');
      btn.textContent='×';
      btn.style.cssText='position:absolute;top:12px;right:16px;font-size:28px;background:none;border:none;cursor:pointer;color:#fff;z-index:1;';
      btn.onclick=function(){host.style.display='none';};
      host.appendChild(btn);
    }
    if(stLower==='floating'){
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

  /* ── Schedule a floating host's genie entrance, 3s after page load ── */
  function scheduleFloatingIntro(host){
    if(host.dataset.ywIntroScheduled)return;
    host.dataset.ywIntroScheduled='1';
    var wait=Math.max(0,3000-(Date.now()-_pageLoadTs));
    setTimeout(function(){revealFloating(host);},wait);
  }

  /* ── Render ads into host ─────────────────────────────── */
  function renderAds(host, sp, data, custom){
    var lang=getLang(sp.lang);

    if(!data||!data.html){
      host.innerHTML=
        '<div class="'+sp.px+'-empty">'+
          '<p class="'+sp.px+'-empty-title">'+lang.title+'</p>'+
          '<p class="'+sp.px+'-empty-price">'+lang.price+': $'+sp.price+'/mo</p>'+
          '<a class="'+sp.px+'-empty-cta" href="'+_f+'/ad-owner/pages/direct-ad?websiteId='+_wid+'&categoryId='+sp.id+'" target="_blank" rel="noopener">'+lang.cta+'</a>'+
        '</div>';
      addDismissButton(host, sp.spaceType);
      if(sp.spaceType.toLowerCase()==='floating')scheduleFloatingIntro(host);
      return;
    }

    var html=data.html
      .replace(/sp-container/g,sp.px+'-wrap')
      .replace(/sp-item/g,sp.px+'-ad')
      .replace(/sp-link/g,sp.px+'-link')
      .replace(/sp-content/g,sp.px+'-inner')
      .replace(/sp-image-wrapper/g,sp.px+'-img-wrap')
      .replace(/sp-image/g,sp.px+'-img')
      .replace(/sp-text-content/g,sp.px+'-text')
      .replace(/sp-business-name/g,sp.px+'-title')
      .replace(/sp-description/g,sp.px+'-desc')
      .replace(/sp-cta/g,sp.px+'-cta');

    host.innerHTML='<div class="'+sp.px+'-credit">Ad by <a href="'+_f+'" target="_blank" rel="noopener">Yepper</a></div>'+html;

    var items=Array.from(host.querySelectorAll('.'+sp.px+'-ad'));
    if(!items.length){renderAds(host,sp,null,custom);return;}

    items.forEach(function(el,idx){el.style.display=idx===0?'block':'none';});

    function trackView(adId){
      if(!adId||adId==='undefined'||adId==='null')return;
      var _ev=_b+'/ev/'+adId+'?cid='+sp.id;
      try{navigator.sendBeacon(_ev,'{}');}
      catch(e){fetch(_ev,{method:'POST',mode:'cors',credentials:'omit'}).catch(function(){});}
    }

    items.forEach(function(el){
      var adId=el.dataset.adId;
      var lnk=el.querySelector('.'+sp.px+'-link')||el.querySelector('a');
      if(!lnk)return;
      var href=lnk.href;
      lnk.removeAttribute('href');
      lnk.style.cursor='pointer';
      lnk.addEventListener('click',function(ev){
        ev.preventDefault();
        if(adId&&adId!=='undefined'&&adId!=='null'){
          try{navigator.sendBeacon(_b+'/ec/'+adId+'?cid='+sp.id,'{}');}catch(e){}
        }
        setTimeout(function(){window.open(href,'_blank','noopener');},80);
      });
    });

    addDismissButton(host, sp.spaceType);
    if(sp.spaceType.toLowerCase()==='floating')scheduleFloatingIntro(host);

    if(items.length>1){
      var cur=0;
      var firstAdId=items[cur].dataset.adId;
      if(firstAdId&&firstAdId!=='undefined'&&firstAdId!=='null')trackView(firstAdId);
      setInterval(function(){
        items[cur].style.display='none';
        cur=(cur+1)%items.length;
        items[cur].style.display='block';
        var rotId=items[cur].dataset.adId;
        if(rotId&&rotId!=='undefined'&&rotId!=='null')trackView(rotId);
      },_rot);
    } else {
      var singleId=items[0]&&items[0].dataset&&items[0].dataset.adId;
      if(singleId&&singleId!=='undefined'&&singleId!=='null')trackView(singleId);
    }
  }

  /* ── Load and render one space ────────────────────────── */
  function loadSpace(sp){
    var ck='?z='+sp.id+'&r='+Math.random().toString(36).slice(2);

    fetch(_c+'/ads/customization/'+sp.id+ck,{cache:'no-store'})
      .then(function(r){return r.ok?r.json():Promise.resolve({});})
      .then(function(d){
        var custom=d.customization||{};
        injectStyles(sp,custom);
        var host=getHost(sp);
        if(!host)return; /* manual with no placeholder — skip */

        fetch(_b+'/feed?categoryId='+sp.id+'&r='+Date.now(),{cache:'no-store'})
          .then(function(r){return r.ok?r.json():null;})
          .then(function(data){renderAds(host,sp,data,custom);})
          .catch(function(){renderAds(host,sp,null,{});});
      })
      .catch(function(){
        injectStyles(sp,{});
        var host=getHost(sp);
        if(!host)return;
        fetch(_b+'/feed?categoryId='+sp.id,{cache:'no-store'})
          .then(function(r){return r.ok?r.json():null;})
          .then(function(data){renderAds(host,sp,data,{});})
          .catch(function(){renderAds(host,sp,null,{});});
      });
  }

  /* ── Load a space by raw category ID (for DOM-discovered divs) ── */
  function loadSpaceById(categoryId){
    /* If already handled by the pre-baked list, skip */
    for(var i=0;i<_spaces.length;i++){
      if(_spaces[i].id===categoryId)return;
    }
    /* Fetch the real category config from the API so we have correct
       price, spaceType, lang etc. before rendering */
    fetch(_c+'/space/'+categoryId+'?r='+Date.now(),{cache:'no-store'})
      .then(function(r){return r.ok?r.json():null;})
      .then(function(cat){
        var px='yw'+categoryId.slice(-6);
        var st=(cat&&(cat.space_type||cat.spaceType))||'inline content';
        var wrappers=['content-widget','page-module','site-section','layout-block','view-unit','frame-item'];
        var wrap=wrappers[parseInt(categoryId.slice(-2),16)%wrappers.length];
        var sp={
          id:        categoryId,
          name:      (cat&&(cat.category_name||cat.categoryName))||'ad space',
          spaceType: st,
          mode:      'manual',
          price:     (cat&&cat.price)||0,
          lang:      (cat&&(cat.default_language||cat.defaultLanguage))||'english',
          px:        px,
          wrap:      wrap,
          css:       '.'+px+'-host{display:block;width:100%;box-sizing:border-box;position:relative;overflow:visible;}'
        };
        loadSpace(sp);
      })
      .catch(function(){
        /* Fallback: render with minimal config so the div isn't empty */
        var px='yw'+categoryId.slice(-6);
        var sp={id:categoryId,name:'ad space',spaceType:'inline content',mode:'manual',price:0,lang:'english',px:px,wrap:'content-widget',css:'.'+px+'-host{display:block;width:100%;}'};
        loadSpace(sp);
      });
  }

  /* ── Place (or re-place) every space ──────────────────── */
  /* React/Vue/Next/etc. don't do full page reloads after the first load,
     and their own re-renders can wipe out a script-injected DOM node since
     the framework never knows it's there. querySelector only matches nodes
     still attached to the document, so any space whose host got removed —
     by an SPA re-render, or just never created yet on this route — gets
     (re)loaded here. Safe to call repeatedly: already-live spaces are
     skipped with no extra fetch. */
  function placeAllSpaces(){
    _spaces.forEach(function(sp){
      if(D.querySelector('[data-yid="'+sp.id+'"]'))return;
      loadSpace(sp);
    });

    var divs=D.querySelectorAll('[data-yepper-space]');
    for(var i=0;i<divs.length;i++){
      var id=divs[i].getAttribute('data-yepper-space');
      if(D.querySelector('[data-yid="'+id+'"]'))continue;
      loadSpaceById(id);
    }
  }

  /* ── Analytics pageview ping ──────────────────────────── */
  function firePageview(){
    try{
      var _pv={
        websiteId:_wid,
        path: location.pathname || '/',
        referrer:D.referrer||''
      };
      if(navigator.sendBeacon){
        navigator.sendBeacon(_b.replace('/p','') + '/analytics/track',new Blob([JSON.stringify(_pv)],{type:'application/json'}));
      } else {
        fetch(_b.replace('/p','') + '/analytics/track',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify(_pv),
          mode:'cors',
          credentials:'omit'
        }).catch(function(){});
      }
    }catch(e){}
  }

  /* ── SPA route-change support ─────────────────────────── */
  /* Single-page apps (Next.js, React Router, Vue Router, etc.) navigate
     without a full reload, so a one-shot DOMContentLoaded init() only ever
     runs on the very first page. Wrapping pushState/replaceState + listening
     for popstate is the same technique analytics scripts like Umami use to
     catch those client-side navigations. A short delay lets the framework
     finish its own render of the new route before we go looking for spaces. */
  function onRouteChange(){
    setTimeout(function(){ placeAllSpaces(); firePageview(); },80);
  }

  function hookSpaNavigation(){
    try{
      window.addEventListener('popstate',onRouteChange);
      var _push=history.pushState,_replace=history.replaceState;
      history.pushState=function(){ var r=_push.apply(history,arguments); onRouteChange(); return r; };
      history.replaceState=function(){ var r=_replace.apply(history,arguments); onRouteChange(); return r; };
    }catch(e){}
  }

  /* ── Init ──────────────────────────────────────────────── */
  function init(){
    injectAnimCSS();
    placeAllSpaces();
    firePageview();
    hookSpaNavigation();
  }

  D.readyState==='loading'
    ?D.addEventListener('DOMContentLoaded',init)
    :init();
})();
`;

    res.send(script);
  } catch (err) {
    console.error('SiteScriptController error:', err);
    res.status(500).send('// Error loading site ad script');
  }
};

/* Generate and save the site script tag on the website record */
exports.generateSiteScript = async (websiteId) => {
  const BACKEND = process.env.BACKEND_URL || 'http://localhost:5000';
  // Use stealth path /api/p/site/ so the <script src> doesn't match ad-blocker rules
  const src = `${BACKEND}/api/p/site/${websiteId}`;
  const tag = `<script src="${src}" async></script>`;
  await require('../models/CreateWebsiteModel').update(websiteId, { siteScript: tag });
  return tag;
};