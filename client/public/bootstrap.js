(function() {
  var RELOAD_KEY = 'p3_bootstrap_reload';
  var lastReload = sessionStorage.getItem(RELOAD_KEY);
  if (lastReload && (Date.now() - parseInt(lastReload)) < 5000) {
    console.log('[BOOTSTRAP] Recently reloaded, skipping');
    return;
  }
  
  function clearAndReload(reason) {
    console.log('[BOOTSTRAP] ' + reason);
    sessionStorage.setItem(RELOAD_KEY, Date.now().toString());
    
    var preserveKeys = [
      'p3.bridge.session',
      'p3.bridge.resume',
      'walletAddress',
      'token',
      'atlas_session_token',
      'wc@2:core:',
      'wc@2:client:'
    ];
    var preserved = {};
    preserveKeys.forEach(function(key) {
      if (key.endsWith(':')) {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.startsWith(key)) {
            preserved[k] = localStorage.getItem(k);
          }
        }
      } else {
        var val = localStorage.getItem(key);
        if (val) preserved[key] = val;
      }
    });
    
    if ('caches' in window) {
      caches.keys().then(function(keys) {
        keys.forEach(function(key) { 
          console.log('[BOOTSTRAP] Deleting cache:', key);
          caches.delete(key); 
        });
      });
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(regs) {
        regs.forEach(function(reg) { 
          console.log('[BOOTSTRAP] Unregistering SW:', reg.scope);
          reg.unregister(); 
        });
      });
    }
    
    Object.keys(preserved).forEach(function(key) {
      console.log('[BOOTSTRAP] Restoring key:', key);
      localStorage.setItem(key, preserved[key]);
    });
    
    setTimeout(function() {
      var url = new URL(window.location.href);
      url.searchParams.set('_bust', Date.now().toString());
      window.location.replace(url.toString());
    }, 150);
  }
  
  fetch('/api/version?_=' + Date.now(), { cache: 'no-store' })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var serverVersion = data.version;
      var htmlVersion = window.__P3_HTML_VERSION || 'unknown';
      console.log('[BOOTSTRAP] HTML:', htmlVersion, 'Server:', serverVersion);
      
      if (htmlVersion === 'unknown' || serverVersion !== htmlVersion) {
        clearAndReload('Version mismatch: HTML=' + htmlVersion + ' Server=' + serverVersion);
      } else {
        console.log('[BOOTSTRAP] Versions match, proceeding');
      }
    })
    .catch(function(e) {
      console.log('[BOOTSTRAP] Version check failed:', e.message);
    });
})();
