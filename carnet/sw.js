var C='carnet-v2';
self.addEventListener('install',function(e){e.waitUntil(caches.open(C).then(function(c){return c.addAll(['./','index.html','manifest.webmanifest','icon-192.png'])}).then(function(){return self.skipWaiting()}))});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(k){return Promise.all(k.filter(function(x){return x!==C}).map(function(x){return caches.delete(x)}))}).then(function(){return self.clients.claim()}))});
self.addEventListener('fetch',function(e){
  var r=e.request;if(r.method!=='GET')return;
  var u=new URL(r.url);
  if(u.hostname==='generativelanguage.googleapis.com')return;
  e.respondWith(caches.match(r).then(function(hit){
    var net=fetch(r).then(function(res){if(res&&res.ok&&(u.origin===location.origin||u.hostname==='cdnjs.cloudflare.com'||u.hostname.indexOf('fonts.g')===0)){var cp=res.clone();caches.open(C).then(function(c){c.put(r,cp)})}return res}).catch(function(){return hit});
    return hit||net;
  }));
});
