/* Dados de demonstração (só com ?demo no endereço: ficam na memória, nada é gravado no iPad).
   Servem para as fotos das telas e para mostrar o portal sem mexer nos dados de verdade. */
var PT = window.PT || (window.PT = {});

PT.demo = {
  // Demonstração com números pequenos (1, 2, 3…) em cada tabela: as fotos das telas e o recibo usam ?func=1, ?editar=3…
  preencher: function (b) {
    "use strict";
    var original = PT.banco.novoId, cont = {};
    PT.banco.novoId = function (tabela) { cont[tabela] = (cont[tabela] || 0) + 1; return cont[tabela]; };
    try { PT.demo._preencher(b); } finally { PT.banco.novoId = original; }
  },
  _preencher: function (b) {
    "use strict";
    var U = PT.util, R = PT.regras, hoje = U.hoje();
    var dia = function (n) { return U.somaDias(hoje, -n); };
    var truck = b.criar("veiculos", {placa: "ABC1D23", modelo: "VW 24.280", tipo: "Truck", ano: 2019, km_atual: 100000, ativo: 1});
    var carreta = b.criar("veiculos", {placa: "QWE4R56", modelo: "Scania R450", tipo: "Carreta", ano: 2021, km_atual: 230500, ativo: 1});
    var joao = b.criar("funcionarios", {nome: "João Motorista", funcao: "Motorista", telefone: "(62) 99999-0000", valor_diaria: 15000, ativo: 1});
    var pedro = b.criar("funcionarios", {nome: "Pedro Ajudante", funcao: "Ajudante", telefone: "", valor_diaria: 8000, ativo: 1});
    var cli = b.criar("clientes", {nome: "Atacadão Central", telefone: "", ativo: 1});
    var func = {}, veic = {};
    func[joao] = {}; func[pedro] = {}; veic[truck] = {}; veic[carreta] = {};
    function lanc(f) {
      var r = R.montarLancamento(f, func, veic, null, null);
      if (r[1].length) throw new Error(r[1].join(" "));
      b.criar("lancamentos", r[0]);
    }
    var frete = b.criar("recebimentos", {tipo: "frete", data: dia(1), cliente_id: cli, documento: "CT-e 1234", origem: "Goiânia",
      destino: "Brasília", veiculo_id: truck, funcionario_id: joao, valor: 350000, forma: "Boleto", situacao: "A receber",
      data_recebimento: null, descricao: ""});
    b.criar("recebimentos", {tipo: "frete", data: dia(0), cliente_id: cli, documento: "CT-e 1240", origem: "Anápolis",
      destino: "Uberlândia", veiculo_id: carreta, funcionario_id: joao, valor: 520000, forma: "PIX", situacao: "Recebido",
      data_recebimento: hoje, descricao: ""});
    lanc({tipo: "diaria", data: dia(1), funcionario_id: joao, veiculo_id: truck, quantidade: "2", valor_unit: "150,00",
          destino: "Goiânia → Brasília", situacao: "A pagar"});
    lanc({tipo: "diaria", data: dia(1), funcionario_id: pedro, veiculo_id: truck, quantidade: "2", valor_unit: "80,00", situacao: "Pago"});
    lanc({tipo: "abastecimento", data: dia(2), veiculo_id: truck, funcionario_id: joao, combustivel: "Diesel S10", litros: "180",
          preco_litro: "5,899", km: "100000", posto: "Posto Trevo", situacao: "Pago"});
    lanc({tipo: "abastecimento", data: dia(0), veiculo_id: truck, funcionario_id: joao, combustivel: "Diesel S10", litros: "200",
          preco_litro: "5,899", km: "100800", posto: "Posto Trevo", situacao: "A pagar"});
    lanc({tipo: "pedagio", data: dia(1), veiculo_id: truck, praca: "BR-060 Alexânia", quantidade: "2", valor_unit: "18,40",
          forma_pagamento: "TAG Sem Parar", frete_id: String(frete), situacao: "Pago"});
    lanc({tipo: "manutencao", data: dia(3), veiculo_id: carreta, manut_tipo: "Preventiva", descricao: "Troca de óleo e filtros",
          oficina: "Oficina Central", km: "230500", valor: "1.280,00", proxima_km: "250000", situacao: "Pago"});
    lanc({tipo: "bonificacao", data: dia(0), funcionario_id: joao, valor: "200,00", descricao: "Meta de entregas", situacao: "A pagar"});
    b.d.ultima_copia = U.agora();
  }
};
