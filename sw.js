/* Funcionamento sem internet: guarda os arquivos do portal no iPad e abre sempre daqui.
   Ao mudar qualquer arquivo do portal, AUMENTE a VERSAO abaixo (é ela que faz o iPad baixar a versão nova).
   Os DADOS não passam por aqui: ficam no banco do aparelho (IndexedDB). */
var VERSAO = "pt-ipad-1.0.0";
var ARQUIVOS = [
  "./", "index.html", "manifest.webmanifest",
  "css/estilo.css", "css/transportadora.css", "css/tema.css", "css/ipad.css", "css/fundo.svg",
  "img/icone.svg", "img/icone-180.png", "img/icone-192.png", "img/icone-512.png",
  "js/util.js", "js/extenso.js", "js/regras.js", "js/banco.js", "js/relatorios.js", "js/pecas.js", "js/comportamento.js",
  "js/tela_inicio.js", "js/tela_lancamentos.js", "js/tela_recebimentos.js", "js/tela_cadastros.js", "js/tela_relatorios.js",
  "js/demo.js", "js/app.js"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSAO).then(function (c) {
    return c.addAll(ARQUIVOS.map(function (a) { return new Request(a, {cache: "reload"}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (nomes) {
    return Promise.all(nomes.filter(function (n) { return n !== VERSAO; }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

// Primeiro o que está guardado (abre na hora, mesmo sem internet); se não tiver, busca na internet
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request, {ignoreSearch: true}).then(function (r) {
    return r || fetch(e.request).catch(function () { return caches.match("index.html"); });
  }));
});
