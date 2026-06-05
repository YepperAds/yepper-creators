(function(){
  const script = document.currentScript || (function(){ const s = document.getElementsByTagName('script'); return s[s.length-1]; })();
  const siteKey = (script && script.getAttribute && script.getAttribute('data-site')) || window.YEP_SITE;
  if(!siteKey){ console.warn('Yepper: site key missing (add data-site or set window.YEP_SITE)'); return; }

  function uid(){ return 'v_' + Math.random().toString(36).slice(2,10); }
  let visitorId = null;
  try{ visitorId = localStorage.getItem('yepper_vid'); }catch(e){}
  if(!visitorId){ visitorId = uid(); try{ localStorage.setItem('yepper_vid', visitorId); }catch(e){} }

  function send(payload, useBeacon){
    const url = '/api/collector';
    try{
      if(useBeacon && navigator.sendBeacon){
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
        return;
      }
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true }).catch(()=>{});
    }catch(e){}
  }

  function track(estimated){
    const payload = {
      site_key: siteKey,
      visitor_id: visitorId,
      url: location.href,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent,
      event_type: 'pageview',
      metadata: estimated || null,
      is_estimated: !!estimated
    };
    send(payload, false);
  }

  window.addEventListener('load', function(){ track(null); });
  window.addEventListener('beforeunload', function(){
    const payload = {
      site_key: siteKey,
      visitor_id: visitorId,
      url: location.href,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent,
      event_type: 'unload'
    };
    send(payload, true);
  });

  window.YepperTracker = {
    trackEvent: function(evt){ try{ track(evt); }catch(e){} },
    getVisitorId: function(){ return visitorId; }
  };
})();
