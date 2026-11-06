(function (root) {
  'use strict';
  var scope = 'guest', database = null, VERSION = 'eleven-flash-v1', MAX = 8000000, TTL = 7 * 86400000;
  function key(text) { return VERSION + '\n' + scope + '\n' + text; }
  function open(callback) {
    if (database) { callback(database); return; }
    if (!root.indexedDB) { callback(null); return; }
    var finished = false, timer = root.setTimeout(function () { done(null); }, 500);
    function done(db) { if (finished) return; finished = true; root.clearTimeout(timer); callback(db); }
    try {
      var request = root.indexedDB.open('aguirra-voice-cache', 1);
      request.onupgradeneeded = function () { request.result.createObjectStore('clips', { keyPath: 'key' }); };
      request.onsuccess = function () { database = request.result; done(database); };
      request.onerror = request.onblocked = function () { done(null); };
    } catch (e) { done(null); }
  }
  function read(text, callback) {
    var owner = scope, id = key(text), finished = false, timer = root.setTimeout(function () { done(null); }, 700);
    function done(data) { if (finished) return; finished = true; root.clearTimeout(timer); callback(scope === owner ? data : null); }
    open(function (db) {
      if (!db || scope !== owner) { done(null); return; }
      try {
        var request = db.transaction('clips', 'readonly').objectStore('clips').get(id);
        request.onsuccess = function () { var value = request.result; done(value && value.scope === owner && value.expires > Date.now() && value.updated <= Date.now() && value.data && typeof value.data.audio_base64 === 'string' ? value.data : null); };
        request.onerror = function () { done(null); };
      } catch (e) { done(null); }
    });
  }
  function trim(store) {
    var records = [], bytes = 0, request = store.openCursor();
    request.onsuccess = function () {
      var cursor = request.result;
      if (cursor) { var value = cursor.value; if (value.expires <= Date.now()) cursor.delete(); else { records.push(value); bytes += value.size; } cursor.continue(); return; }
      records.sort(function (a, b) { return a.updated - b.updated; });
      while (records.length && (bytes > MAX || records.length > 20)) { var oldest = records.shift(); bytes -= oldest.size; store.delete(oldest.key); }
    };
  }
  function write(text, data) {
    var owner = scope, id = key(text); if (!data || !data.audio_base64 || data.audio_base64.length > MAX) return;
    open(function (db) { if (!db || scope !== owner) return; try { var store = db.transaction('clips', 'readwrite').objectStore('clips'); store.put({ key: id, scope: owner, updated: Date.now(), expires: Date.now() + TTL, size: JSON.stringify(data).length, data: data }); trim(store); } catch (e) { /* Voice remains available when device storage is full. */ } });
  }
  function clear() {
    var owner = scope;
    open(function (db) { if (!db) return; try { var request = db.transaction('clips', 'readwrite').objectStore('clips').openCursor(); request.onsuccess = function () { var cursor = request.result; if (!cursor) return; if (cursor.value.scope === owner) cursor.delete(); cursor.continue(); }; } catch (e) { /* Private browsing may disable persistent storage. */ } });
  }
  root.AguirraAudioCache = { read: read, write: write, clear: clear, setScope: function (value) { scope = String(value || 'guest'); } };
}(this));
