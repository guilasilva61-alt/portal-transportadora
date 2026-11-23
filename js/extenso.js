/* Valor em reais por extenso, em português do Brasil (para recibos). Igual ao portal/extenso.py.
   1,00 → "um real"; 0,50 → "cinquenta centavos"; 1.234,56 → "mil duzentos e trinta e quatro reais e cinquenta e seis
   centavos"; 1.000.000,00 → "um milhão de reais". */
var PT = window.PT || (window.PT = {});

(function (E) {
  "use strict";
  var UNIDADES = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze",
                  "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  var DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  var CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos",
                  "oitocentos", "novecentos"];
  var ESCALAS = [["", ""], ["mil", "mil"], ["milhão", "milhões"], ["bilhão", "bilhões"]];

  function ate999(n) {
    if (n === 100) return "cem";
    var partes = [], c = Math.floor(n / 100), resto = n % 100;
    if (c) partes.push(CENTENAS[c]);
    if (resto) {
      if (resto < 20) partes.push(UNIDADES[resto]);
      else {
        var d = Math.floor(resto / 10), u = resto % 10;
        partes.push(DEZENAS[d] + (u ? " e " + UNIDADES[u] : ""));
      }
    }
    return partes.join(" e ");
  }

  E.numeroPorExtenso = function (n) {
    if (n === 0) return "zero";
    var grupos = [], i = 0;
    while (n) {
      var g = n % 1000;
      n = Math.floor(n / 1000);
      if (g) grupos.push([g, i]);
      i++;
    }
    grupos.reverse();
    var textos = grupos.map(function (x) {
      var g = x[0], esc = x[1];
      if (esc === 1 && g === 1) return "mil";
      if (esc === 0) return ate999(g);
      return ate999(g) + " " + (g === 1 ? ESCALAS[esc][0] : ESCALAS[esc][1]);
    });
    if (textos.length === 1) return textos[0];
    var ultimo = grupos[grupos.length - 1][0], saida = textos[0];
    for (var k = 1; k < textos.length; k++) {
      if (k === textos.length - 1 && (ultimo < 100 || ultimo % 100 === 0)) saida += " e " + textos[k];
      else if (grupos[k - 1][1] >= 2) saida += ", " + textos[k];
      else saida += " " + textos[k];
    }
    return saida;
  };

  E.reaisPorExtenso = function (centavos) {
    if (centavos < 0) throw new Error("valor negativo");
    centavos = Math.round(centavos);
    var reais = Math.floor(centavos / 100), cents = centavos % 100, partes = [];
    if (reais) {
      var de = reais >= 1000000 && reais % 1000000 === 0 ? " de" : "";
      partes.push(E.numeroPorExtenso(reais) + de + " " + (reais === 1 ? "real" : "reais"));
    }
    if (cents) partes.push(E.numeroPorExtenso(cents) + " " + (cents === 1 ? "centavo" : "centavos"));
    return partes.length ? partes.join(" e ") : "zero real";
  };
})(PT.extenso = PT.extenso || {});
