/* Peças das telas: ícones, logo, listas suspensas, campos de dinheiro, endereços (#/tela?…) e leitura de formulários. */
var PT = window.PT || (window.PT = {});

(function (Pc, U) {
  "use strict";
  var h = U.h;

  var ICONES = {
    lancamentos: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
    recebimentos: '<circle cx="12" cy="12" r="10"/><polyline points="8 12 12 16 16 12"/><line x1="12" y1="8" x2="12" y2="16"/>',
    veiculos: '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
    funcionarios: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    relatorios: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    diaria: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    bonificacao: '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
    abastecimento: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
    manutencao: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    pedagio: '<line x1="4" y1="21" x2="4" y2="4"/><line x1="2" y1="21" x2="8" y2="21"/><rect x="4" y="6" width="17" height="4" rx="1"/><line x1="9" y1="6" x2="11" y2="10"/><line x1="15" y1="6" x2="17" y2="10"/><circle cx="4" cy="4" r="1.5"/>',
    despesa: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    gasto: '<circle cx="12" cy="12" r="10"/><polyline points="16 12 12 8 8 12"/><line x1="12" y1="16" x2="12" y2="8"/>',
    resultado: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
    copia: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    cadeado: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'
  };

  Pc.icone = function (nome, classe) {
    return '<svg class="' + (classe || "icone") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONES[nome] || "") + "</svg>";
  };

  Pc.logo = function (cfg, classe) {
    return '<span class="logo-texto ' + (classe || "") + '" aria-label="' + h(cfg.nome) + '"><span class="logo-sigla">' +
      h(cfg.iniciais || "PT") + '</span><span class="logo-nome">' + h(cfg.nome) + "</span></span>";
  };

  // Título em duas cores: a última palavra em ouro
  Pc.tituloOuro = function (txt) {
    var i = String(txt).lastIndexOf(" ");
    return i < 0 ? h(txt) : h(txt.slice(0, i)) + ' <span class="ouro">' + h(txt.slice(i + 1)) + "</span>";
  };

  // ------------------------------------------------------------------ endereços
  // #/lancamentos?tipo=diaria&data=… → {tela: "lancamentos", p: URLSearchParams}
  Pc.lerEndereco = function (hash) {
    var t = String(hash || "").replace(/^#\/?/, "");
    var i = t.indexOf("?");
    return {tela: (i < 0 ? t : t.slice(0, i)) || "", p: new URLSearchParams(i < 0 ? "" : t.slice(i + 1))};
  };
  Pc.link = function (tela, args) {
    var q = new URLSearchParams();
    Object.keys(args || {}).forEach(function (k) {
      var v = args[k];
      if (v !== null && v !== undefined && v !== "") q.set(k, v);
    });
    var s = q.toString();
    return "#/" + tela + (s ? "?" + s : "");
  };
  Pc.intParam = function (p, k) {
    var v = U.inteiro(p.get(k));
    return v && v > 0 ? v : null;
  };

  // Formulário → {nome: valor} (o último valor de cada nome; botões de opção só o marcado)
  Pc.lerForm = function (form) {
    var d = {};
    new FormData(form).forEach(function (v, k) { d[k] = typeof v === "string" ? v : ""; });
    return d;
  };

  // ------------------------------------------------------------------ campos
  Pc.opcoes = function (lista, selecionado, valor, rotulo) {
    return lista.map(function (x) {
      var v = valor ? valor(x) : x, r = rotulo ? rotulo(x) : x;
      return '<option value="' + h(v) + '"' + (String(selecionado) === String(v) ? " selected" : "") + ">" + h(r) + "</option>";
    }).join("");
  };

  Pc.dinheiro = function (nome, rotulo, valor, placeholder) {
    return "<label>" + h(rotulo) + ' <span class="com-prefixo"><span>R$</span><input class="campo dinheiro" name="' + nome +
      '" id="' + nome + '" inputmode="decimal" value="' + h(valor || "") + '" placeholder="' + (placeholder || "0,00") +
      '" autocomplete="off"></span></label>';
  };

  Pc.segmentado = function (nome, lista, marcado, classe) {
    return '<span class="segmentado ' + (classe || "") + '" role="radiogroup">' + lista.map(function (s) {
      return '<label><input type="radio" name="' + nome + '" value="' + h(s) + '"' + (s === marcado ? " checked" : "") +
        "><span>" + h(s) + "</span></label>";
    }).join("") + "</span>";
  };

  Pc.erros = function (lista) {
    if (!lista || !lista.length) return "";
    return '<div class="caixa-erro" role="alert">' + lista.map(function (e) { return "<div>⚠ " + h(e) + "</div>"; }).join("") + "</div>";
  };

  Pc.seloSituacao = function (situacao, acao, id) {
    var ok = situacao === "Pago" || situacao === "Recebido";
    return '<button type="button" class="selo-situacao ' + (ok ? "pago" : "pagar") + '" data-acao="' + acao + '" data-id="' + id +
      '" title="Toque para mudar">' + h(situacao) + "</button>";
  };
})(PT.pecas = PT.pecas || {}, PT.util);
