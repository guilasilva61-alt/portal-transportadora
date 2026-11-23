/* Contas automáticas e atalhos dos formulários (na hora de salvar, as regras conferem tudo de novo). */
var PT = window.PT || (window.PT = {});

(function (C, U, R, Pc) {
  "use strict";
  function br(n, casas) { return U.brNum(n, casas); }
  var toque = window.matchMedia && matchMedia("(pointer: coarse)").matches;

  // Valores em R$: ao sair do campo, formata "1500" → "1.500,00" (preço do litro com 3 casas)
  // Enter salva (também em listas e opções). Foco no 1º campo só com teclado físico (no iPad o teclado pularia na tela).
  C.formulario = function (form) {
    if (!form) return;
    form.querySelectorAll("input.dinheiro").forEach(function (c) {
      c.addEventListener("blur", function () {
        if (c.id === "preco_litro") { var p = U.numeroDecimal(c.value); if (p != null) c.value = br(p, 3); }
        else { var n = U.numero(c.value); if (n != null) c.value = br(n, 2); }
      });
    });
    form.addEventListener("keydown", function (e) {
      var t = e.target.tagName;
      if (e.key === "Enter" && !e.shiftKey && t !== "TEXTAREA" && t !== "BUTTON" && t !== "A") {
        e.preventDefault();
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        if (form.requestSubmit) form.requestSubmit(); else form.dispatchEvent(new Event("submit", {cancelable: true}));
      }
    });
    if (!toque) {
      var primeiro = form.querySelector("select:not([disabled]), input.campo:not([type=date]):not([type=hidden])");
      if (primeiro && !document.querySelector(".caixa-erro")) primeiro.focus({preventScroll: true});
    }
  };

  // Filtro da lista: monta o endereço com os campos preenchidos (mantendo os "extras", ex.: o tipo do formulário)
  C.filtros = function (form, tela, extras) {
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      PT.app.ir(Pc.link(tela, Object.assign({}, extras || {}, Pc.lerForm(form))), false, "lista");
    });
  };

  C.formLancamento = function (form, editar) {
    C.formulario(form);
    var tipo = form.getAttribute("data-tipo");
    var totalBox = form.querySelector("#total-calc");
    function $(id) { return form.querySelector("#" + id); }
    function mostrarTotal(v) { if (totalBox) totalBox.textContent = v == null ? "R$ 0,00" : "R$ " + br(v, 2); }

    if (tipo === "diaria") {          // quantidade × valor (valor puxado do cadastro do funcionário)
      var func = $("funcionario"), qtd = $("quantidade"), unit = $("valor_unit");
      var unitManual = !!unit.value;
      var calcDiaria = function () { mostrarTotal(Math.round((U.numero(qtd.value) || 0) * (U.numero(unit.value) || 0) * 100) / 100); };
      unit.addEventListener("input", function () { unitManual = !!unit.value; calcDiaria(); });
      func.addEventListener("change", function () {
        var op = func.options[func.selectedIndex];
        var padrao = op ? op.getAttribute("data-diaria") : "";
        if (padrao && !unitManual) unit.value = padrao;
        calcDiaria();
      });
      qtd.addEventListener("input", calcDiaria);
      if (!unit.value) func.dispatchEvent(new Event("change"));
      calcDiaria();
    }

    if (tipo === "pedagio") {         // passagens × valor de cada uma
      var qtdP = $("quantidade"), unitP = $("valor_unit");
      var calcPedagio = function () { mostrarTotal(Math.round((U.numero(qtdP.value) || 0) * (U.numero(unitP.value) || 0) * 100) / 100); };
      qtdP.addEventListener("input", calcPedagio);
      unitP.addEventListener("input", calcPedagio);
      calcPedagio();
    }

    if (tipo === "abastecimento") {   // com dois de (litros, valor do litro, total) calcula o terceiro
      var litros = $("litros"), preco = $("preco_litro"), total = $("valor"), km = $("km"), veic = $("veiculo");
      var info = $("info-consumo");
      var ordem = [];                 // os dois últimos campos que a pessoa digitou mandam; o outro é calculado
      var calcAbast = function () {
        var L = U.numero(litros.value), P = U.numeroDecimal(preco.value), T = U.numero(total.value);
        var ult = ordem.slice(-2);
        if (ult.indexOf("litros") >= 0 && ult.indexOf("preco_litro") >= 0 && L && P) {
          T = Math.round(L * P * 100) / 100; total.value = br(T, 2);
        } else if (ult.indexOf("litros") >= 0 && ult.indexOf("valor") >= 0 && L && T) {
          P = Math.round(T / L * 1000) / 1000; preco.value = br(P, 3);
        } else if (ult.indexOf("preco_litro") >= 0 && ult.indexOf("valor") >= 0 && P && T) {
          L = Math.round(T / P * 100) / 100; litros.value = br(L, 2);
        }
        mostrarTotal(T);
        consumo();
      };
      var consumo = function () {
        var vid = U.inteiro(veic.value);
        if (!vid) { info.textContent = ""; return; }
        var v = PT.app.banco.obter("veiculos", vid);
        var kmAgora = U.inteiro(km.value), L = U.numero(litros.value);
        var d = R.consumoPrevisto(PT.app.banco.abastecimentosDoVeiculo(vid), kmAgora, L, editar ? editar.id : null);
        if (d.km_anterior == null) {
          info.innerHTML = "Primeiro abastecimento com km deste veículo: o consumo aparece a partir do próximo." +
            (v && v.km_atual ? " Km no cadastro: <b>" + br(v.km_atual, 0) + "</b>." : "");
        } else if (d.km_l != null) {
          info.innerHTML = "Km anterior: <b>" + br(d.km_anterior, 0) + "</b> · rodou <b>" + br(kmAgora - d.km_anterior, 0) +
            " km</b> · consumo: <b class='consumo'>" + br(d.km_l, 2) + " km/l</b>";
        } else {
          info.innerHTML = "Km anterior: <b>" + br(d.km_anterior, 0) + "</b> — informe o km de agora e os litros para ver o consumo.";
        }
      };
      [litros, preco, total].forEach(function (c) {
        if (c.value) ordem.push(c.id);
        c.addEventListener("input", function () {
          ordem = ordem.filter(function (x) { return x !== c.id; });
          if (c.value) ordem.push(c.id);
          calcAbast();
        });
      });
      km.addEventListener("input", consumo);
      veic.addEventListener("change", consumo);
      calcAbast();
    }
  };

  // Recebimentos: cliente novo na hora e data do recebimento só quando "Recebido"
  C.formRecebimento = function (form) {
    C.formulario(form);
    var cli = form.querySelector("#cliente"), boxNovo = form.querySelector("#cliente-novo"), dataReceb = form.querySelector("#data-receb");
    if (cli) cli.addEventListener("change", function () {
      boxNovo.hidden = cli.value !== "novo";
      if (cli.value === "novo") form.querySelector("#cliente_novo").focus();
    });
    form.querySelectorAll("input[name=situacao]").forEach(function (r) {
      r.addEventListener("change", function () {
        dataReceb.hidden = form.getAttribute("data-tipo") !== "frete" || r.value !== "Recebido" || !r.checked;
      });
    });
  };
})(PT.comportamento = PT.comportamento || {}, PT.util, PT.regras, PT.pecas);
