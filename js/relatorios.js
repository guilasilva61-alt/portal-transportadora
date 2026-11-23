/* Contas dos relatórios (sem tela, para testar). Igual ao portal/relatorios.py.
   Período = data do lançamento/recebimento (competência). A situação aparece separada. */
var PT = window.PT || (window.PT = {});

(function (Rel, R) {
  "use strict";

  // Diárias + bonificações de cada funcionário no período, separando pago e a pagar
  Rel.porMotorista = function (b, de, ate, funcionarioId, situacao) {
    var itens = b.lancamentos({de: de, ate: ate, funcionario_id: funcionarioId, situacao: situacao})
      .filter(function (l) { return l.tipo === "diaria" || l.tipo === "bonificacao"; })
      .sort(function (a, c) { return (a.data < c.data ? -1 : a.data > c.data ? 1 : 0) || a.id - c.id; });
    var grupos = {}, ordem = [];
    itens.forEach(function (l) {
      var k = String(l.funcionario_id);
      var g = grupos[k];
      if (!g) {
        g = grupos[k] = {funcionario_id: l.funcionario_id, nome: l.funcionario || "?", itens: [], diarias: 0,
                         qtd_diarias: 0, bonificacoes: 0, pago: 0, a_pagar: 0};
        ordem.push(g);
      }
      g.itens.push(l);
      if (l.tipo === "diaria") { g.diarias += l.valor; g.qtd_diarias += l.quantidade || 0; }
      else g.bonificacoes += l.valor;
      g[l.situacao === "Pago" ? "pago" : "a_pagar"] += l.valor;
    });
    ordem.forEach(function (g) { g.total = g.diarias + g.bonificacoes; });
    return ordem.sort(function (a, c) { return a.nome.localeCompare(c.nome, "pt-BR", {sensitivity: "base"}); });
  };

  // Por veículo: combustível, manutenção, outras despesas, diárias ligadas a ele, km rodado, km/l e fretes
  Rel.porVeiculo = function (b, de, ate) {
    var lancs = b.lancamentos({de: de, ate: ate});
    var fretes = b.recebimentos({de: de, ate: ate, tipo: "frete"});
    var saida = [];
    b.veiculos().forEach(function (v) {
      var meus = lancs.filter(function (l) { return l.veiculo_id === v.id; });
      var meusFretes = fretes.filter(function (r) { return r.veiculo_id === v.id; });
      if (!meus.length && !meusFretes.length && !v.ativo) return;
      var soma = function (tipo) { return meus.reduce(function (s, l) { return s + (l.tipo === tipo ? l.valor : 0); }, 0); };
      var r = {veiculo: v, combustivel: soma("abastecimento"), manutencao: soma("manutencao"), pedagio: soma("pedagio"),
               outras: soma("despesa"), diarias: soma("diaria"),
               litros: meus.reduce(function (s, l) { return s + (l.tipo === "abastecimento" ? (l.litros || 0) : 0); }, 0),
               fretes: meusFretes.reduce(function (s, x) { return s + x.valor; }, 0), qtd_fretes: meusFretes.length,
               fretes_recebidos: meusFretes.reduce(function (s, x) { return s + (x.situacao === "Recebido" ? x.valor : 0); }, 0)};
      r.despesas = r.combustivel + r.manutencao + r.pedagio + r.outras + r.diarias;
      r.resultado = r.fretes - r.despesas;
      // km rodado: do último km ANTES do período (ou do primeiro no período) até o maior km do período
      var kms = meus.filter(function (l) { return l.km; }).map(function (l) { return l.km; });
      var antes = kms.length ? b.ultimoKmAntes(v.id, de) : null;
      var distintos = kms.filter(function (k, i) { return kms.indexOf(k) === i; }).length;
      if (kms.length && (antes || distintos > 1)) {          // com uma leitura só ainda não dá para saber
        var inicio = antes || Math.min.apply(null, kms), maior = Math.max.apply(null, kms);
        r.km_rodado = maior > inicio ? maior - inicio : 0;
      } else {
        r.km_rodado = null;
      }
      // média km/l: abastecimentos do período que têm consumo (km rodado ÷ litros, somados)
      var c = R.consumos(b.abastecimentosDoVeiculo(v.id));
      var noPeriodo = meus.filter(function (l) { return l.tipo === "abastecimento" && c[l.id]; });
      var litrosC = noPeriodo.reduce(function (s, l) { return s + l.litros; }, 0);
      var rodado = noPeriodo.reduce(function (s, l) { return s + c[l.id].km_rodado; }, 0);
      r.km_l = litrosC ? Math.round(rodado / litrosC * 100) / 100 : null;
      r.custo_km = r.km_rodado ? Math.round(r.despesas / r.km_rodado) : null;   // centavos por km
      saida.push(r);
    });
    return saida;
  };

  // Entradas × saídas do período, por categoria, com o que já foi recebido/pago
  Rel.geral = function (b, de, ate) {
    var entradas = {}, saidas = {};
    b.recebimentos({de: de, ate: ate}).forEach(function (r) {
      var nome = r.tipo === "frete" ? "Fretes" : "Outras entradas";
      var e = entradas[nome] || (entradas[nome] = {categoria: nome, total: 0, feito: 0, qtd: 0});
      e.total += r.valor; e.qtd += 1;
      if (r.situacao === "Recebido") e.feito += r.valor;
    });
    var nomes = {diaria: "Diárias", bonificacao: "Bonificações", abastecimento: "Combustível", manutencao: "Manutenção",
                 pedagio: "Pedágio"};
    b.lancamentos({de: de, ate: ate}).forEach(function (l) {
      var nome = nomes[l.tipo] || l.categoria || "Outros";
      var s = saidas[nome] || (saidas[nome] = {categoria: nome, total: 0, feito: 0, qtd: 0});
      s.total += l.valor; s.qtd += 1;
      if (l.situacao === "Pago") s.feito += l.valor;
    });
    var ordem = Object.keys(nomes).map(function (k) { return nomes[k]; });
    var pos = function (c) { var i = ordem.indexOf(c); return i < 0 ? 99 : i; };
    var listaS = Object.keys(saidas).map(function (k) { return saidas[k]; })
      .sort(function (a, c) { return pos(a.categoria) - pos(c.categoria) || c.total - a.total; });
    var listaE = Object.keys(entradas).map(function (k) { return entradas[k]; })
      .sort(function (a, c) { return a.categoria < c.categoria ? -1 : 1; });
    var soma = function (l, k) { return l.reduce(function (s, x) { return s + x[k]; }, 0); };
    var te = soma(listaE, "total"), ts = soma(listaS, "total"), fe = soma(listaE, "feito"), fs = soma(listaS, "feito");
    listaS.forEach(function (s) { s.pct = ts ? Math.round(100 * s.total / ts) : 0; });
    return {entradas: listaE, saidas: listaS, total_entradas: te, total_saidas: ts, resultado: te - ts,
            recebido: fe, pago: fs, caixa: fe - fs};
  };
})(PT.relatorios = PT.relatorios || {}, PT.regras);
