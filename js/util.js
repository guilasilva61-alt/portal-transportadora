/* Portal Transportadora (iPad) — valores em R$ (sempre em CENTAVOS no banco), números com vírgula e datas no
   formato brasileiro. Mesmas regras do sistema do computador (portal/util.py). */
var PT = window.PT || (window.PT = {});

(function (U) {
  "use strict";

  // Maiúsculas, sem acento e com espaços simples ("Pedágio" → "PEDAGIO")
  U.normaliza = function (txt) {
    return String(txt == null ? "" : txt).normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .toUpperCase().split(/\s+/).filter(Boolean).join(" ");
  };

  // Texto com no máximo N letras e espaços simples
  U.txt = function (v, maximo) {
    return String(v == null ? "" : v).split(/\s+/).filter(Boolean).join(" ").slice(0, maximo || 200);
  };

  // Texto de número já "limpo" ("1234.56", "-3") → inteiro multiplicado por 10^casas, arredondando metade para cima
  function escalar(norm, casas) {
    var neg = norm.charAt(0) === "-";
    if (neg) norm = norm.slice(1);
    var p = norm.split(".");
    var inteiro = p[0] || "0", frac = (p[1] || "");
    frac = (frac + "0".repeat(casas + 1)).slice(0, casas + 1);
    var n = parseInt(inteiro + frac.slice(0, casas), 10) || 0;
    if (parseInt(frac.charAt(casas), 10) >= 5) n += 1;
    return neg ? -n : n;
  }
  U.escalar = escalar;

  // '1.234,56' / '1234,56' / '1234.56' / 'R$ 12' → texto normalizado "1234.56"; vazio ou inválido → null
  function normalizar(txt) {
    if (txt == null) return null;
    if (typeof txt === "number") return isFinite(txt) ? String(txt) : null;
    var t = String(txt).replace(/[^\d,.\-]/g, "");
    if (!t || "-.,".indexOf(t) >= 0) return null;
    if (t.indexOf(",") >= 0) t = t.replace(/\./g, "").replace(",", ".");
    else if ((t.match(/\./g) || []).length > 1 || /^-?\d{1,3}\.\d{3}$/.test(t)) t = t.replace(/\./g, "");
    if (!/^-?\d*(\.\d*)?$/.test(t) || !/\d/.test(t)) return null;
    return t;
  }

  // Número (para quantidade, litros): texto → Number; inválido → null
  U.numero = function (txt) {
    var t = normalizar(txt);
    return t == null ? null : parseFloat(t);
  };

  // Para o preço do litro: SEM vírgula, o ponto é decimal ('5.899' → 5,899 — ninguém paga R$ 5.899 no litro)
  function normalizarDecimal(txt) {
    var t = String(txt == null ? "" : txt);
    if (t.indexOf(",") < 0 && (t.match(/\./g) || []).length === 1) {
      t = t.replace(/[^\d.\-]/g, "");
      return /\d/.test(t) && /^-?\d*\.?\d*$/.test(t) ? t : null;
    }
    return normalizar(txt);
  }
  U.numeroDecimal = function (txt) {
    var t = normalizarDecimal(txt);
    return t == null ? null : parseFloat(t);
  };
  // Preço do litro em milésimos de real (5,899 → 5899)
  U.milesimos = function (txt) {
    var t = normalizarDecimal(txt);
    return t == null ? null : escalar(t, 3);
  };

  U.centavos = function (txt) {
    var t = normalizar(txt);
    return t == null ? null : escalar(t, 2);
  };

  function milhar(inteiro) {
    return String(inteiro).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  // centavos → '1.234,56' (null → '')
  U.reais = function (c) {
    if (c == null || c === "") return "";
    var neg = c < 0, a = Math.abs(Math.round(c));
    var s = milhar(Math.floor(a / 100)) + "," + String(a % 100).padStart(2, "0");
    return (neg ? "-" : "") + s;
  };
  U.rs = function (c) { return c == null || c === "" ? "" : "R$ " + U.reais(c); };

  // Number → '1.234,5' com N casas (null → '')
  U.brNum = function (n, casas) {
    if (n == null || n === "" || isNaN(n)) return "";
    casas = casas == null ? 2 : casas;
    var neg = n < 0;
    var fator = Math.pow(10, casas);
    var a = Math.round(Math.abs(n) * fator + 1e-9);
    var inteiro = Math.floor(a / fator), frac = String(a % fator).padStart(casas, "0");
    return (neg && a ? "-" : "") + milhar(inteiro) + (casas ? "," + frac : "");
  };

  // Quantidade sem casas desnecessárias: 2 → '2', 2.5 → '2,5'
  U.qtd = function (n) {
    if (n == null || n === "") return "";
    if (Number(n) === Math.trunc(Number(n))) return U.brNum(n, 0);
    return U.brNum(n, 2).replace(/0+$/, "").replace(/,$/, "");
  };

  // 'ABC1D23' → 'ABC-1D23'
  U.placa = function (p) { return p && p.length === 7 ? p.slice(0, 3) + "-" + p.slice(3) : (p || ""); };

  U.dataBr = function (iso) {
    if (!iso) return "";
    var s = String(iso);
    return s.length >= 10 ? s.slice(8, 10) + "/" + s.slice(5, 7) + "/" + s.slice(0, 4) : s;
  };

  function valida(a, m, d) {
    var dt = new Date(Date.UTC(a, m - 1, d));
    return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }
  function iso(a, m, d) { return String(a).padStart(4, "0") + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0"); }

  // '2026-10-15' ou '15/10/2026' → '2026-10-15'; inválida → null
  U.dataIso = function (txt) {
    var t = String(txt == null ? "" : txt).trim(), m;
    if ((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t))) {
      return valida(+m[1], +m[2], +m[3]) ? t : null;
    }
    if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t))) {
      return valida(+m[3], +m[2], +m[1]) ? iso(+m[3], +m[2], +m[1]) : null;
    }
    return null;
  };

  // Km, ano, ids: o ponto é separador de MILHAR ('100.000' → 100000); depois da vírgula é ignorado
  U.inteiro = function (txt) {
    if (txt == null) return null;
    if (typeof txt === "number") return Math.trunc(txt);
    var t = String(txt).split(",")[0].replace(/[^\d\-]/g, "");
    if (!t || t === "-" || !/^-?\d+$/.test(t)) return null;
    return parseInt(t, 10);
  };

  // Data de hoje (horário do iPad), em ISO. PT.agoraFixo serve para os testes.
  U.hoje = function () {
    if (U.hojeFixo) return U.hojeFixo;
    var d = new Date();
    return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
  };
  U.agora = function () { return new Date().toISOString().slice(0, 19); };

  // Soma dias a uma data ISO
  U.somaDias = function (isoTxt, dias) {
    var p = isoTxt.split("-").map(Number);
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + dias));
    return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  };

  // (primeiro dia, último dia) do mês da data, em ISO
  U.mesAtual = function (hojeIso) {
    var p = (hojeIso || U.hoje()).split("-").map(Number);
    var ultimo = new Date(Date.UTC(p[0], p[1], 0)).getUTCDate();
    return [iso(p[0], p[1], 1), iso(p[0], p[1], ultimo)];
  };

  U.MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro",
             "novembro", "dezembro"];
  U.mesTxt = function (hojeIso) {
    var p = (hojeIso || U.hoje()).split("-").map(Number);
    return U.MESES[p[1] - 1] + " de " + p[0];
  };

  // Escapa texto para pôr dentro do HTML
  U.h = function (v) {
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  };

  // Divisão de inteiros positivos arredondando metade para cima
  U.divArred = function (a, b) {
    var neg = (a < 0) !== (b < 0);
    a = Math.abs(a); b = Math.abs(b);
    var r = Math.floor((2 * a + b) / (2 * b));
    return neg ? -r : r;
  };
})(PT.util = PT.util || {});
