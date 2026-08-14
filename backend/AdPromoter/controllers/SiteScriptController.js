// SiteScriptController.js
// Serves ONE script per website that handles ALL ad spaces —
// auto-placed and manual-placed — from a single <script> tag.

const AdCategory = require('../models/CreateCategoryModel');
const Website    = require('../models/CreateWebsiteModel');
const { notifyDomainMismatch } = require('../../creators/utils/notificationUtils');
const { placementCSS, buildExpandedTemplatesForClient } = require('../utils/adSpaceLayout');

// Neutral wrapper aliases for ad-blocker evasion
const WRAPPERS = [
  'content-widget','page-module','site-section','layout-block',
  'view-unit','frame-item','display-zone','content-box',
  'media-section','page-element','render-block','ui-widget',
];

function neutralClass(id) {
  return WRAPPERS[parseInt(id.slice(-2), 16) % WRAPPERS.length];
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

    const [website, allCategories] = await Promise.all([
      Website.findById(websiteId),
      AdCategory.findByWebsite(websiteId),
    ]);

    if (!website) return res.status(404).send('// Website not found');

    if (!allCategories.length) return res.status(200).send('// No ad spaces configured yet');

    // Every category ships in the bundle now, auto or page-scoped alike — a
    // category with a target_path is filtered client-side by matching it
    // against location.pathname (see placeAllSpaces' path check below), not
    // by being excluded from this list. That's what lets Floating/Modal be
    // scoped to one page with zero snippet on that page: the one site-wide
    // script (already installed everywhere) simply skips rendering it when
    // the current path doesn't match, and removes it again if you navigate
    // away from a matching page without a full reload.
    const categories = allCategories;

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
      targetPath:    cat.target_path || cat.targetPath || null,
    }));

    const spacesJSON = JSON.stringify(spaces);
    const placementTemplatesJSON = JSON.stringify(buildExpandedTemplatesForClient());

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
      _pcssT=${placementTemplatesJSON},
      _rotAd=7000,
      _rotEmpty=3000,
      _pageLoadTs=Date.now();

  /* ── Positioning CSS for a category discovered via a data-yepper-space
     div that wasn't in the pre-baked _spaces list (manual-mode Floating/
     ModalPic) — same template table the server used to precompute _spaces'
     own css, just filled in here instead of on the server. */
  function placementCSS(st,px){
    function fill(tpl){ return (tpl||'').split('{{PX}}').join(px); }
    return fill(_pcssT.base)+fill(_pcssT[(st||'').toLowerCase()]);
  }

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

  /* ── Escape a name before dropping it into innerHTML ──── */
  function escHtml(s){
    return String(s==null?'':s).replace(/[&<>"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  /* ── Inject styles for a space ───────────────────────── */
  /* Each ad slot in this space is styled independently — slot 0's
     template/color/font never bleeds into slot 1. \`data\` is the resolved
     response from /ads/customization (one fully-resolved bundle per slot,
     already defaulted to plain white+shadow — no dark-mode auto-adaptation). */
  function injectStyles(sp, data, root){
    var slots=data.slots||[];

    /* Positioning rules stay in the page's own <head>: they control how the
       host box sits relative to the viewport (fixed/floating placement,
       width, z-index), which only has any effect from outside the shadow
       boundary. Everything else — colors, fonts, text, the ad's own box
       styling — goes inside the shadow root instead, below, so the site's
       stylesheet can't reach in and restyle it, and the ad's own rules
       can't leak out and accidentally match something on the page. */
    var posId='_ys_'+sp.id+'_pos';
    if(!D.getElementById(posId)){
      var posCss=sp.css;
      if(sp.spaceType.toLowerCase()==='floating'&&slots[0]&&slots[0].width){
        posCss+='.'+sp.px+'-host{width:'+slots[0].width+'px;}';
      }
      var posEl=D.createElement('style');
      posEl.id=posId;
      posEl.textContent=posCss;
      D.head.appendChild(posEl);
    }

    var sid='_ys_'+sp.id;
    if(root.querySelector('#'+sid))return;
    var el=D.createElement('style');
    el.id=sid;

    var fontCss='';
    (data.fontImports||[]).forEach(function(fi){
      fontCss+='@import url(https://fonts.googleapis.com/css2?'+fi+'&display=swap);';
    });

    /* Image-forward card: the creative image fills the whole box, the CTA
       is a small button overlaid on top of it — no business name or
       description text rendered into the ad at all (see AdDisplayController
       .displayAd, which stopped sending that markup). imagePosition/
       imageWidthPercent/titleSize/descriptionColor etc. from customization
       are no longer consulted here for the same reason; still accepted and
       stored (the Customize Ads panel doesn't need a matching rewrite just
       because the renderer stopped reading a few of its fields), just inert. */
    var rulesCss='.'+sp.px+'-ad{display:block;width:100%;height:100%;overflow:hidden;background:#fff;border:1px solid rgba(0,0,0,0.08);border-radius:16px;box-shadow:0 8px 32px rgba(31,38,135,0.18);box-sizing:border-box;text-decoration:none;color:inherit;position:relative;}';
    slots.forEach(function(s,si){
      var sel='.'+sp.px+'-ad[data-slot="'+si+'"]';
      rulesCss+=\`
        \${sel}{display:block;width:\${s.width?s.width+'px':'100%'};max-width:\${s.maxWidth||100}%;height:\${s.height?s.height+'px':'100%'};text-decoration:none;overflow:hidden;background:\${s.backgroundColor};border:\${s.borderWidth}px solid \${s.borderColor};border-radius:\${s.borderRadius||16}px;box-shadow:\${s.shadowCss};transition:all 0.3s ease;position:relative;color:inherit;box-sizing:border-box;font-family:\${s.fontStack};}
        \${sel}:hover{transform:translateY(-2px);}
        \${sel} .\${sp.px}-link{display:block;position:relative;width:100%;height:100%;}
        \${sel} .\${sp.px}-inner{position:relative;width:100%;height:100%;}
        \${sel} .\${sp.px}-img-wrap{position:absolute;inset:0;width:100%;height:100%;overflow:hidden;\${s.showImage===false?'display:none;':''}}
        \${sel} .\${sp.px}-cta{position:absolute;bottom:10px;right:10px;z-index:2;display:inline-flex;align-items:center;background:\${s.ctaBackground};color:\${s.ctaColor};padding:6px 16px;border-radius:8px;font-size:\${s.ctaSize||13}px;font-weight:500;box-shadow:0 2px 8px rgba(0,0,0,0.25);\${s.showCTA===false?'display:none;':''}}
      \`;
      if(s.customCSS){
        rulesCss+=s.customCSS
          .replace(/\\.ad-container/g,sel)
          .replace(/\\.ad-cta/g,sel+' .'+sp.px+'-cta')
          .replace(/\\.ad-image/g,sel+' .'+sp.px+'-img');
      }
    });

    el.textContent=fontCss+rulesCss+\`
      .\${sp.px}-wrap{display:block;height:100%;}
      .\${sp.px}-img{width:100%;height:100%;object-fit:cover;display:block;transition:transform 0.3s;}
      .\${sp.px}-ad:hover .\${sp.px}-img{transform:scale(1.03);}
      /* Used to sit as its own row above the ad box, which quietly added its
         own height on top of the box's already-fixed dims — the host clips
         at exactly that fixed height, so that extra row pushed the ad box's
         own bottom past the clip line and got it cut off (the "header is
         overlapping the ad" symptom was actually our own credit line eating
         into the box's height budget). Overlaid on the box instead — zero
         layout height, box gets the full space it was sized for. */
      .\${sp.px}-credit{position:absolute;bottom:3px;right:6px;z-index:6;font-size:8px;line-height:1;color:rgba(0,0,0,0.4);background:rgba(255,255,255,0.72);padding:2px 6px;border-radius:6px;}
      .\${sp.px}-credit a{color:inherit;text-decoration:none;}
      .\${sp.px}-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:24px 22px;text-align:center;background:#fff;box-shadow:0 8px 32px rgba(31,38,135,0.18);border-radius:12px;width:100%;height:100%;box-sizing:border-box;}
      .\${sp.px}-empty-badge{display:inline-flex;align-items:center;justify-content:center;padding:4px 12px;border-radius:20px;background:#fff7ed;color:#ea580c;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;}
      .\${sp.px}-empty-name{font-size:10px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#999;margin:2px 0 0;}
      .\${sp.px}-empty-title{font-size:16px;font-weight:700;margin:2px 0 0;max-width:230px;line-height:1.35;color:#111;}
      .\${sp.px}-empty-price{font-size:12px;color:#666;margin:0;}
      .\${sp.px}-empty-cta{display:inline-flex;align-items:center;flex-shrink:0;background:#000;color:#fff;padding:9px 22px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;margin-top:6px;}

      /* Short, banner-shaped spaces (Header/Above the Fold/Beneath Title/
         Pro Footer — 90px tall) don't have room for the 4-line filler
         above without the button getting clipped, so they get a single row
         instead: pitch text on the left, button on the right, both
         vertically centered. A shaded background + full-height row makes
         the row actually fill the 90px box instead of sitting as small
         centered text in a mostly-blank white banner. */
      .\${sp.px}-empty-compact{flex-direction:row;justify-content:space-between;align-items:center;gap:16px;padding:0 24px;text-align:left;border-radius:0;box-shadow:none;background:linear-gradient(135deg,#fafafa,#efefef);}
      .\${sp.px}-empty-compact .\${sp.px}-empty-price{font-size:19px;font-weight:700;color:#111;margin:0;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .\${sp.px}-empty-compact .\${sp.px}-empty-cta{margin-top:0;padding:13px 28px;font-size:14px;flex-shrink:0;}

      /* Multi-tier ad spaces: the pricier of the 3 slots doesn't just show
         longer, it visibly looks pricier — ranked by real price (see
         AdDisplayController's tierRank), not by which named slot this is,
         so it's accurate no matter what the owner typed for the custom slot. */
      .\${sp.px}-ad[data-tier-rank="1"]{border:2px solid #f5c451!important;box-shadow:0 8px 28px rgba(245,196,81,0.35)!important;}
      .\${sp.px}-ad[data-tier-rank="2"]{border:2px solid #E8472B!important;box-shadow:0 10px 34px rgba(232,71,43,0.4)!important;}
      .\${sp.px}-badge{position:absolute;top:8px;left:8px;z-index:3;display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;background:#f5c451;color:#3d2b00;font-size:10px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;box-shadow:0 2px 6px rgba(0,0,0,0.25);}
      .\${sp.px}-badge-top{background:#E8472B;color:#fff;}

      /* Same escalation applied to an unsold slot's own pitch, not just a
         sold ad — otherwise "Custom" and "Unverified" fillers are pixel
         -identical apart from the number in the price line, which gives a
         visitor (or a hesitating advertiser) no reason to believe the
         pricier slot is actually worth more. */
      .\${sp.px}-ad[data-tier-rank="1"] .\${sp.px}-empty,
      .\${sp.px}-ad[data-tier-rank="1"] .\${sp.px}-empty-compact{background:linear-gradient(135deg,#fff9ec,#fbe6b8);}
      .\${sp.px}-ad[data-tier-rank="1"] .\${sp.px}-empty-cta{background:#f5c451;color:#3d2b00;}
      .\${sp.px}-ad[data-tier-rank="2"] .\${sp.px}-empty,
      .\${sp.px}-ad[data-tier-rank="2"] .\${sp.px}-empty-compact{background:linear-gradient(135deg,#211a16,#3a2620);}
      .\${sp.px}-ad[data-tier-rank="2"] .\${sp.px}-empty-name{color:#e0b8a8;}
      .\${sp.px}-ad[data-tier-rank="2"] .\${sp.px}-empty-title,
      .\${sp.px}-ad[data-tier-rank="2"] .\${sp.px}-empty-compact .\${sp.px}-empty-price{color:#fff;}
      .\${sp.px}-ad[data-tier-rank="2"] .\${sp.px}-empty-price{color:#f0d9cf;}
      .\${sp.px}-ad[data-tier-rank="2"] .\${sp.px}-empty-cta{background:linear-gradient(135deg,#E8472B,#c2321a);color:#fff;}
    \`;

    root.appendChild(el);
  }

  /* ── Find or create host for a space ─────────────────── */
  function getHost(sp){
    var existing=D.querySelector('[data-yid="'+sp.id+'"]');
    if(existing)return existing;

    /* A placeholder div is required for every spaceType now, Floating/Modal
       included — no body-append fallback. This is what makes the target-page
       picker a real verification signal instead of a guess: the div's own
       page is checked against it (see loadSpace's targetPath check below), so
       "the system knows" whether the two agree, rather than the script
       silently deciding where to put things on its own. */
    var ph=D.querySelector('[data-yepper-space="'+sp.id+'"]');
    if(!ph)return null;

    /* Whatever's already sitting in the placeholder — stray text, leftover
       markup from editing the page, anything at all — is cleared here: this
       div is fully owned by the ad from the moment it's found, not shared
       content the ad has to render alongside. */
    ph.innerHTML='';

    var host=D.createElement('div');
    host.className=sp.px+'-host '+sp.wrap;
    host.setAttribute('data-yid',sp.id);

    var stLower=sp.spaceType.toLowerCase();
    var pinsToViewport=(stLower==='floating'||stLower==='modal'||stLower==='modalpic'||stLower==='overlay');

    if(stLower==='floating'){
      host.style.transformOrigin='bottom right';
      host.classList.add('yw-genie-pre');
    }

    /* Shadow DOM so the site's own stylesheet can't reach in and restyle
       the ad's text/colors/box layout — real isolation, not a specificity
       trick. _ysRoot is where this ad's <style> tag goes; _ysContent is a
       separate child of it that renderAds replaces wholesale on every
       re-render — kept apart so overwriting the ad's markup on a rotation
       or a refetch never also wipes out the style tag sitting next to it.
       Falls back to host itself on the rare browser with no Shadow DOM
       support, with the same content/style split preserved. */
    host._ysRoot=(typeof host.attachShadow==='function')?host.attachShadow({mode:'open'}):host;
    host._ysContent=D.createElement('div');
    /* The image-forward ad card fills its box via position:absolute+inset:0
       (see injectStyles), which needs a real (non-auto) height somewhere in
       its ancestor chain to resolve against — position:absolute content is
       removed from normal flow, so it can't establish that height itself
       the way the old flex+fixed-px-image layout used to. This div sits
       directly inside the shadow root, i.e. directly inside the host
       element for layout purposes, so height:100% here correctly picks up
       the host's own real height (the fixed px value set in
       placementCSS/adSpaceLayout.js) and hands it down through
       .px-wrap/.px-ad/.px-inner below. */
    host._ysContent.style.cssText='display:block;height:100%;position:relative;';
    host._ysRoot.appendChild(host._ysContent);

    /* Floating/Modal/Overlay render via position:fixed so they should pin to
       the viewport no matter where in the page the placeholder div sits —
       but position:fixed actually resolves against the nearest ancestor
       that has a transform/filter/perspective/contain/will-change property
       instead of the viewport, and it's common for a publisher to have
       pasted the placeholder div inside exactly that kind of styled section
       (a hero banner, an animated card, etc). Mounting straight on <body>
       sidesteps that whole class of bug. ph is left in place, empty and
       untouched otherwise — it's still what getHost/reportPageMismatch use
       to confirm the space's div exists on this page, it just isn't host's
       parent anymore for these types. */
    if(pinsToViewport){
      D.body.appendChild(host);
    } else {
      ph.appendChild(host);
    }
    return host;
  }

  /* ── Dismiss button for a host (floating reappears after 40s) ── */
  function addDismissButton(host, spaceType){
    var root=host._ysContent||host;
    var stLower=spaceType.toLowerCase();
    if(stLower==='overlay'||stLower==='modalpic'){
      var btn=D.createElement('button');
      btn.textContent='×';
      btn.style.cssText='position:absolute;top:12px;right:16px;font-size:28px;background:none;border:none;cursor:pointer;color:#fff;z-index:1;';
      btn.onclick=function(){host.style.display='none';};
      root.appendChild(btn);
    }
    if(stLower==='floating'){
      var fbtn=D.createElement('button');
      fbtn.textContent='×';
      fbtn.style.cssText='position:absolute;top:-10px;right:-10px;width:24px;height:24px;border-radius:50%;background:#000;color:#fff;font-size:15px;line-height:24px;text-align:center;border:none;cursor:pointer;z-index:2;padding:0;box-shadow:0 1px 4px rgba(0,0,0,0.3);';
      fbtn.onclick=function(){
        hideFloating(host);
        setTimeout(function(){revealFloating(host);},40000);
      };
      root.appendChild(fbtn);
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
  function renderAds(host, sp, data){
    var lang=getLang(sp.lang);
    var root=host._ysContent||host;

    if(!data||!data.html){
      root.innerHTML=
        '<div class="'+sp.px+'-empty">'+
          '<span class="'+sp.px+'-empty-badge">Ad</span>'+
          '<p class="'+sp.px+'-empty-name">'+escHtml(sp.name)+'</p>'+
          '<p class="'+sp.px+'-empty-title">'+lang.title+'</p>'+
          '<p class="'+sp.px+'-empty-price">'+lang.price+': RWF '+sp.price+'/mo</p>'+
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
      .replace(/sp-empty-name/g,sp.px+'-empty-name')
      .replace(/sp-empty-title/g,sp.px+'-empty-title')
      .replace(/sp-empty-price/g,sp.px+'-empty-price')
      .replace(/sp-empty-cta/g,sp.px+'-empty-cta')
      .replace(/sp-empty/g,sp.px+'-empty')
      .replace(/sp-badge/g,sp.px+'-badge')
      .replace(/sp-cta/g,sp.px+'-cta');

    root.innerHTML='<div class="'+sp.px+'-credit">Ad by <a href="'+_f+'" target="_blank" rel="noopener">Yepper</a> · '+escHtml(sp.name)+'</div>'+html;

    var items=Array.from(root.querySelectorAll('.'+sp.px+'-ad'));
    if(!items.length){renderAds(host,sp,null);return;}

    items.forEach(function(el,idx){
      el.style.display=idx===0?'block':'none';
      el.setAttribute('data-slot',idx);
    });

    /* Header only: the pricier of the 3 tiers doesn't just look pricier
       (border/badge/background, set in CSS above), it's physically a bigger
       box — cheapest stays the standard 728x90 banner, the middle tier is
       noticeably wider and taller, the top tier bigger again but only a
       modest step up from the middle one. !important on these inline styles
       is required to beat the host's own !important width/height (added so
       external page CSS can't shrink/crowd it) — an inline !important is the
       one thing that legitimately outranks it. */
    var HEADER_TIER_SIZE={1:{w:780,h:104},2:{w:810,h:112}};
    function applyHeaderTierSize(el){
      if(!sp.spaceType||sp.spaceType.toLowerCase()!=='header')return;
      var size=HEADER_TIER_SIZE[el&&el.dataset&&el.dataset.tierRank];
      if(size){
        // min(...,100%) — a bare px width would overflow a phone-width
        // viewport and cause horizontal scrolling; this caps it at the
        // container's real width same as the base template already does.
        var w='min('+size.w+'px, 100%)';
        host.style.setProperty('width',w,'important');
        host.style.setProperty('max-width',w,'important');
        host.style.setProperty('height',size.h+'px','important');
        if(el){
          el.style.setProperty('width',w,'important');
          el.style.setProperty('height',size.h+'px','important');
          el.style.setProperty('max-height',size.h+'px','important');
        }
      } else {
        host.style.removeProperty('width');
        host.style.removeProperty('max-width');
        host.style.removeProperty('height');
        if(el){
          el.style.removeProperty('width');
          el.style.removeProperty('max-height');
          /* height stays: the server already inline-styles it to the
             standard banner height (see AdDisplayController's heightStyle),
             which IS the correct rank-0 size — nothing to remove. */
        }
      }
    }
    applyHeaderTierSize(items[0]);

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
      /* Real ads dwell longer than the "Available Ad Space" filler — a
         recursive setTimeout so each item's own dwell time decides the next
         swap, instead of one fixed period for everything. Multi-tier spaces
         ("Shared/Featured/Exclusive") go further: data.dwellByTier gives
         each tier its own on-screen time (Exclusive stays up longer than
         Shared), read via each item's data-tier attribute. Untiered spaces
         have no dwellByTier and fall straight back to _rotAd/_rotEmpty. */
      var dwellByTier=data.dwellByTier||null;
      (function scheduleNext(){
        var curAdId=items[cur].dataset.adId;
        var curTier=items[cur].dataset.tier;
        var dwell=(dwellByTier&&curTier&&dwellByTier[curTier])
          ? dwellByTier[curTier]
          : ((curAdId&&curAdId!=='undefined'&&curAdId!=='null')?_rotAd:_rotEmpty);
        setTimeout(function(){
          items[cur].style.display='none';
          cur=(cur+1)%items.length;
          items[cur].style.display='block';
          applyHeaderTierSize(items[cur]);
          var rotId=items[cur].dataset.adId;
          if(rotId&&rotId!=='undefined'&&rotId!=='null')trackView(rotId);
          scheduleNext();
        },dwell);
      })();
    } else {
      var singleId=items[0]&&items[0].dataset&&items[0].dataset.adId;
      if(singleId&&singleId!=='undefined'&&singleId!=='null')trackView(singleId);
    }
  }

  /* ── Report a placeholder div sitting on the wrong page ── */
  /* Fires only when the div actually exists but its page doesn't match the
     target picked in the dashboard — i.e. the owner (or a stale Duplicate)
     put it somewhere it wasn't configured for. Silent otherwise: no div on
     this page at all is the normal, expected case for every other route. */
  function reportPageMismatch(sp){
    try{
      var payload=JSON.stringify({categoryId:sp.id,expectedPath:sp.targetPath,actualPath:location.pathname});
      var url=_b+'/page-mismatch';
      if(navigator.sendBeacon){navigator.sendBeacon(url,new Blob([payload],{type:'application/json'}));}
      else{fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:payload,mode:'cors',credentials:'omit'}).catch(function(){});}
    }catch(e){}
  }

  /* ── Report a placeholder div actually found on this page (All Pages
     spaces only — a single-page space already knows its one page via
     targetPath). This is what populates the advertiser-facing "which pages
     do you want this on" checkout picker with real placements instead of
     the owner's self-reported websites.pages list. Server-side dedupe makes
     repeat calls for an already-known path a cheap no-op. ── */
  function reportSpaceSeen(sp){
    try{
      var payload=JSON.stringify({categoryId:sp.id,path:location.pathname});
      var url=_b+'/space-seen';
      if(navigator.sendBeacon){navigator.sendBeacon(url,new Blob([payload],{type:'application/json'}));}
      else{fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:payload,mode:'cors',credentials:'omit'}).catch(function(){});}
    }catch(e){}
  }

  /* ── Load and render one space ────────────────────────── */
  function loadSpace(sp){
    /* A placeholder div is required for every space now — no auto-placement.
       No div on this page at all: nothing to do, perfectly normal (most
       pages don't have most spaces). A div that IS here but doesn't match
       this space's configured target page: don't render it, and tell the
       owner, since that's a real placement mistake rather than "not this
       page" — see reportPageMismatch. */
    var ph=D.querySelector('[data-yepper-space="'+sp.id+'"]');
    if(!ph)return;
    if(sp.targetPath&&sp.targetPath!==location.pathname){reportPageMismatch(sp);return;}
    if(!sp.targetPath)reportSpaceSeen(sp);

    var ck='?z='+sp.id+'&r='+Math.random().toString(36).slice(2);

    fetch(_c+'/ads/customization/'+sp.id+ck,{cache:'no-store'})
      .then(function(r){return r.ok?r.json():Promise.resolve({slots:[],fontImports:[]});})
      .then(function(d){
        var host=getHost(sp);
        if(!host)return; /* manual with no placeholder — skip */
        injectStyles(sp,d,host._ysRoot||host);

        fetch(_b+'/feed?categoryId='+sp.id+'&path='+encodeURIComponent(location.pathname)+'&r='+Date.now(),{cache:'no-store'})
          .then(function(r){return r.ok?r.json():null;})
          .then(function(data){renderAds(host,sp,data);})
          .catch(function(){renderAds(host,sp,null);});
      })
      .catch(function(){
        var host=getHost(sp);
        if(!host)return;
        injectStyles(sp,{slots:[],fontImports:[]},host._ysRoot||host);
        fetch(_b+'/feed?categoryId='+sp.id+'&path='+encodeURIComponent(location.pathname),{cache:'no-store'})
          .then(function(r){return r.ok?r.json():null;})
          .then(function(data){renderAds(host,sp,data);})
          .catch(function(){renderAds(host,sp,null);});
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
      .then(function(r){return r.ok?r.json():{__notFound:true};})
      .then(function(cat){
        /* A confirmed 404 means this category was deleted server-side — the
           div is just stale markup left behind in the owner's own template
           (deleting an ad space in the dashboard only removes the DB row,
           it can't reach into the owner's site and remove the div for
           them). Rendering a fabricated $0 "Available Advertising Space"
           placeholder here was actively wrong, not just a missing-data
           fallback: it invented an ad space that no longer exists. Bail out
           silently instead — same as loadSpace's "no div on this page,
           nothing to do" case, just the inverse (div exists, space
           doesn't). Network failures (fetch rejecting outright) are a
           different, genuinely ambiguous case and still fall through to
           the resilient stub in .catch below. */
        if(cat&&cat.__notFound)return;
        var px='yw'+categoryId.slice(-6);
        var st=(cat&&(cat.space_type||cat.spaceType))||'inline content';
        var wrappers=['content-widget','page-module','site-section','layout-block','view-unit','frame-item'];
        var wrap=wrappers[parseInt(categoryId.slice(-2),16)%wrappers.length];
        var sp={
          id:         categoryId,
          name:       (cat&&(cat.category_name||cat.categoryName))||'ad space',
          spaceType:  st,
          mode:       'manual',
          price:      (cat&&cat.price)||0,
          lang:       (cat&&(cat.default_language||cat.defaultLanguage))||'english',
          px:         px,
          wrap:       wrap,
          css:        placementCSS(st, px),
          targetPath: (cat&&(cat.target_path||cat.targetPath))||null
        };
        loadSpace(sp);
      })
      .catch(function(){
        /* Fallback: render with minimal config so the div isn't empty */
        var px='yw'+categoryId.slice(-6);
        var sp={id:categoryId,name:'ad space',spaceType:'inline content',mode:'manual',price:0,lang:'english',px:px,wrap:'content-widget',css:placementCSS('inline content', px)};
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
  /* No separate teardown needed: every space now only ever renders inside a
     placeholder div the owner placed, so navigating off that div's page
     removes the div — and the host rendered inside it — the same way the
     framework removes anything else on that page. */

  /* ── Logo auto-detection ──────────────────────────────── */
  /* Replaces asking publishers to upload a logo at signup: since this
     script only ever runs on the domain it was issued for (the _allowed
     check above already returned early otherwise), whatever icon the page
     itself declares IS that site's real logo. Preference order favors the
     highest-fidelity source a page typically declares. Returns every
     candidate instead of just the first hit — a declared <link> only means
     the tag exists, not that the file behind it is real (see
     verifyLogoCandidates below). */
  function getLogoCandidates(){
    var out=[];
    try{
      var sels=['link[rel="apple-touch-icon"]','link[rel="icon"]','link[rel="shortcut icon"]'];
      for(var i=0;i<sels.length;i++){
        var el=D.querySelector(sels[i]);
        if(el&&el.href)out.push(el.href);
      }
      var og=D.querySelector('meta[property="og:image"]');
      if(og&&og.content){
        try{out.push(new URL(og.content,location.href).href);}catch(e){}
      }
      out.push(location.origin+'/favicon.ico');
    }catch(e){}
    return out;
  }

  /* A <link rel="..."> tag existing, and its URL returning 200, both say
     nothing about whether it's actually an image — a site's SPA catch-all
     route happily 200s a path that was never really deployed (its index
     shell, wrong content-type) exactly as readily as a real icon file. Only
     letting the browser decode it as an image tells the difference, so each
     candidate gets a real Image() load attempt, in preference order, capped
     so a slow/dead host can't hold the pageview beacon open indefinitely. */
  function verifyImage(url,timeoutMs){
    return new Promise(function(resolve){
      if(!url){resolve(null);return;}
      var img=new Image();
      var done=false;
      var t=setTimeout(function(){if(!done){done=true;resolve(null);}},timeoutMs);
      img.onload=function(){if(!done){done=true;clearTimeout(t);resolve(url);}};
      img.onerror=function(){if(!done){done=true;clearTimeout(t);resolve(null);}};
      img.src=url;
    });
  }

  function resolveLogo(){
    var candidates=getLogoCandidates();
    var i=0;
    function tryNext(){
      if(i>=candidates.length)return Promise.resolve(null);
      var url=candidates[i++];
      return verifyImage(url,1200).then(function(ok){return ok||tryNext();});
    }
    return tryNext();
  }

  /* ── Analytics pageview ping ──────────────────────────── */
  function firePageview(){
    try{
      resolveLogo().then(function(logoUrl){
        var _pv={
          websiteId:_wid,
          path: location.pathname || '/',
          referrer:D.referrer||'',
          hostname: window.location.hostname.replace(/^www\./,''),
          logoUrl: logoUrl
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
      });
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

  /* ── DOM watcher ───────────────────────────────────────── */
  /* This script loads async and can finish downloading (and run its first
     placeAllSpaces()) before a client-rendered SPA's own JS bundle has even
     mounted — there's no "route change" event on that very first paint for
     hookSpaNavigation to catch, so a data-yepper-space div added by the
     framework's initial render could be missed entirely and never retried.
     A MutationObserver sidesteps guessing that race: it re-scans whenever
     the DOM actually changes, whatever the cause (slow initial mount, a
     later-opened modal, anything) — debounced so a burst of mutations
     collapses into one rescan instead of one per node. placeAllSpaces()
     itself is idempotent (skips anything already placed), so calling it
     often is cheap. */
  function hookDomWatcher(){
    try{
      var t;
      var mo=new MutationObserver(function(){
        clearTimeout(t);
        t=setTimeout(placeAllSpaces,50);
      });
      mo.observe(D.documentElement,{childList:true,subtree:true});
    }catch(e){}
  }

  /* ── Init ──────────────────────────────────────────────── */
  function init(){
    injectAnimCSS();
    placeAllSpaces();
    firePageview();
    hookSpaNavigation();
    hookDomWatcher();
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