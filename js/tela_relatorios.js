/* Relatórios (filtro de período e botão imprimir): por motorista (+ recibo em 2 vias), por veículo e geral. */
var PT = window.PT || (window.PT = {});
PT.telas = PT.telas || {};

(function (T, U, R, Pc, Rel, E) {
  "use strict";
  var h = U.h;
  function b() { return PT.app.banco; }

  // ?de=&ate= (ou ?mes=AAAA-MM); padrão: o mês atual
  function periodo(p) {
    var mes = p.get("mes") || "";
    if (mes.length === 7 && U.dataIso(mes + "-01")) return U.mesAtual(mes + "-01");
    var m = U.mesAtual();
    return [U.dataIso(p.get("de")) || m[0], U.dataIso(p.get("ate")) || m[1]];
  }
  function ctx(p) {
    var per = periodo(p), hoje = U.hoje();
    var passado = U.somaDias(hoje.slice(0, 8) + "01", -1).slice(0, 7);
    return {de: per[0], ate: per[1], txt: U.dataBr(per[0]) + " a " + U.dataBr(per[1]), este: hoje.slice(0, 7), passado: passado};
  }

  function barraPeriodo(tela, c, extra, funcionarios, func) {
    return '<form class="filtros nao-imprimir" id="periodo">' +
      '<label>De <input class="campo-filtro" type="date" name="de" value="' + c.de + '"></label>' +
      '<label>Até <input class="campo-filtro" type="date" name="ate" value="' + c.ate + '"></label>' +
      (funcionarios ? '<label>Funcionário <select class="campo-filtro" name="func"><option value="">Todos</option>' +
        Pc.opcoes(funcionarios, func, function (x) { return x.id; }, function (x) { return x.nome; }) + "</select></label>" : "") +
      '<button class="botao-pequeno destaque" type="submit">Ver</button>' +
      '<a class="botao-pequeno" href="' + Pc.link(tela, Object.assign({mes: c.este}, extra)) + '">Este mês</a>' +
      '<a class="botao-pequeno" href="' + Pc.link(tela, Object.assign({mes: c.passado}, extra)) + '">Mês passado</a>' +
      '<button class="botao-pequeno" type="button" data-acao="imprimir">🖨 Imprimir</button></form>' +
      '<p class="so-imprimir periodo-impresso">' + h(b().config().empresa) + " — período: " + c.txt + "</p>";
  }
  function ligarPeriodo(raiz, tela) {
    var form = raiz.querySelector("#periodo");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      PT.app.ir(Pc.link(tela, Pc.lerForm(form)));
    });
    raiz.querySelector("[data-acao=imprimir]").addEventListener("click", function () { window.print(); });
  }
  function cabecalho(titulo, impresso) {
    return '<div class="titulo-com-acao nao-imprimir"><h1>' + h(titulo) + '</h1><a class="botao-pequeno" href="#/relatorios">← Relatórios</a></div>' +
      '<h1 class="so-imprimir">' + h(impresso) + "</h1>";
  }

  T.relatorios = function () {
    function cartao(link, cor, icone, titulo, desc) {
      return '<a class="cartao" href="' + link + '"><span class="cartao-icone ' + cor + '">' + Pc.icone(icone) + '</span><span class="cartao-titulo">' +
        titulo + '</span><span class="cartao-desc">' + desc + "</span></a>";
    }
    return {
      menu: "relatorios",
      html: "<h1>Relatórios</h1>" +
        '<p class="nota" style="text-align:left">Escolha o relatório. Todos têm filtro de período (padrão: este mês) e botão para imprimir.</p>' +
        '<div class="cartoes">' +
        cartao("#/relatorios/motorista", "cor-dourado", "funcionarios", "Por motorista", "Diárias e bonificações de cada um, pago e a pagar, com recibo em duas vias") +
        cartao("#/relatorios/veiculo", "cor-azul", "veiculos", "Por veículo", "Combustível, manutenção, outras despesas, km rodado, média km/l, fretes e resultado") +
        cartao("#/relatorios/geral", "cor-vermelho", "relatorios", "Geral do mês", "Recebimentos × despesas por categoria e o resultado") + "</div>"
    };
  };

  // ------------------------------------------------------------------ por motorista
  T["relatorios/motorista"] = function (p) {
    var c = ctx(p), fid = Pc.intParam(p, "func");
    var grupos = Rel.porMotorista(b(), c.de, c.ate, fid);
    var soma = function (k) { return grupos.reduce(function (s, g) { return s + g[k]; }, 0); };
    var html = cabecalho("Relatório por motorista", "Diárias e bonificações por funcionário") +
      barraPeriodo("relatorios/motorista", c, {func: fid}, b().funcionarios(), fid);
    if (!grupos.length) html += '<p class="faixa amarela">Nenhuma diária ou bonificação neste período.</p>';
    if (grupos.length > 1) {
      html += '<div class="rolagem"><table class="tabela lista resumo-rel"><thead><tr><th>Funcionário</th><th class="num">Diárias</th>' +
        '<th class="num">Valor diárias</th><th class="num">Bonificações</th><th class="num">Total</th><th class="num">Pago</th><th class="num">A pagar</th></tr></thead><tbody>' +
        grupos.map(function (g) {
          return '<tr><td><a href="javascript:void(0)" data-ir="f' + g.funcionario_id + '"><b>' + h(g.nome) + '</b></a></td><td class="num">' + U.qtd(g.qtd_diarias) +
            '</td><td class="num">' + U.rs(g.diarias) + '</td><td class="num">' + U.rs(g.bonificacoes) + '</td><td class="num"><b>' + U.rs(g.total) +
            '</b></td><td class="num txt-verde">' + U.rs(g.pago) + '</td><td class="num txt-vermelho">' + U.rs(g.a_pagar) + "</td></tr>";
        }).join("") + '</tbody><tfoot><tr class="linha-total"><td>Total</td><td class="num">' + U.qtd(soma("qtd_diarias")) + '</td><td class="num">' +
        U.rs(soma("diarias")) + '</td><td class="num">' + U.rs(soma("bonificacoes")) + '</td><td class="num"><b>' + U.rs(soma("total")) +
        '</b></td><td class="num">' + U.rs(soma("pago")) + '</td><td class="num">' + U.rs(soma("a_pagar")) + "</td></tr></tfoot></table></div>";
    }
    grupos.forEach(function (g) {
      html += '<section class="bloco-rel" id="f' + g.funcionario_id + '"><div class="titulo-com-acao"><h2>' + h(g.nome) + "</h2>" +
        '<span class="nao-imprimir acoes-recibo">Recibo (2 vias): <a class="botao-pequeno destaque" href="' +
        Pc.link("recibo", {func: g.funcionario_id, de: c.de, ate: c.ate, situacao: "A pagar"}) + '">do que está a pagar</a> <a class="botao-pequeno" href="' +
        Pc.link("recibo", {func: g.funcionario_id, de: c.de, ate: c.ate}) + '">de tudo</a></span></div>' +
        '<div class="rolagem"><table class="tabela lista"><thead><tr><th>Data</th><th>Tipo</th><th>Detalhe</th><th class="num">Valor</th><th>Situação</th></tr></thead><tbody>' +
        g.itens.map(function (i) {
          return "<tr><td>" + U.dataBr(i.data) + "</td><td>" + h(R.TIPOS_LANCAMENTO[i.tipo]) + "</td><td>" +
            (i.tipo === "diaria" ? U.qtd(i.quantidade) + " × " + U.rs(i.valor_unit) + (i.destino ? " · " + h(i.destino) : "") + (i.placa ? " · " + U.placa(i.placa) : "") : h(i.descricao)) +
            '</td><td class="num">' + U.rs(i.valor) + '</td><td><span class="selo-situacao ' + (i.situacao === "Pago" ? "pago" : "pagar") + '">' + h(i.situacao) + "</span></td></tr>";
        }).join("") + '</tbody><tfoot><tr class="linha-total"><td colspan="3">Total (' + U.qtd(g.qtd_diarias) + " diária(s) " + U.rs(g.diarias) +
        " + bonificações " + U.rs(g.bonificacoes) + ')</td><td class="num">' + U.rs(g.total) + "</td><td></td></tr>" +
        '<tr><td colspan="3">Pago</td><td class="num txt-verde">' + U.rs(g.pago) + "</td><td></td></tr>" +
        '<tr><td colspan="3"><b>A pagar</b></td><td class="num txt-vermelho"><b>' + U.rs(g.a_pagar) + "</b></td><td></td></tr></tfoot></table></div></section>";
    });
    return {
      html: html, menu: "relatorios",
      depois: function (raiz) {
        ligarPeriodo(raiz, "relatorios/motorista");
        raiz.querySelectorAll("[data-ir]").forEach(function (a) {
          a.addEventListener("click", function (e) {
            e.preventDefault();
            var alvo = document.getElementById(a.dataset.ir);
            if (alvo) alvo.scrollIntoView({behavior: "smooth"});
          });
        });
      }
    };
  };

  // ------------------------------------------------------------------ recibo (2 vias numa folha A4)
  T.recibo = function (p) {
    var c = ctx(p), fid = Pc.intParam(p, "func");
    var situacao = p.get("situacao") === "A pagar" || p.get("situacao") === "Pago" ? p.get("situacao") : "";
    var f = fid ? b().obter("funcionarios", fid) : null;
    if (!f) return {html: '<p class="faixa amarela">Funcionário não encontrado.</p>', menu: "relatorios"};
    var grupos = Rel.porMotorista(b(), c.de, c.ate, fid, situacao);
    var g = grupos[0] || {itens: [], total: 0, diarias: 0, bonificacoes: 0, qtd_diarias: 0};
    var cfg = b().config(), extenso = E.reaisPorExtenso(g.total);
    var vias = ["VIA DO FUNCIONÁRIO", "VIA DA EMPRESA"].map(function (via, n) {
      var ref = (g.qtd_diarias ? "<b>" + U.qtd(g.qtd_diarias) + " diária(s)</b> (" + U.rs(g.diarias) + ")" : "") +
        (g.qtd_diarias && g.bonificacoes ? " e " : "") + (g.bonificacoes ? "<b>bonificação(ões)</b> (" + U.rs(g.bonificacoes) + ")" : "");
      return '<div class="via"><div class="cab"><div class="emp"><span>' + h(cfg.empresa) + (cfg.cnpj ? "<small>CNPJ " + h(cfg.cnpj) + "</small>" : "") +
        '</span></div><div class="via-nome">' + via + "</div></div><h1>RECIBO</h1>" +
        '<div class="valor">' + U.rs(g.total) + "</div><p>Recebi de <b>" + h(cfg.empresa) + "</b> a importância de <b>" + U.rs(g.total) +
        "</b> (" + h(extenso) + "), referente a " + ref + " no período de " + c.txt + (situacao === "A pagar" ? " (somente o que estava a pagar)" : "") +
        '.</p><div class="itens"><table><thead><tr><th>Data</th><th>Tipo</th><th>Detalhe</th><th class="n">Valor</th></tr></thead><tbody>' +
        g.itens.slice(0, 14).map(function (i) {
          return "<tr><td>" + U.dataBr(i.data) + "</td><td>" + h(R.TIPOS_LANCAMENTO[i.tipo]) + "</td><td>" +
            (i.tipo === "diaria" ? U.qtd(i.quantidade) + " × " + U.rs(i.valor_unit) + (i.destino ? " · " + h(i.destino) : "") : h(i.descricao)) +
            '</td><td class="n">' + U.rs(i.valor) + "</td></tr>";
        }).join("") +
        (g.itens.length > 14 ? '<tr><td colspan="4">… e mais ' + (g.itens.length - 14) + " lançamento(s) (ver relatório por motorista)</td></tr>" : "") +
        '</tbody><tfoot><tr><td colspan="3">Total</td><td class="n">' + U.rs(g.total) + "</td></tr></tfoot></table></div>" +
        '<p class="local">________________________, ____ de ________________ de ________</p>' +
        '<div class="assinaturas"><div>' + h(f.nome) + "<br><small>" + h(f.funcao) + "</small></div><div>" + h(cfg.empresa) + "</div></div></div>" +
        (n === 0 ? '<div class="corte"><span>✂ corte aqui</span></div>' : "");
    }).join("");
    return {
      html: '<div class="barra-recibo"><button type="button" class="botao-pequeno" data-acao="voltar">← Voltar</button> ' +
        '<button type="button" class="botao-pequeno destaque" data-acao="imprimir">🖨 Imprimir recibo</button></div><div class="folha">' + vias + "</div>",
      menu: "relatorios", modo: "recibo",
      depois: function (raiz) {
        raiz.querySelector("[data-acao=imprimir]").addEventListener("click", function () { window.print(); });
        raiz.querySelector("[data-acao=voltar]").addEventListener("click", function () {
          PT.app.ir(Pc.link("relatorios/motorista", {de: c.de, ate: c.ate}));
        });
      }
    };
  };

  // ------------------------------------------------------------------ por veículo
  T["relatorios/veiculo"] = function (p) {
    var c = ctx(p), linhas = Rel.porVeiculo(b(), c.de, c.ate);
    var tot = {};
    ["combustivel", "manutencao", "pedagio", "outras", "diarias", "despesas", "fretes", "resultado"].forEach(function (k) {
      tot[k] = linhas.reduce(function (s, l) { return s + l[k]; }, 0);
    });
    var cor = function (v) { return v >= 0 ? "txt-verde" : "txt-vermelho"; };
    var html = cabecalho("Relatório por veículo", "Resultado por veículo") + barraPeriodo("relatorios/veiculo", c, {});
    if (!linhas.length) html += '<p class="faixa amarela">Nenhum veículo cadastrado.</p>';
    else {
      html += '<div class="rolagem"><table class="tabela lista rel-veiculo"><thead><tr><th>Veículo</th><th class="num">Combustível</th><th class="num">Manutenção</th>' +
        '<th class="num">Pedágio</th><th class="num">Outras despesas</th><th class="num">Diárias</th><th class="num">Total gasto</th><th class="num">Km rodado</th>' +
        '<th class="num">Média km/l</th><th class="num">Custo/km</th><th class="num">Fretes</th><th class="num">Resultado</th></tr></thead><tbody>' +
        linhas.map(function (l) {
          return '<tr class="' + (l.veiculo.ativo ? "" : "inativo") + '"><td><b>' + h(U.placa(l.veiculo.placa)) + '</b><br><small class="nota">' + h(l.veiculo.modelo) +
            (l.veiculo.tipo ? " · " + h(l.veiculo.tipo) : "") + '</small></td><td class="num">' + U.rs(l.combustivel) +
            (l.litros ? '<br><small class="nota">' + U.brNum(l.litros, 0) + " L</small>" : "") + '</td><td class="num">' + U.rs(l.manutencao) +
            '</td><td class="num">' + U.rs(l.pedagio) + '</td><td class="num">' + U.rs(l.outras) + '</td><td class="num">' + U.rs(l.diarias) +
            '</td><td class="num"><b>' + U.rs(l.despesas) + '</b></td><td class="num">' + (l.km_rodado != null ? U.brNum(l.km_rodado, 0) + " km" : "—") +
            '</td><td class="num">' + (l.km_l ? U.brNum(l.km_l, 2) + " km/l" : "—") + '</td><td class="num">' + (l.custo_km ? "R$ " + U.reais(l.custo_km) : "—") +
            '</td><td class="num">' + U.rs(l.fretes) + (l.qtd_fretes ? '<br><small class="nota">' + l.qtd_fretes + " frete(s)" +
              (l.fretes > l.fretes_recebidos ? " · a receber " + U.rs(l.fretes - l.fretes_recebidos) : "") + "</small>" : "") +
            '</td><td class="num"><b class="' + cor(l.resultado) + '">' + U.rs(l.resultado) + "</b></td></tr>";
        }).join("") + '</tbody><tfoot><tr class="linha-total"><td>Total</td><td class="num">' + U.rs(tot.combustivel) + '</td><td class="num">' +
        U.rs(tot.manutencao) + '</td><td class="num">' + U.rs(tot.pedagio) + '</td><td class="num">' + U.rs(tot.outras) + '</td><td class="num">' +
        U.rs(tot.diarias) + '</td><td class="num">' + U.rs(tot.despesas) + '</td><td></td><td></td><td></td><td class="num">' + U.rs(tot.fretes) +
        '</td><td class="num"><b class="' + cor(tot.resultado) + '">' + U.rs(tot.resultado) + "</b></td></tr></tfoot></table></div>" +
        '<p class="nota" style="text-align:left">Resultado = fretes do veículo − (combustível + manutenção + pedágio + outras despesas + diárias lançadas com este veículo). ' +
        "Km rodado: do último km registrado antes do período até o maior km do período (abastecimentos e manutenções). " +
        "Média km/l: km rodado ÷ litros, contando os abastecimentos com km informado. Bonificações e despesas sem veículo ficam no relatório geral.</p>";
    }
    return {html: html, menu: "relatorios", depois: function (raiz) { ligarPeriodo(raiz, "relatorios/veiculo"); }};
  };

  // ------------------------------------------------------------------ geral
  T["relatorios/geral"] = function (p) {
    var c = ctx(p), r = Rel.geral(b(), c.de, c.ate);
    var html = cabecalho("Relatório geral", "Recebimentos × despesas") + barraPeriodo("relatorios/geral", c, {}) +
      '<div class="resumo-mes geral">' +
      '<div class="resumo-item verde"><span class="resumo-rotulo">Entradas</span><b>' + U.rs(r.total_entradas) + "</b><small>já recebido: " + U.rs(r.recebido) + "</small></div>" +
      '<div class="resumo-item vermelho"><span class="resumo-rotulo">Despesas</span><b>' + U.rs(r.total_saidas) + "</b><small>já pago: " + U.rs(r.pago) + "</small></div>" +
      '<div class="resumo-item ' + (r.resultado >= 0 ? "verde" : "vermelho") + '"><span class="resumo-rotulo">Resultado</span><b>' + U.rs(r.resultado) +
      "</b><small>entradas − despesas</small></div>" +
      '<div class="resumo-item dourado"><span class="resumo-rotulo">No caixa</span><b>' + U.rs(r.caixa) + "</b><small>recebido − pago</small></div></div>" +
      '<div class="duas-colunas"><section><h2>Entradas</h2><div class="rolagem"><table class="tabela lista"><thead><tr><th>Categoria</th><th class="num">Qtd.</th>' +
      '<th class="num">Total</th><th class="num">Recebido</th><th class="num">A receber</th></tr></thead><tbody>' +
      (r.entradas.map(function (e) {
        return "<tr><td>" + h(e.categoria) + '</td><td class="num">' + e.qtd + '</td><td class="num"><b>' + U.rs(e.total) + '</b></td><td class="num txt-verde">' +
          U.rs(e.feito) + '</td><td class="num txt-vermelho">' + U.rs(e.total - e.feito) + "</td></tr>";
      }).join("") || '<tr><td colspan="5" class="vazio">Nenhum recebimento no período.</td></tr>') +
      '</tbody><tfoot><tr class="linha-total"><td>Total</td><td></td><td class="num">' + U.rs(r.total_entradas) + '</td><td class="num">' + U.rs(r.recebido) +
      '</td><td class="num">' + U.rs(r.total_entradas - r.recebido) + "</td></tr></tfoot></table></div></section>" +
      '<section><h2>Despesas por categoria</h2><div class="rolagem"><table class="tabela lista"><thead><tr><th>Categoria</th><th class="num">Qtd.</th><th class="num">Total</th>' +
      '<th class="num">%</th><th class="num">Pago</th><th class="num">A pagar</th></tr></thead><tbody>' +
      (r.saidas.map(function (s) {
        return "<tr><td>" + h(s.categoria) + '</td><td class="num">' + s.qtd + '</td><td class="num"><b>' + U.rs(s.total) +
          '</b></td><td class="num"><span class="barra-pct" style="--pct: ' + s.pct + '%">' + s.pct + '%</span></td><td class="num txt-verde">' + U.rs(s.feito) +
          '</td><td class="num txt-vermelho">' + U.rs(s.total - s.feito) + "</td></tr>";
      }).join("") || '<tr><td colspan="6" class="vazio">Nenhuma despesa no período.</td></tr>') +
      '</tbody><tfoot><tr class="linha-total"><td>Total</td><td></td><td class="num">' + U.rs(r.total_saidas) + '</td><td></td><td class="num">' + U.rs(r.pago) +
      '</td><td class="num">' + U.rs(r.total_saidas - r.pago) + "</td></tr></tfoot></table></div></section></div>" +
      '<p class="nota" style="text-align:left">Tudo pela data do lançamento/recebimento dentro do período. “No caixa” considera só o que já foi recebido e pago.</p>';
    return {html: html, menu: "relatorios", depois: function (raiz) { ligarPeriodo(raiz, "relatorios/geral"); }};
  };
})(PT.telas, PT.util, PT.regras, PT.pecas, PT.relatorios, PT.extenso);
