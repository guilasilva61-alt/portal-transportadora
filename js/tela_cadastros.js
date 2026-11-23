/* Cadastros de Veículos, Funcionários e Clientes: formulário em cima, lista embaixo, editar na mesma tela.
   Inativos continuam no cadastro e nos lançamentos antigos, mas não aparecem nas listas de lançamento. */
var PT = window.PT || (window.PT = {});
PT.telas = PT.telas || {};

(function (T, U, Pc) {
  "use strict";
  var h = U.h;
  function b() { return PT.app.banco; }

  function campo(nome, rotulo, valor, extra, classe) {
    return '<label class="' + (classe || "") + '">' + h(rotulo) + ' <input class="campo" name="' + nome + '" value="' + h(valor == null ? "" : valor) +
      '" ' + (extra || "") + "></label>";
  }
  function selo(ativo) {
    return ativo ? '<span class="selo-situacao pago">Ativo</span>' : '<span class="selo-situacao">Inativo</span>';
  }
  function acoes(tela, id, ativo, excluir) {
    return '<td class="acoes-linha"><a class="botao-pequeno" href="' + Pc.link(tela, {editar: id}) + '">Editar</a> ' +
      '<button type="button" class="botao-pequeno" data-acao="ativo" data-id="' + id + '">' + (ativo ? "Desativar" : "Reativar") + "</button>" +
      (excluir ? ' <button type="button" class="botao-pequeno perigo" data-acao="excluir" data-id="' + id + '">Excluir</button>' : "") + "</td>";
  }
  function rodape(editar, rotuloNovo, tela) {
    return '<div class="acoes-form"><button class="botao-salvar" type="submit">' + (editar ? "Salvar alterações" : rotuloNovo) + "</button>" +
      (editar ? '<a class="botao-pequeno" href="#/' + tela + '">Cancelar</a>' : "") + "</div>";
  }

  // Liga os botões Desativar/Reativar e Excluir da lista
  function ligarLista(raiz, tabela, nomeDe, msgExcluir) {
    raiz.querySelectorAll("[data-acao=ativo]").forEach(function (bt) {
      bt.addEventListener("click", function () {
        var r = b().obter(tabela, bt.dataset.id);
        if (!r) return;
        b().alterar(tabela, r.id, {ativo: r.ativo ? 0 : 1}, r.ativo ? "desativar" : "ativar");
        PT.app.aviso(nomeDe(r) + " " + (r.ativo ? "desativado(a)" : "reativado(a)") + ".", "ok");
        PT.app.render(null, true);
      });
    });
    raiz.querySelectorAll("[data-acao=excluir]").forEach(function (bt) {
      bt.addEventListener("click", function () {
        var r = b().obter(tabela, bt.dataset.id);
        if (!r || !window.confirm(msgExcluir(r))) return;
        b().excluir(tabela, r.id);
        PT.app.aviso(nomeDe(r) + " excluído(a) (os lançamentos continuam).", "ok");
        PT.app.ir("#/" + PT.app.telaAtual());
      });
    });
  }

  // ------------------------------------------------------------------ veículos
  T.veiculos = function (p, estado) {
    estado = estado || {};
    var editar = b().obter("veiculos", Pc.intParam(p, "editar") || 0);
    var v = estado.valores || editar || {};
    var itens = b().veiculos();
    var html = "<h1>Veículos</h1>" +
      '<form class="painel-form" id="form-cad" novalidate><h2 class="painel-titulo">' + (editar ? "Editar veículo " + h(U.placa(editar.placa)) : "Novo veículo") + "</h2>" +
      Pc.erros(estado.erros) + '<div class="campos">' +
      campo("placa", "Placa", v.placa, 'maxlength="8" placeholder="ABC1D23" autocapitalize="characters" style="text-transform:uppercase"') +
      campo("modelo", "Modelo", v.modelo, 'maxlength="80" placeholder="ex.: VW 24.280"') +
      '<label>Tipo <select class="campo" name="tipo">' + Pc.opcoes(b().config().tipos_veiculo, v.tipo) + "</select></label>" +
      campo("ano", "Ano", v.ano, 'inputmode="numeric" maxlength="4"') +
      campo("km_atual", "Km atual", v.km_atual, 'inputmode="numeric"') + "</div>" +
      rodape(editar, "Cadastrar veículo", "veiculos") + "</form>" +
      '<div class="rolagem"><table class="tabela lista"><thead><tr><th>Placa</th><th>Modelo</th><th>Tipo</th><th>Ano</th><th class="num">Km atual</th>' +
      "<th>Situação</th><th></th></tr></thead><tbody>" +
      (itens.map(function (x) {
        return '<tr class="' + (x.ativo ? "" : "inativo") + '"><td><b>' + h(U.placa(x.placa)) + "</b></td><td>" + h(x.modelo) + "</td><td>" + h(x.tipo) +
          "</td><td>" + h(x.ano || "") + '</td><td class="num">' + (x.km_atual ? U.brNum(x.km_atual, 0) : "") + "</td><td>" + selo(x.ativo) + "</td>" +
          acoes("veiculos", x.id, x.ativo, true) + "</tr>";
      }).join("") || '<tr><td colspan="7" class="vazio">Nenhum veículo cadastrado ainda.</td></tr>') + "</tbody></table></div>";
    return {
      html: html, menu: "veiculos",
      depois: function (raiz) {
        var form = raiz.querySelector("#form-cad");
        PT.comportamento.formulario(form);
        form.addEventListener("submit", function (e) {
          e.preventDefault();
          var f = Pc.lerForm(form);
          var d = {placa: String(f.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, ""), modelo: U.txt(f.modelo, 80), tipo: U.txt(f.tipo, 30),
                   ano: U.inteiro(f.ano), km_atual: U.inteiro(f.km_atual)};
          var erro = d.placa.length !== 7 ? "Placa inválida: use 7 letras/números (ex.: ABC1D23)." :
            b().placaEmUso(d.placa, editar ? editar.id : null) ? "Já existe um veículo com a placa " + d.placa + "." : "";
          if (erro) { PT.app.render({valores: f, erros: [erro]}); return; }
          if (editar) b().alterar("veiculos", editar.id, d);
          else b().criar("veiculos", Object.assign(d, {ativo: 1}));
          PT.app.aviso("Veículo " + U.placa(d.placa) + (editar ? " atualizado." : " cadastrado."), "ok");
          PT.app.ir("#/veiculos", true);
        });
        ligarLista(raiz, "veiculos", function (r) { return "Veículo " + U.placa(r.placa); },
          function (r) { return "Excluir o veículo " + U.placa(r.placa) + "? Os lançamentos dele continuam."; });
      }
    };
  };

  // ------------------------------------------------------------------ funcionários
  T.funcionarios = function (p, estado) {
    estado = estado || {};
    var editar = b().obter("funcionarios", Pc.intParam(p, "editar") || 0);
    var v = estado.valores || (editar ? Object.assign({}, editar, {valor_diaria: editar.valor_diaria ? U.reais(editar.valor_diaria) : ""}) : {});
    var itens = b().funcionarios();
    var html = "<h1>Funcionários</h1>" +
      '<form class="painel-form" id="form-cad" novalidate><h2 class="painel-titulo">' + (editar ? "Editar " + h(editar.nome) : "Novo funcionário") + "</h2>" +
      Pc.erros(estado.erros) + '<div class="campos">' +
      campo("nome", "Nome", v.nome, 'maxlength="80"', "largo") +
      '<label>Função <select class="campo" name="funcao">' + Pc.opcoes(b().config().funcoes, v.funcao) + "</select></label>" +
      campo("telefone", "Telefone", v.telefone, 'inputmode="tel" maxlength="30" placeholder="(00) 00000-0000"') +
      Pc.dinheiro("valor_diaria", "Valor padrão da diária", v.valor_diaria) + "</div>" +
      rodape(editar, "Cadastrar funcionário", "funcionarios") + "</form>" +
      '<div class="rolagem"><table class="tabela lista"><thead><tr><th>Nome</th><th>Função</th><th>Telefone</th><th class="num">Diária padrão</th>' +
      "<th>Situação</th><th></th></tr></thead><tbody>" +
      (itens.map(function (x) {
        return '<tr class="' + (x.ativo ? "" : "inativo") + '"><td><b>' + h(x.nome) + "</b></td><td>" + h(x.funcao) + "</td><td>" + h(x.telefone) +
          '</td><td class="num">' + (x.valor_diaria ? U.rs(x.valor_diaria) : "—") + "</td><td>" + selo(x.ativo) + "</td>" +
          acoes("funcionarios", x.id, x.ativo, true) + "</tr>";
      }).join("") || '<tr><td colspan="6" class="vazio">Nenhum funcionário cadastrado ainda.</td></tr>') + "</tbody></table></div>";
    return {
      html: html, menu: "funcionarios",
      depois: function (raiz) {
        var form = raiz.querySelector("#form-cad");
        PT.comportamento.formulario(form);
        form.addEventListener("submit", function (e) {
          e.preventDefault();
          var f = Pc.lerForm(form);
          var d = {nome: U.txt(f.nome, 80), funcao: U.txt(f.funcao, 30), telefone: U.txt(f.telefone, 30), valor_diaria: U.centavos(f.valor_diaria)};
          if (!d.nome) { PT.app.render({valores: f, erros: ["Informe o nome."]}); return; }
          if (editar) b().alterar("funcionarios", editar.id, d);
          else b().criar("funcionarios", Object.assign(d, {ativo: 1}));
          PT.app.aviso(d.nome + (editar ? " atualizado(a)." : " cadastrado(a)."), "ok");
          PT.app.ir("#/funcionarios", true);
        });
        ligarLista(raiz, "funcionarios", function (r) { return r.nome; },
          function (r) { return "Excluir " + r.nome + "? Os lançamentos continuam."; });
      }
    };
  };

  // ------------------------------------------------------------------ clientes (Recebimentos › Clientes)
  T.clientes = function (p, estado) {
    estado = estado || {};
    var editar = b().obter("clientes", Pc.intParam(p, "editar") || 0);
    var v = estado.valores || editar || {};
    var itens = b().clientes();
    var html = '<div class="titulo-com-acao"><h1>Clientes</h1><a class="botao-pequeno" href="#/recebimentos">← Recebimentos</a></div>' +
      '<form class="painel-form" id="form-cad" novalidate><h2 class="painel-titulo">' + (editar ? "Editar " + h(editar.nome) : "Novo cliente") + "</h2>" +
      Pc.erros(estado.erros) + '<div class="campos">' +
      campo("nome", "Nome", v.nome, 'maxlength="80"', "largo") +
      campo("telefone", "Telefone", v.telefone, 'inputmode="tel" maxlength="30"') + "</div>" +
      rodape(editar, "Cadastrar cliente", "clientes") + "</form>" +
      '<div class="rolagem"><table class="tabela lista"><thead><tr><th>Nome</th><th>Telefone</th><th>Situação</th><th></th></tr></thead><tbody>' +
      (itens.map(function (x) {
        return '<tr class="' + (x.ativo ? "" : "inativo") + '"><td><b>' + h(x.nome) + "</b></td><td>" + h(x.telefone) + "</td><td>" + selo(x.ativo) +
          "</td>" + acoes("clientes", x.id, x.ativo, false) + "</tr>";
      }).join("") || '<tr><td colspan="4" class="vazio">Nenhum cliente ainda. Dá para cadastrar aqui ou na hora, na tela do frete.</td></tr>') +
      "</tbody></table></div>";
    return {
      html: html, menu: "recebimentos",
      depois: function (raiz) {
        var form = raiz.querySelector("#form-cad");
        PT.comportamento.formulario(form);
        form.addEventListener("submit", function (e) {
          e.preventDefault();
          var f = Pc.lerForm(form);
          var d = {nome: U.txt(f.nome, 80), telefone: U.txt(f.telefone, 30)};
          if (!d.nome) { PT.app.render({valores: f, erros: ["Informe o nome do cliente."]}); return; }
          if (editar) b().alterar("clientes", editar.id, d);
          else b().criar("clientes", Object.assign(d, {ativo: 1}));
          PT.app.aviso("Cliente " + d.nome + (editar ? " atualizado." : " cadastrado."), "ok");
          PT.app.ir("#/clientes", true);
        });
        ligarLista(raiz, "clientes", function (r) { return "Cliente " + r.nome; }, function () { return ""; });
      }
    };
  };
})(PT.telas, PT.util, PT.pecas);
