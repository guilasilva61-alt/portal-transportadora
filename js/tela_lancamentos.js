/* Lançamentos (despesas): botões do tipo, formulário que muda conforme o tipo, lista com filtros.
   Salvar volta a tela limpa para o próximo lançamento (mesmo tipo e mesma data). */
var PT = window.PT || (window.PT = {});
PT.telas = PT.telas || {};

(function (T, U, R, Pc) {
  "use strict";
  var h = U.h;
  function b() { return PT.app.banco; }
  var FILTROS = ["de", "ate", "ftipo", "fveiculo", "ffunc", "fsituacao"];

  function filtrosDe(p) {
    var mes = U.mesAtual();
    return {de: U.dataIso(p.get("de")) || mes[0], ate: U.dataIso(p.get("ate")) || mes[1],
            tipo: R.TIPOS_LANCAMENTO[p.get("ftipo")] ? p.get("ftipo") : "",
            veiculo_id: Pc.intParam(p, "fveiculo"), funcionario_id: Pc.intParam(p, "ffunc"),
            situacao: R.SITUACOES_PAGAR.indexOf(p.get("fsituacao")) >= 0 ? p.get("fsituacao") : ""};
  }
  // Os filtros que estão no endereço (para não perder ao salvar/editar)
  function filtrosDoEndereco(p) {
    var o = {};
    FILTROS.forEach(function (k) { if (p.get(k)) o[k] = p.get(k); });
    return o;
  }
  T.filtrosDoEndereco = filtrosDoEndereco;

  // Lançamento do banco → textos do formulário (para editar)
  function formDe(l) {
    var v = {};
    Object.keys(l).forEach(function (k) { v[k] = l[k] == null ? "" : String(l[k]); });
    v.valor = U.reais(l.valor);
    v.valor_unit = l.valor_unit ? U.reais(l.valor_unit) : "";
    v.quantidade = l.quantidade ? U.qtd(l.quantidade) : "";
    v.litros = l.litros ? U.brNum(l.litros, 2) : "";
    v.preco_litro = l.preco_litro ? U.brNum(l.preco_litro / 1000, 3) : "";
    v.km = l.km ? String(l.km) : "";
    v.proxima_km = l.proxima_km ? String(l.proxima_km) : "";
    return v;
  }

  // Funcionários e veículos ATIVOS para as listas (no editar, o do próprio lançamento também, mesmo inativo)
  function cadastros(l) {
    var funcs = {}, veics = {};
    b().funcionarios().forEach(function (f) { if (f.ativo || (l && f.id === l.funcionario_id)) funcs[f.id] = f; });
    b().veiculos().forEach(function (v) { if (v.ativo || (l && v.id === l.veiculo_id)) veics[v.id] = v; });
    return [funcs, veics];
  }
  function valores(obj) { return Object.keys(obj).map(function (k) { return obj[k]; }); }

  T.lancamentos = function (p, estado) {
    estado = estado || {};
    var cfg = b().config();
    var editarId = Pc.intParam(p, "editar"), editar = editarId ? b().obter("lancamentos", editarId) : null;
    if (editarId && !editar) PT.app.aviso("Esse lançamento não existe mais.", "erro");
    var tipo = editar ? editar.tipo : (R.TIPOS_LANCAMENTO[p.get("tipo")] ? p.get("tipo") : "diaria");
    if (estado.tipo) tipo = estado.tipo;
    var v = estado.valores || (editar ? formDe(editar) :
      {data: U.dataIso(p.get("data")) || U.hoje(), situacao: "A pagar", quantidade: "1"});
    var f = filtrosDe(p), fp = filtrosDoEndereco(p);
    var itens = b().lancamentos(f);
    var kmL = {};
    itens.forEach(function (i) {
      if (i.tipo === "abastecimento" && i.veiculo_id && !kmL["v" + i.veiculo_id]) {
        kmL["v" + i.veiculo_id] = 1;
        Object.assign(kmL, R.consumos(b().abastecimentosDoVeiculo(i.veiculo_id)));
      }
    });
    var cad = cadastros(editar);
    var funcionarios = valores(cad[0]).sort(function (a, c) { return a.nome.localeCompare(c.nome, "pt-BR", {sensitivity: "base"}); });
    var veiculos = valores(cad[1]).sort(function (a, c) { return a.placa < c.placa ? -1 : 1; });
    var fretes = b().fretesParaVincular(U.dataIso(v.data) || U.hoje(), 60, editar ? editar.frete_id : null);
    var total = itens.reduce(function (s, i) { return s + i.valor; }, 0);
    var totalPagar = itens.reduce(function (s, i) { return s + (i.situacao === "A pagar" ? i.valor : 0); }, 0);

    function selFuncionario(rotulo, obrigatorio) {
      return "<label>" + h(rotulo || "Funcionário") + '<select class="campo" name="funcionario_id" id="funcionario"' +
        (obrigatorio !== false ? " required" : "") + '><option value="">' + (obrigatorio !== false ? "— escolha —" : "— nenhum —") +
        "</option>" + funcionarios.map(function (x) {
          return '<option value="' + x.id + '" data-diaria="' + (x.valor_diaria ? U.reais(x.valor_diaria) : "") + '"' +
            (String(v.funcionario_id) === String(x.id) ? " selected" : "") + ">" + h(x.nome) + (x.funcao ? " (" + h(x.funcao) + ")" : "") + "</option>";
        }).join("") + "</select></label>";
    }
    function selVeiculo(obrigatorio) {
      return '<label>Veículo<select class="campo" name="veiculo_id" id="veiculo"' + (obrigatorio !== false ? " required" : "") +
        '><option value="">' + (obrigatorio !== false ? "— escolha —" : "— nenhum —") + "</option>" +
        veiculos.map(function (x) {
          return '<option value="' + x.id + '"' + (String(v.veiculo_id) === String(x.id) ? " selected" : "") + ">" +
            h(U.placa(x.placa)) + (x.modelo ? " · " + h(x.modelo) : "") + "</option>";
        }).join("") + "</select></label>";
    }
    function texto(nome, rotulo, extra, classe) {
      return '<label class="' + (classe || "") + '">' + h(rotulo) + ' <input class="campo" name="' + nome + '" value="' + h(v[nome] || "") +
        '" ' + (extra || "") + "></label>";
    }
    function numero(nome, rotulo, modo, extra) {
      return "<label>" + h(rotulo) + ' <input class="campo numero" name="' + nome + '" id="' + nome + '" inputmode="' + (modo || "decimal") +
        '" value="' + h(v[nome] || (nome === "quantidade" ? "1" : "")) + '" ' + (extra || "") + "></label>";
    }

    var campos = "";
    if (tipo === "diaria") {
      campos = selFuncionario("Motorista / ajudante") + selVeiculo(false) +
        numero("quantidade", "Quantidade de diárias", "decimal") + Pc.dinheiro("valor_unit", "Valor de cada diária", v.valor_unit) +
        texto("destino", "Destino / rota", 'maxlength="200" placeholder="ex.: Goiânia → Anápolis"', "largo") +
        texto("observacao", "Observação", 'maxlength="500"', "largo");
    } else if (tipo === "bonificacao") {
      campos = selFuncionario() + Pc.dinheiro("valor", "Valor", v.valor) +
        texto("descricao", "Motivo", 'maxlength="200" required placeholder="ex.: meta de entregas"', "largo");
    } else if (tipo === "abastecimento") {
      campos = selVeiculo() + selFuncionario("Motorista", false) + texto("posto", "Posto", 'maxlength="80"') +
        '<label>Combustível <select class="campo" name="combustivel">' + Pc.opcoes(cfg.combustiveis, v.combustivel) + "</select></label>" +
        numero("litros", "Litros", "decimal", 'placeholder="0,00"') +
        Pc.dinheiro("preco_litro", "Valor do litro", v.preco_litro, "0,000") + Pc.dinheiro("valor", "Total", v.valor) +
        numero("km", "Km do hodômetro", "numeric") +
        '<div class="info-consumo largo" id="info-consumo" aria-live="polite"></div>';
    } else if (tipo === "manutencao") {
      campos = selVeiculo() + '<div class="grupo-campo"><span class="rotulo">Tipo</span>' +
        Pc.segmentado("manut_tipo", R.MANUT_TIPOS, v.manut_tipo || "Corretiva") + "</div>" +
        texto("descricao", "Serviço / peça", 'maxlength="200" required placeholder="ex.: troca de óleo e filtros"', "largo") +
        texto("oficina", "Oficina", 'maxlength="80"') + numero("km", "Km", "numeric") + Pc.dinheiro("valor", "Valor", v.valor) +
        numero("proxima_km", "Próxima revisão (km)", "numeric", 'placeholder="opcional"') +
        '<label>Próxima revisão (data) <input class="campo" type="date" name="proxima_data" value="' + h(v.proxima_data || "") + '"></label>';
    } else if (tipo === "pedagio") {
      campos = selVeiculo() + selFuncionario("Motorista", false) +
        texto("praca", "Praça / rodovia", 'maxlength="80" required list="pracas" placeholder="ex.: BR-153 Goiânia/Anápolis" autocomplete="off"') +
        '<datalist id="pracas">' + b().pracasUsadas().map(function (x) { return '<option value="' + h(x) + '">'; }).join("") + "</datalist>" +
        numero("quantidade", "Quantidade de passagens", "numeric") + Pc.dinheiro("valor_unit", "Valor de cada passagem", v.valor_unit) +
        '<label>Forma de pagamento <select class="campo" name="forma_pagamento">' + Pc.opcoes(cfg.formas_pedagio, v.forma_pagamento) + "</select></label>" +
        '<label class="largo">Frete / viagem vinculada <select class="campo" name="frete_id"><option value="">— nenhum (opcional) —</option>' +
        fretes.map(function (fr) {
          return '<option value="' + fr.id + '"' + (String(v.frete_id) === String(fr.id) ? " selected" : "") + ">" + U.dataBr(fr.data) +
            " · " + h(fr.cliente || "sem cliente") + (fr.documento ? " · nº " + h(fr.documento) : "") +
            (fr.origem || fr.destino ? " · " + h(fr.origem) + " → " + h(fr.destino) : "") + (fr.placa ? " · " + U.placa(fr.placa) : "") + "</option>";
        }).join("") + "</select></label>" + texto("observacao", "Observação", 'maxlength="500"', "largo");
    } else if (tipo === "despesa") {
      campos = '<label>Categoria <select class="campo" name="categoria">' + Pc.opcoes(cfg.categorias_despesa, v.categoria) + "</select></label>" +
        selVeiculo(false) + selFuncionario("Funcionário", false) + Pc.dinheiro("valor", "Valor", v.valor) +
        texto("descricao", "Descrição", 'maxlength="200"', "largo");
    }

    var titulos = {diaria: "diária", bonificacao: "bonificação", abastecimento: "abastecimento", manutencao: "manutenção",
                   pedagio: "pedágio", despesa: "despesa"};
    var titulo = editar ? "Editar " + titulos[tipo] : ((tipo === "abastecimento" || tipo === "pedagio") ? "Novo " : "Nova ") + titulos[tipo];

    var botoes = Object.keys(R.TIPOS_LANCAMENTO).map(function (k) {
      return '<a class="tipo-botao' + (k === tipo ? " ativo" : "") + (editar && k !== tipo ? " desabilitado" : "") + '"' +
        (editar ? "" : ' href="' + Pc.link("lancamentos", Object.assign({tipo: k, data: v.data}, fp)) + '"') + ">" + Pc.icone(k) + "<span>" +
        h(R.TIPOS_LANCAMENTO[k]) + "</span></a>";
    }).join("");

    var linhas = itens.map(function (i) {
      var det;
      if (i.tipo === "diaria") det = U.qtd(i.quantidade) + " × " + U.rs(i.valor_unit) + (i.destino ? " · " + h(i.destino) : "");
      else if (i.tipo === "bonificacao") det = h(i.descricao);
      else if (i.tipo === "abastecimento") {
        det = U.brNum(i.litros, 2) + " L × R$ " + U.brNum(i.preco_litro / 1000, 3) + " · " + h(i.combustivel) +
          (i.posto ? " · " + h(i.posto) : "") + (i.km ? " · km " + U.brNum(i.km, 0) : "");
        if (kmL[i.id]) det += ' · <b class="consumo">' + U.brNum(kmL[i.id].km_l, 2) + " km/l</b>";
      } else if (i.tipo === "pedagio") {
        det = h(i.praca) + " · " + U.qtd(i.quantidade) + " × " + U.rs(i.valor_unit) + (i.forma_pagamento ? " · " + h(i.forma_pagamento) : "") +
          (i.frete_id ? " · <small>frete vinculado</small>" : "");
      } else if (i.tipo === "manutencao") {
        det = h(i.manut_tipo) + " · " + h(i.descricao) + (i.oficina ? " · " + h(i.oficina) : "") + (i.km ? " · km " + U.brNum(i.km, 0) : "");
        if (i.proxima_km || i.proxima_data) {
          det += " · <small>próxima: " + (i.proxima_km ? U.brNum(i.proxima_km, 0) + " km" : "") +
            (i.proxima_km && i.proxima_data ? " / " : "") + U.dataBr(i.proxima_data) + "</small>";
        }
      } else det = h(i.categoria) + (i.descricao ? " · " + h(i.descricao) : "");
      if (i.observacao) det += ' <small class="nota">(' + h(i.observacao) + ")</small>";
      return '<tr class="' + (editar && editar.id === i.id ? "editando" : "") + '"><td>' + U.dataBr(i.data) + '</td><td><span class="tipo-selo t-' +
        i.tipo + '">' + h(R.TIPOS_LANCAMENTO[i.tipo]) + "</span></td><td>" + h(i.funcionario || "") + "</td><td>" + h(U.placa(i.placa)) +
        '</td><td class="detalhe">' + det + '</td><td class="num"><b>' + U.rs(i.valor) + "</b></td><td>" +
        Pc.seloSituacao(i.situacao, "situacao-lanc", i.id) + '</td><td class="acoes-linha"><a class="botao-pequeno" href="' +
        Pc.link("lancamentos", Object.assign({editar: i.id}, fp)) + '">Editar</a> <button type="button" class="botao-pequeno perigo" data-acao="excluir-lanc" data-id="' +
        i.id + '">Excluir</button></td></tr>';
    }).join("") || '<tr><td colspan="8" class="vazio">Nenhum lançamento neste filtro.</td></tr>';

    var todosV = b().veiculos(), todosF = b().funcionarios();
    var html =
      "<h1>Lançamentos</h1>" +
      '<nav class="tipos-lanc" aria-label="Tipo de lançamento">' + botoes + "</nav>" +
      '<form class="painel-form form-lanc" id="form-lanc" data-tipo="' + tipo + '" autocomplete="off" novalidate>' +
      '<h2 class="painel-titulo">' + h(titulo) + "</h2>" + Pc.erros(estado.erros) +
      '<div class="campos"><label>Data <input class="campo" type="date" name="data" value="' + h(v.data) + '" required></label>' + campos + "</div>" +
      '<div class="rodape-form"><div class="total-box" id="total-box"' + (["diaria", "abastecimento", "pedagio"].indexOf(tipo) < 0 ? " hidden" : "") +
      '>Total <b id="total-calc">R$ 0,00</b></div>' + Pc.segmentado("situacao", R.SITUACOES_PAGAR, v.situacao || "A pagar", "situacao") +
      '<button class="botao-salvar" type="submit">' + (editar ? "Salvar alterações" : "Lançar") + "</button>" +
      (editar ? '<a class="botao-pequeno" href="' + Pc.link("lancamentos", Object.assign({tipo: tipo}, fp)) + '">Cancelar</a>' : "") +
      "</div></form>" +
      '<h2 id="lista">Lançamentos do período</h2>' +
      '<form class="filtros" id="filtros">' +
      '<label>De <input class="campo-filtro" type="date" name="de" value="' + f.de + '"></label>' +
      '<label>Até <input class="campo-filtro" type="date" name="ate" value="' + f.ate + '"></label>' +
      '<label>Tipo <select class="campo-filtro" name="ftipo"><option value="">Todos</option>' +
      Pc.opcoes(Object.keys(R.TIPOS_LANCAMENTO), f.tipo, null, function (k) { return R.TIPOS_LANCAMENTO[k]; }) + "</select></label>" +
      '<label>Veículo <select class="campo-filtro" name="fveiculo"><option value="">Todos</option>' +
      Pc.opcoes(todosV, f.veiculo_id, function (x) { return x.id; }, function (x) { return U.placa(x.placa); }) + "</select></label>" +
      '<label>Funcionário <select class="campo-filtro" name="ffunc"><option value="">Todos</option>' +
      Pc.opcoes(todosF, f.funcionario_id, function (x) { return x.id; }, function (x) { return x.nome; }) + "</select></label>" +
      '<label>Situação <select class="campo-filtro" name="fsituacao"><option value="">Todas</option>' +
      Pc.opcoes(R.SITUACOES_PAGAR, f.situacao) + "</select></label>" +
      '<button class="botao-pequeno destaque" type="submit">Filtrar</button></form>' +
      '<div class="totais-lista"><span>' + itens.length + " lançamento(s)</span><span>Total: <b>" + U.rs(total) +
      '</b></span><span>A pagar: <b class="txt-vermelho">' + U.rs(totalPagar) + '</b></span><span>Pago: <b class="txt-verde">' +
      U.rs(total - totalPagar) + "</b></span></div>" +
      '<div class="rolagem"><table class="tabela lista"><thead><tr><th>Data</th><th>Tipo</th><th>Funcionário</th><th>Veículo</th>' +
      '<th>Detalhe</th><th class="num">Valor</th><th>Situação</th><th></th></tr></thead><tbody>' + linhas + "</tbody></table></div>";

    return {
      html: html, menu: "lancamentos",
      depois: function (raiz) {
        var form = raiz.querySelector("#form-lanc");
        PT.comportamento.formLancamento(form, editar);
        form.addEventListener("submit", function (e) {
          e.preventDefault();
          var dados = Pc.lerForm(form);
          dados.tipo = tipo;
          var cad2 = cadastros(editar);
          var idsFretes = b().fretesParaVincular(U.dataIso(dados.data) || U.hoje(), 3650, editar ? editar.frete_id : null)
            .map(function (x) { return x.id; });
          var r = R.montarLancamento(dados, cad2[0], cad2[1], cfg.formas_pedagio, idsFretes);
          if (r[1].length) {
            PT.app.render({valores: dados, erros: r[1], tipo: tipo});
            return;
          }
          var d = r[0], id;
          if (editar) b().alterar("lancamentos", editar.id, d);
          else id = b().criar("lancamentos", d);
          if (d.km && d.veiculo_id) b().atualizarKm(d.veiculo_id, d.km);
          var quem = (cad2[0][d.funcionario_id] || {}).nome || U.placa((cad2[1][d.veiculo_id] || {}).placa);
          PT.app.aviso((editar ? "Alterado" : "Lançado") + ": " + R.TIPOS_LANCAMENTO[d.tipo] + (quem ? " — " + quem : "") +
            " — R$ " + U.reais(d.valor) + " (" + d.situacao + ").", "ok");
          PT.app.ir(Pc.link("lancamentos", Object.assign({tipo: d.tipo, data: editar ? null : d.data}, fp)), true);
        });
        PT.comportamento.filtros(raiz.querySelector("#filtros"), "lancamentos", {tipo: tipo});
        raiz.querySelectorAll("[data-acao=situacao-lanc]").forEach(function (bt) {
          bt.addEventListener("click", function () {
            var l = b().obter("lancamentos", bt.dataset.id);
            if (!l) return;
            b().alterar("lancamentos", l.id, {situacao: l.situacao === "A pagar" ? "Pago" : "A pagar"}, "situacao");
            PT.app.render(estado.valores ? estado : null, true);
          });
        });
        raiz.querySelectorAll("[data-acao=excluir-lanc]").forEach(function (bt) {
          bt.addEventListener("click", function () {
            var l = b().obter("lancamentos", bt.dataset.id);
            if (!l) return;
            if (!window.confirm("Excluir este lançamento? " + R.TIPOS_LANCAMENTO[l.tipo] + " de " + U.dataBr(l.data) + " — " + U.rs(l.valor))) return;
            b().excluir("lancamentos", l.id);
            PT.app.aviso("Lançamento excluído: " + R.TIPOS_LANCAMENTO[l.tipo] + " de " + l.data.slice(8, 10) + "/" + l.data.slice(5, 7) +
              " — R$ " + U.reais(l.valor) + ".", "ok");
            if (editar && editar.id === l.id) PT.app.ir(Pc.link("lancamentos", Object.assign({tipo: tipo}, fp)));
            else PT.app.render(null, true);
          });
        });
      }
    };
  };
})(PT.telas, PT.util, PT.regras, PT.pecas);
