/* Recebimentos (entradas): Frete | Outra entrada, no mesmo esquema dos Lançamentos.
   Cliente novo é cadastrado na hora, pela própria tela do frete. Clientes também têm lista própria. */
var PT = window.PT || (window.PT = {});
PT.telas = PT.telas || {};

(function (T, U, R, Pc) {
  "use strict";
  var h = U.h;
  function b() { return PT.app.banco; }
  var FILTROS = ["de", "ate", "ftipo", "fcliente", "fveiculo", "ffunc", "fsituacao"];

  function filtrosDe(p) {
    var mes = U.mesAtual();
    return {de: U.dataIso(p.get("de")) || mes[0], ate: U.dataIso(p.get("ate")) || mes[1],
            tipo: R.TIPOS_RECEBIMENTO[p.get("ftipo")] ? p.get("ftipo") : "",
            cliente_id: Pc.intParam(p, "fcliente"), veiculo_id: Pc.intParam(p, "fveiculo"),
            funcionario_id: Pc.intParam(p, "ffunc"),
            situacao: R.SITUACOES_RECEBER.indexOf(p.get("fsituacao")) >= 0 ? p.get("fsituacao") : ""};
  }
  function filtrosDoEndereco(p) {
    var o = {};
    FILTROS.forEach(function (k) { if (p.get(k)) o[k] = p.get(k); });
    return o;
  }

  // Só os ATIVOS (no editar, o do próprio recebimento também, mesmo inativo)
  function cadastros(r) {
    function mapa(lista, campo) {
      var m = {};
      lista.forEach(function (x) { if (x.ativo || (r && x.id === r[campo])) m[x.id] = x; });
      return m;
    }
    return [mapa(b().clientes(), "cliente_id"), mapa(b().funcionarios(), "funcionario_id"), mapa(b().veiculos(), "veiculo_id")];
  }
  function lista(m, campo) {
    return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, c) {
      return String(a[campo]).localeCompare(String(c[campo]), "pt-BR", {sensitivity: "base"});
    });
  }

  function formDe(r) {
    var v = {};
    Object.keys(r).forEach(function (k) { v[k] = r[k] == null ? "" : String(r[k]); });
    v.valor = U.reais(r.valor);
    return v;
  }

  T.recebimentos = function (p, estado) {
    estado = estado || {};
    var cfg = b().config();
    var editarId = Pc.intParam(p, "editar"), editar = editarId ? b().obter("recebimentos", editarId) : null;
    if (editarId && !editar) PT.app.aviso("Esse recebimento não existe mais.", "erro");
    var tipo = editar ? editar.tipo : (R.TIPOS_RECEBIMENTO[p.get("tipo")] ? p.get("tipo") : "frete");
    if (estado.tipo) tipo = estado.tipo;
    var v = estado.valores || (editar ? formDe(editar) :
      {data: U.dataIso(p.get("data")) || U.hoje(), situacao: tipo === "outra" ? "Recebido" : "A receber"});
    var f = filtrosDe(p), fp = filtrosDoEndereco(p);
    var itens = b().recebimentos(f);
    var cad = cadastros(editar);
    var total = itens.reduce(function (s, i) { return s + i.valor; }, 0);
    var totalReceber = itens.reduce(function (s, i) { return s + (i.situacao === "A receber" ? i.valor : 0); }, 0);
    function texto(nome, rotulo, extra, classe) {
      return '<label class="' + (classe || "") + '">' + h(rotulo) + ' <input class="campo" name="' + nome + '" id="' + nome + '" value="' +
        h(v[nome] || "") + '" ' + (extra || "") + "></label>";
    }

    var campos;
    if (tipo === "frete") {
      campos = '<label>Cliente <select class="campo" name="cliente_id" id="cliente"><option value="">— escolha —</option>' +
        Pc.opcoes(lista(cad[0], "nome"), v.cliente_id, function (x) { return x.id; }, function (x) { return x.nome; }) +
        '<option value="novo"' + (v.cliente_id === "novo" ? " selected" : "") + ">+ Cadastrar cliente novo…</option></select></label>" +
        '<div class="cliente-novo largo" id="cliente-novo"' + (v.cliente_id !== "novo" ? " hidden" : "") + ">" +
        texto("cliente_novo", "Nome do cliente novo", 'maxlength="80"') +
        texto("cliente_novo_tel", "Telefone", 'inputmode="tel" maxlength="30" placeholder="opcional"') + "</div>" +
        texto("documento", "Nº nota / CT-e", 'maxlength="60"') +
        texto("origem", "Origem", 'maxlength="80" placeholder="cidade de saída"') +
        texto("destino", "Destino", 'maxlength="80" placeholder="cidade de entrega"') +
        '<label>Veículo <select class="campo" name="veiculo_id"><option value="">— nenhum —</option>' +
        Pc.opcoes(lista(cad[2], "placa"), v.veiculo_id, function (x) { return x.id; }, function (x) {
          return U.placa(x.placa) + (x.modelo ? " · " + x.modelo : "");
        }) + "</select></label>" +
        '<label>Motorista <select class="campo" name="funcionario_id"><option value="">— nenhum —</option>' +
        Pc.opcoes(lista(cad[1], "nome"), v.funcionario_id, function (x) { return x.id; }, function (x) { return x.nome; }) + "</select></label>" +
        Pc.dinheiro("valor", "Valor do frete", v.valor) +
        '<label>Forma de recebimento <select class="campo" name="forma">' + Pc.opcoes(cfg.formas_recebimento, v.forma) + "</select></label>" +
        texto("descricao", "Observação", 'maxlength="200"', "largo");
    } else {
      campos = texto("descricao", "Descrição", 'maxlength="200" placeholder="ex.: venda de sucata, reembolso…"', "largo") +
        Pc.dinheiro("valor", "Valor", v.valor);
    }

    var botoes = Object.keys(R.TIPOS_RECEBIMENTO).map(function (k) {
      return '<a class="tipo-botao' + (k === tipo ? " ativo" : "") + (editar && k !== tipo ? " desabilitado" : "") + '"' +
        (editar ? "" : ' href="' + Pc.link("recebimentos", Object.assign({tipo: k, data: v.data}, fp)) + '"') + ">" +
        Pc.icone(k === "frete" ? "veiculos" : "recebimentos") + "<span>" + h(R.TIPOS_RECEBIMENTO[k]) + "</span></a>";
    }).join("");

    var situacao = v.situacao || "A receber";
    var linhas = itens.map(function (i) {
      var quem = i.tipo === "frete" ? "<b>" + h(i.cliente || "?") + "</b>" + (i.documento ? " · nº " + h(i.documento) : "") +
        (i.descricao ? ' <small class="nota">(' + h(i.descricao) + ")</small>" : "") : h(i.descricao);
      return '<tr class="' + (editar && editar.id === i.id ? "editando" : "") + '"><td>' + U.dataBr(i.data) + '</td><td><span class="tipo-selo t-' +
        i.tipo + '">' + h(R.TIPOS_RECEBIMENTO[i.tipo]) + "</span></td><td>" + quem + "</td><td>" +
        (i.origem || i.destino ? h(i.origem) + " → " + h(i.destino) : "") + "</td><td>" + h(U.placa(i.placa)) +
        (i.placa && i.funcionario ? " · " : "") + h(i.funcionario || "") + '</td><td class="num"><b>' + U.rs(i.valor) + "</b>" +
        (i.forma ? '<br><small class="nota">' + h(i.forma) + "</small>" : "") + "</td><td>" + Pc.seloSituacao(i.situacao, "situacao-receb", i.id) +
        (i.situacao === "Recebido" && i.data_recebimento ? '<br><small class="nota">em ' + U.dataBr(i.data_recebimento) + "</small>" : "") +
        '</td><td class="acoes-linha"><a class="botao-pequeno" href="' + Pc.link("recebimentos", Object.assign({editar: i.id}, fp)) +
        '">Editar</a> <button type="button" class="botao-pequeno perigo" data-acao="excluir-receb" data-id="' + i.id + '">Excluir</button></td></tr>';
    }).join("") || '<tr><td colspan="8" class="vazio">Nenhum recebimento neste filtro.</td></tr>';

    var html =
      '<div class="titulo-com-acao"><h1>Recebimentos</h1><a class="botao-pequeno" href="#/clientes">👥 Clientes</a></div>' +
      '<nav class="tipos-lanc dois" aria-label="Tipo de recebimento">' + botoes + "</nav>" +
      '<form class="painel-form form-receb" id="form-receb" data-tipo="' + tipo + '" autocomplete="off" novalidate>' +
      '<h2 class="painel-titulo">' + (editar ? "Editar " : "Novo ") + (tipo === "frete" ? "frete" : "recebimento — outra entrada") + "</h2>" +
      Pc.erros(estado.erros) +
      '<div class="campos"><label>Data <input class="campo" type="date" name="data" value="' + h(v.data) + '" required></label>' + campos + "</div>" +
      '<div class="rodape-form">' + Pc.segmentado("situacao", R.SITUACOES_RECEBER, situacao, "situacao") +
      '<label class="data-receb" id="data-receb"' + (tipo !== "frete" || situacao !== "Recebido" ? " hidden" : "") +
      '>Recebido em <input class="campo" type="date" name="data_recebimento" value="' + h(v.data_recebimento || U.hoje()) + '"></label>' +
      '<button class="botao-salvar" type="submit">' + (editar ? "Salvar alterações" : "Lançar") + "</button>" +
      (editar ? '<a class="botao-pequeno" href="' + Pc.link("recebimentos", Object.assign({tipo: tipo}, fp)) + '">Cancelar</a>' : "") +
      "</div></form>" +
      '<h2 id="lista">Recebimentos do período</h2>' +
      '<form class="filtros" id="filtros">' +
      '<label>De <input class="campo-filtro" type="date" name="de" value="' + f.de + '"></label>' +
      '<label>Até <input class="campo-filtro" type="date" name="ate" value="' + f.ate + '"></label>' +
      '<label>Tipo <select class="campo-filtro" name="ftipo"><option value="">Todos</option>' +
      Pc.opcoes(Object.keys(R.TIPOS_RECEBIMENTO), f.tipo, null, function (k) { return R.TIPOS_RECEBIMENTO[k]; }) + "</select></label>" +
      '<label>Cliente <select class="campo-filtro" name="fcliente"><option value="">Todos</option>' +
      Pc.opcoes(b().clientes(), f.cliente_id, function (x) { return x.id; }, function (x) { return x.nome; }) + "</select></label>" +
      '<label>Veículo <select class="campo-filtro" name="fveiculo"><option value="">Todos</option>' +
      Pc.opcoes(b().veiculos(), f.veiculo_id, function (x) { return x.id; }, function (x) { return U.placa(x.placa); }) + "</select></label>" +
      '<label>Motorista <select class="campo-filtro" name="ffunc"><option value="">Todos</option>' +
      Pc.opcoes(b().funcionarios(), f.funcionario_id, function (x) { return x.id; }, function (x) { return x.nome; }) + "</select></label>" +
      '<label>Situação <select class="campo-filtro" name="fsituacao"><option value="">Todas</option>' +
      Pc.opcoes(R.SITUACOES_RECEBER, f.situacao) + "</select></label>" +
      '<button class="botao-pequeno destaque" type="submit">Filtrar</button></form>' +
      '<div class="totais-lista"><span>' + itens.length + " recebimento(s)</span><span>Total: <b>" + U.rs(total) +
      '</b></span><span>Recebido: <b class="txt-verde">' + U.rs(total - totalReceber) + '</b></span><span>A receber: <b class="txt-vermelho">' +
      U.rs(totalReceber) + "</b></span></div>" +
      '<div class="rolagem"><table class="tabela lista"><thead><tr><th>Data</th><th>Tipo</th><th>Cliente / descrição</th><th>Rota</th>' +
      '<th>Veículo · motorista</th><th class="num">Valor</th><th>Situação</th><th></th></tr></thead><tbody>' + linhas + "</tbody></table></div>";

    return {
      html: html, menu: "recebimentos",
      depois: function (raiz) {
        var form = raiz.querySelector("#form-receb");
        PT.comportamento.formRecebimento(form);
        form.addEventListener("submit", function (e) {
          e.preventDefault();
          var dados = Pc.lerForm(form);
          dados.tipo = tipo;
          var c = cadastros(editar);
          var r = R.montarRecebimento(dados, c[0], c[1], c[2], cfg.formas_recebimento, U.hoje());
          if (r[1].length) { PT.app.render({valores: dados, erros: r[1], tipo: tipo}); return; }
          var d = r[0];
          if (d.tipo === "frete" && dados.cliente_id === "novo") {          // cliente cadastrado na hora
            var nome = U.txt(dados.cliente_novo, 80);
            d.cliente_id = b().criar("clientes", {nome: nome, telefone: U.txt(dados.cliente_novo_tel, 30), ativo: 1});
            c[0][d.cliente_id] = {nome: nome};
          }
          if (editar) b().alterar("recebimentos", editar.id, d);
          else b().criar("recebimentos", d);
          var quem = (c[0][d.cliente_id] || {}).nome || d.descricao;
          PT.app.aviso((editar ? "Alterado" : "Lançado") + ": " + R.TIPOS_RECEBIMENTO[d.tipo] + (quem ? " — " + quem : "") +
            " — R$ " + U.reais(d.valor) + " (" + d.situacao + ").", "ok");
          PT.app.ir(Pc.link("recebimentos", Object.assign({tipo: d.tipo, data: editar ? null : d.data}, fp)), true);
        });
        PT.comportamento.filtros(raiz.querySelector("#filtros"), "recebimentos", {tipo: tipo});
        raiz.querySelectorAll("[data-acao=situacao-receb]").forEach(function (bt) {
          bt.addEventListener("click", function () {
            var r = b().obter("recebimentos", bt.dataset.id);
            if (!r) return;
            b().alterar("recebimentos", r.id, r.situacao === "A receber" ? {situacao: "Recebido", data_recebimento: U.hoje()} :
              {situacao: "A receber", data_recebimento: null}, "situacao");
            PT.app.render(estado.valores ? estado : null, true);
          });
        });
        raiz.querySelectorAll("[data-acao=excluir-receb]").forEach(function (bt) {
          bt.addEventListener("click", function () {
            var r = b().obter("recebimentos", bt.dataset.id);
            if (!r) return;
            if (!window.confirm("Excluir este recebimento? " + R.TIPOS_RECEBIMENTO[r.tipo] + " de " + U.dataBr(r.data) + " — " + U.rs(r.valor))) return;
            b().excluir("recebimentos", r.id);
            PT.app.aviso("Recebimento excluído: " + R.TIPOS_RECEBIMENTO[r.tipo] + " de " + r.data.slice(8, 10) + "/" + r.data.slice(5, 7) +
              " — R$ " + U.reais(r.valor) + ".", "ok");
            if (editar && editar.id === r.id) PT.app.ir(Pc.link("recebimentos", Object.assign({tipo: tipo}, fp)));
            else PT.app.render(null, true);
          });
        });
      }
    };
  };
})(PT.telas, PT.util, PT.regras, PT.pecas);
