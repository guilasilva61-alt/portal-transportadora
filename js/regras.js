/* Regras dos lançamentos e recebimentos: validação de cada tipo, totais calculados sozinhos e consumo km/l.
   Igual ao portal/regras.py: recebe o formulário (textos) e devolve [dados prontos para o banco, erros]. */
var PT = window.PT || (window.PT = {});

(function (R, U) {
  "use strict";
  R.TIPOS_LANCAMENTO = {diaria: "Diária", bonificacao: "Bonificação", abastecimento: "Abastecimento",
                        manutencao: "Manutenção", pedagio: "Pedágio", despesa: "Outra despesa"};
  R.TIPOS_RECEBIMENTO = {frete: "Frete", outra: "Outra entrada"};
  R.SITUACOES_PAGAR = ["A pagar", "Pago"];
  R.SITUACOES_RECEBER = ["A receber", "Recebido"];
  R.MANUT_TIPOS = ["Preventiva", "Corretiva"];
  R.FORMAS_PEDAGIO = ["TAG Sem Parar", "TAG Veloe", "TAG ConectCar", "Cartão", "Dinheiro"];

  function id(f, k) {
    var v = U.inteiro(f[k]);
    return v && v > 0 ? v : null;
  }
  function tem(obj, k) { return k != null && Object.prototype.hasOwnProperty.call(obj, k); }

  // quantidade (Number) × valor unitário (centavos), arredondando metade para cima
  function centavosDe(qtd, unitCent) {
    var q = Math.round(qtd * 10000);
    return U.divArred(q * unitCent, 10000);
  }

  // Litros × preço do litro = total. Com dois deles calcula o terceiro. Preço em milésimos (5,899 → 5899).
  // Devolve [litros, preco_mil, total_cent] ou null se faltar.
  R.calcularAbastecimento = function (litros, precoMil, totalCent) {
    var L3 = litros ? Math.round(litros * 1000) : 0;     // litros em milésimos
    if (litros && precoMil && !totalCent) {
      totalCent = U.divArred(L3 * precoMil, 10000);
    } else if (litros && totalCent && !precoMil) {
      precoMil = U.divArred(totalCent * 10 * 1000, L3);
    } else if (precoMil && totalCent && !litros) {
      litros = U.divArred(totalCent * 10 * 1000, precoMil) / 1000;
    }
    if (!(litros && precoMil && totalCent)) return null;
    return [Number(litros), Math.trunc(precoMil), Math.trunc(totalCent)];
  };

  // Formulário → [dados, erros]. funcionarios/veiculos: {id: cadastro} dos ATIVOS (no editar, o do próprio
  // lançamento também). fretes: ids de frete que podem ser vinculados ao pedágio (null = não confere).
  R.montarLancamento = function (f, funcionarios, veiculos, formasPedagio, fretes) {
    var erros = [], tipo = f.tipo || "";
    if (!tem(R.TIPOS_LANCAMENTO, tipo)) return [{}, ["Escolha o tipo de lançamento."]];
    var data = U.dataIso(f.data) || "";
    if (!data) erros.push("Informe a data.");
    var situacao = R.SITUACOES_PAGAR.indexOf(f.situacao) >= 0 ? f.situacao : "A pagar";
    var fid = id(f, "funcionario_id"), vid = id(f, "veiculo_id");
    if (fid && !tem(funcionarios, fid)) { erros.push("Funcionário inválido ou inativo."); fid = null; }
    if (vid && !tem(veiculos, vid)) { erros.push("Veículo inválido ou inativo."); vid = null; }
    var d = {tipo: tipo, data: data, situacao: situacao, funcionario_id: fid, veiculo_id: vid,
             quantidade: null, valor_unit: null, destino: "", descricao: "", observacao: U.txt(f.observacao, 500),
             posto: "", combustivel: "", litros: null, preco_litro: null, km: null, manut_tipo: "",
             oficina: "", proxima_km: null, proxima_data: null, categoria: "", valor: null,
             praca: "", forma_pagamento: "", frete_id: null};
    var qtd, unit;

    if (tipo === "diaria") {
      if (!fid) erros.push("Escolha o motorista/ajudante.");
      qtd = U.numero(f.quantidade) || 1;
      unit = U.centavos(f.valor_unit);
      if (qtd <= 0) erros.push("Quantidade de diárias deve ser maior que zero.");
      if (!unit || unit <= 0) erros.push("Informe o valor da diária.");
      else d.valor = centavosDe(qtd, unit);
      d.quantidade = qtd; d.valor_unit = unit; d.destino = U.txt(f.destino, 200);
    } else if (tipo === "bonificacao") {
      if (!fid) erros.push("Escolha o funcionário.");
      d.valor = U.centavos(f.valor);
      d.descricao = U.txt(f.descricao, 200);
      if (!d.descricao) erros.push("Informe o motivo da bonificação.");
    } else if (tipo === "abastecimento") {
      if (!vid) erros.push("Escolha o veículo.");
      var litros = U.numero(f.litros), precoMil = U.milesimos(f.preco_litro);
      var calc = R.calcularAbastecimento(litros || null, precoMil || null, U.centavos(f.valor));
      if (calc === null) erros.push("Informe dois destes: litros, valor do litro ou total (o terceiro é calculado).");
      else { d.litros = calc[0]; d.preco_litro = calc[1]; d.valor = calc[2]; }
      d.posto = U.txt(f.posto, 80); d.combustivel = U.txt(f.combustivel, 40); d.km = U.inteiro(f.km);
    } else if (tipo === "manutencao") {
      if (!vid) erros.push("Escolha o veículo.");
      d.manut_tipo = R.MANUT_TIPOS.indexOf(f.manut_tipo) >= 0 ? f.manut_tipo : "Corretiva";
      d.descricao = U.txt(f.descricao, 200);
      if (!d.descricao) erros.push("Informe o serviço/peça.");
      d.oficina = U.txt(f.oficina, 80); d.km = U.inteiro(f.km); d.valor = U.centavos(f.valor);
      d.proxima_km = U.inteiro(f.proxima_km); d.proxima_data = U.dataIso(f.proxima_data);
    } else if (tipo === "pedagio") {
      if (!vid) erros.push("Escolha o veículo.");
      d.praca = U.txt(f.praca, 80);
      if (!d.praca) erros.push("Informe a praça / rodovia do pedágio.");
      qtd = U.numero(f.quantidade) || 1;
      unit = U.centavos(f.valor_unit);
      if (qtd <= 0 || qtd !== Math.trunc(qtd)) erros.push("Quantidade de passagens deve ser um número inteiro maior que zero.");
      else if (!unit || unit <= 0) erros.push("Informe o valor de cada passagem.");
      else d.valor = centavosDe(qtd, unit);
      var formas = formasPedagio && formasPedagio.length ? formasPedagio : R.FORMAS_PEDAGIO;
      d.quantidade = qtd; d.valor_unit = unit;
      d.forma_pagamento = formas.indexOf(f.forma_pagamento) >= 0 ? f.forma_pagamento : "";
      var frete = id(f, "frete_id");
      if (frete && fretes && fretes.indexOf(frete) < 0) { erros.push("Frete/viagem vinculada não encontrada."); frete = null; }
      d.frete_id = frete;
    } else if (tipo === "despesa") {
      d.categoria = U.txt(f.categoria, 40) || "Outros";
      if (U.normaliza(d.categoria) === "PEDAGIO") erros.push("Pedágio agora tem botão próprio: use “Pedágio” no topo da tela.");
      d.descricao = U.txt(f.descricao, 200);
      d.valor = U.centavos(f.valor);
    }

    if (tipo !== "abastecimento" && (d.valor == null || d.valor <= 0) &&
        !erros.some(function (e) { return e.indexOf("diária") >= 0 || e.indexOf("passage") >= 0; })) {
      erros.push("Informe o valor.");
    }
    if (d.km != null && d.km < 0) erros.push("Km inválido.");
    return [d, erros];
  };

  // Formulário de recebimento → [dados, erros]. cliente_id = "novo" → o cliente vem em cliente_novo (a tela cria).
  // Recebido sem data de recebimento → hoje; A receber → sem data de recebimento.
  R.montarRecebimento = function (f, clientes, funcionarios, veiculos, formas, hoje) {
    var erros = [], tipo = f.tipo || "";
    if (!tem(R.TIPOS_RECEBIMENTO, tipo)) return [{}, ["Escolha o tipo de recebimento."]];
    var data = U.dataIso(f.data) || "";
    if (!data) erros.push("Informe a data.");
    var situacao = R.SITUACOES_RECEBER.indexOf(f.situacao) >= 0 ? f.situacao : "A receber";
    var d = {tipo: tipo, data: data, situacao: situacao, valor: U.centavos(f.valor), cliente_id: null,
             documento: "", origem: "", destino: "", veiculo_id: null, funcionario_id: null, forma: "",
             data_recebimento: null, descricao: U.txt(f.descricao, 200)};
    if (tipo === "frete") {
      if (f.cliente_id === "novo") {
        if (!U.txt(f.cliente_novo, 80)) erros.push("Digite o nome do cliente novo.");
      } else {
        var cid = id(f, "cliente_id");
        if (!cid) erros.push("Escolha o cliente.");
        else if (!tem(clientes, cid)) erros.push("Cliente inválido ou inativo.");
        d.cliente_id = tem(clientes, cid) ? cid : null;
      }
      var fid = id(f, "funcionario_id"), vid = id(f, "veiculo_id");
      if (fid && !tem(funcionarios, fid)) erros.push("Motorista inválido ou inativo.");
      if (vid && !tem(veiculos, vid)) erros.push("Veículo inválido ou inativo.");
      d.documento = U.txt(f.documento, 60); d.origem = U.txt(f.origem, 80); d.destino = U.txt(f.destino, 80);
      d.funcionario_id = tem(funcionarios, fid) ? fid : null;
      d.veiculo_id = tem(veiculos, vid) ? vid : null;
      d.forma = (formas || []).indexOf(f.forma) >= 0 ? f.forma : "";
    } else if (!d.descricao) {
      erros.push("Informe a descrição da entrada.");
    }
    if (!d.valor || d.valor <= 0) erros.push("Informe o valor.");
    if (situacao === "Recebido") {
      if (tipo === "outra") d.data_recebimento = data || null;      // entrada avulsa: recebida no próprio dia
      else d.data_recebimento = U.dataIso(f.data_recebimento) || hoje || U.hoje();
    }
    return [d, erros];
  };

  // Consumo de cada abastecimento de UM veículo, contra o abastecimento anterior com km (tanque cheio):
  // km/l = (km agora − km anterior) ÷ litros abastecidos agora. {id: {km_rodado, km_l, km_anterior}}
  R.consumos = function (abastecimentos) {
    var comKm = abastecimentos.filter(function (a) { return a.km; }).slice().sort(function (a, b) {
      return a.km - b.km || (a.data < b.data ? -1 : a.data > b.data ? 1 : 0) || a.id - b.id;
    });
    var saida = {};
    for (var i = 1; i < comKm.length; i++) {
      var ant = comKm[i - 1], atual = comKm[i], rodado = atual.km - ant.km;
      if (rodado > 0 && atual.litros) {
        saida[atual.id] = {km_rodado: rodado, km_l: Math.round(rodado / atual.litros * 100) / 100, km_anterior: ant.km};
      }
    }
    return saida;
  };

  // Para a tela, antes de salvar: km anterior (o maior km abaixo do informado) e o km/l que vai dar
  R.consumoPrevisto = function (abastecimentos, km, litros, ignorarId) {
    var anteriores = abastecimentos.filter(function (a) {
      return a.km && a.id !== ignorarId && (!km || a.km < km);
    }).map(function (a) { return a.km; });
    if (!anteriores.length) return {km_anterior: null, km_l: null};
    var ant = Math.max.apply(null, anteriores);
    var kmL = km && litros && km > ant ? Math.round((km - ant) / litros * 100) / 100 : null;
    return {km_anterior: ant, km_l: kmL};
  };
})(PT.regras = PT.regras || {}, PT.util);
