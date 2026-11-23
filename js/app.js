/* Portal Transportadora (iPad) — partida do aplicativo: abre o banco do aparelho, monta o topo, troca de tela pelo
   endereço (#/lancamentos, #/relatorios/geral…), avisos, senha, cópia de segurança e funcionamento sem internet. */
var PT = window.PT || (window.PT = {});
PT.VERSAO = "1.1.0";

(function (A, U, Pc) {
  "use strict";
  var avisos = [], ancoraPendente = null, telaAtual = "";
  var MENU = [["lancamentos", "Lançamentos"], ["recebimentos", "Recebimentos"], ["veiculos", "Veículos"],
              ["funcionarios", "Funcionários"], ["relatorios", "Relatórios"], ["ajustes", "Ajustes"]];

  A.aviso = function (msg, cat) { avisos.push([msg, cat || "ok"]); };
  A.telaAtual = function () { return telaAtual; };

  A.montarTopo = function () {
    var cfg = A.banco.config();
    document.title = cfg.nome;
    document.getElementById("topo").innerHTML =
      '<div class="topo-esquerda"><a href="#/" class="marca">' + Pc.logo(cfg, "logo-topo") + "</a></div>" +
      '<nav class="menu">' + MENU.map(function (m) {
        return '<a href="#/' + m[0] + '" data-menu="' + m[0] + '">' + Pc.icone(m[0]) + "<span>" + m[1] + "</span></a>";
      }).join("") + "</nav>";
  };

  // Desenha a tela do endereço atual. estado = valores digitados + erros (quando a regra recusou o formulário).
  A.render = function (estado, manterRolagem) {
    if (A.bloqueado) return;
    var end = Pc.lerEndereco(location.hash);
    var fn = PT.telas[end.tela] || PT.telas[""];
    telaAtual = PT.telas[end.tela] ? end.tela : "";
    var r;
    try {
      r = fn(end.p, estado || null);
    } catch (e) {
      console.error(e);
      r = {html: '<div class="caixa-erro">Algo deu errado ao abrir esta tela: ' + U.h(e.message) + '</div><p><a href="#/">Voltar ao início</a></p>', menu: ""};
    }
    var main = document.getElementById("conteudo");
    var topoAvisos = avisos.map(function (a) {
      return '<div class="flash flash-' + a[1] + '" role="alert">' + U.h(a[0]) + "</div>";
    }).join("");
    avisos = [];
    document.body.classList.toggle("modo-recibo", r.modo === "recibo");
    main.innerHTML = topoAvisos + r.html;
    A.digitando = false;
    document.querySelectorAll("[data-menu]").forEach(function (a) { a.classList.toggle("ativo", a.dataset.menu === r.menu); });
    if (r.depois) {
      try { r.depois(main); } catch (e) { console.error(e); setTimeout(function () { throw e; }); }
    }
    var ancora = ancoraPendente && document.getElementById(ancoraPendente);
    ancoraPendente = null;
    if (ancora) ancora.scrollIntoView();
    else if (!manterRolagem) window.scrollTo(0, 0);
  };

  A.ir = function (hash, _depoisDeSalvar, ancora) {
    ancoraPendente = ancora || null;
    if (location.hash === hash || (hash === "#/" && !location.hash)) A.render();
    else location.hash = hash;
  };

  // ------------------------------------------------------------------ cópia de segurança
  PT.copia = {
    nomeArquivo: function () { return "portal-transportadora-copia-" + U.hoje() + ".json"; },
    // Gera o arquivo e abre o "Compartilhar" do iPad (Salvar em Arquivos, WhatsApp, e-mail…); sem isso, baixa o arquivo
    salvar: function () {
      var json = JSON.stringify(A.banco.exportar());
      var nome = PT.copia.nomeArquivo(), tipo = "application/json";
      var arquivo = null;
      try { arquivo = new File([json], nome, {type: tipo}); } catch (e) { arquivo = null; }
      if (arquivo && navigator.canShare && navigator.canShare({files: [arquivo]})) {
        return navigator.share({files: [arquivo], title: "Cópia de segurança — Portal Transportadora"}).then(function () {
          A.aviso("Cópia de segurança feita (" + nome + "). Guarde bem o arquivo.", "ok");
          return A.banco.marcarCopia();
        }, function (e) {
          A.aviso(e && e.name === "AbortError" ? "Cópia cancelada: nada foi salvo." : "Não deu para compartilhar a cópia: " + (e && e.message), "aviso");
        });
      }
      var url = URL.createObjectURL(new Blob([json], {type: tipo}));
      var a = document.createElement("a");
      a.href = url; a.download = nome;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      A.aviso("Cópia de segurança baixada (" + nome + "). Guarde o arquivo no iCloud Drive ou mande para você mesmo.", "ok");
      return A.banco.marcarCopia();
    },
    restaurar: function (arquivo) {
      var leitor = new FileReader();
      leitor.onload = function () {
        var pacote;
        try {
          pacote = PT.banco.validar(JSON.parse(String(leitor.result)));
        } catch (e) {
          A.aviso(e instanceof SyntaxError ? "Esse arquivo não é uma cópia de segurança válida." : e.message, "erro");
          A.render(null, true);
          return;
        }
        var n = function (t) { return pacote[t].filter(function (r) { return !r.excluido; }).length; };
        var quando = pacote.exportado_em ? U.dataBr(pacote.exportado_em.slice(0, 10)) + " às " + pacote.exportado_em.slice(11, 16) : "data desconhecida";
        var ok = window.confirm("Restaurar a cópia de " + quando + "?\n\nEla tem " + n("lancamentos") + " lançamento(s), " + n("recebimentos") +
          " recebimento(s), " + n("veiculos") + " veículo(s) e " + n("funcionarios") + " funcionário(s).\n\n" +
          "ATENÇÃO: tudo o que está no iPad agora será TROCADO pelo que está na cópia.");
        if (!ok) { A.aviso("Restauração cancelada: nada mudou.", "aviso"); A.render(null, true); return; }
        A.banco.restaurar(pacote).then(function () {
          if (PT.nuvem.enviarTudo) PT.nuvem.enviarTudo();
          A.montarTopo();
          A.aviso("Cópia restaurada. Confira os lançamentos.", "ok");
          A.ir("#/");
        }, function (e) {
          A.aviso("Não deu para restaurar: " + e.message, "erro");
          A.render(null, true);
        });
      };
      leitor.onerror = function () { A.aviso("Não deu para ler o arquivo.", "erro"); A.render(null, true); };
      leitor.readAsText(arquivo);
    }
  };

  // ------------------------------------------------------------------ senha para abrir (opcional)
  var MINUTOS_BLOQUEIO = 5;
  PT.senha = {
    resumo: function (txt) {
      if (!(window.crypto && crypto.subtle)) return Promise.reject(new Error("Este navegador não permite senha (abra pelo endereço com cadeado)."));
      return crypto.subtle.digest("SHA-256", new TextEncoder().encode("portal-transportadora:" + txt)).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (x) { return x.toString(16).padStart(2, "0"); }).join("");
      });
    },
    trocar: function (atual, nova, repete) {
      var cfg = A.banco.config();
      var confere = cfg.senha ? PT.senha.resumo(atual).then(function (r) {
        if (r !== cfg.senha) throw new Error("A senha atual não confere.");
      }) : Promise.resolve();
      return confere.then(function () {
        if (nova !== repete) throw new Error("As duas senhas novas não são iguais.");
        if (!nova) {
          if (!cfg.senha) throw new Error("Digite a senha nova.");
          cfg.senha = "";
          A.banco._auditar("config", 0, "senha", null, {senha: "tirada"});
          A.banco.salvar();
          return "Senha tirada: o portal abre direto.";
        }
        if (!/^\d{4,8}$/.test(nova)) throw new Error("A senha deve ter de 4 a 8 números.");
        return PT.senha.resumo(nova).then(function (r) {
          cfg.senha = r;
          A.banco._auditar("config", 0, "senha", null, {senha: "definida"});
          A.banco.salvar();
          return "Senha salva. Ela será pedida ao abrir o portal.";
        });
      });
    },
    bloquear: function () {
      if (!A.banco.config().senha) return;
      A.bloqueado = true;
      document.body.classList.add("tela-login");
      var cfg = A.banco.config();
      document.getElementById("conteudo").innerHTML =
        '<div class="cena"><div class="cena-borda"></div><div class="cena-vidro"><div class="cena-conteudo">' +
        "<h1>" + Pc.tituloOuro(cfg.nome) + '</h1><p class="cena-sub">Digite a senha para entrar.</p>' +
        '<div class="flash flash-erro" id="erro-senha" hidden></div>' +
        '<form class="caixa-login" id="form-entrar"><label>Senha <span class="campo-icone">' + Pc.icone("cadeado") +
        '<input class="campo-texto" type="password" name="senha" inputmode="numeric" autocomplete="off" autofocus></span></label>' +
        '<button class="botao-grande" type="submit">Entrar</button></form></div></div></div>';
      var form = document.getElementById("form-entrar");
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        PT.senha.resumo(form.senha.value).then(function (r) {
          if (r === A.banco.config().senha) {
            A.bloqueado = false;
            document.body.classList.remove("tela-login");
            A.render();
          } else {
            var erro = document.getElementById("erro-senha");
            erro.hidden = false;
            erro.textContent = "Senha errada. Tente de novo.";
            form.senha.value = "";
          }
        }, function (e2) { alert(e2.message); });
      });
    }
  };
  var escondidoEm = 0;
  document.addEventListener("visibilitychange", function () {
    if (!A.banco) return;
    if (document.hidden) escondidoEm = Date.now();
    else if (escondidoEm && Date.now() - escondidoEm > MINUTOS_BLOQUEIO * 60000 && !A.bloqueado) PT.senha.bloquear();
  });

  // ------------------------------------------------------------------ funcionamento sem internet (service worker)
  function registrarOffline() {
    if (!("serviceWorker" in navigator) || !/^https:$|^http:$/.test(location.protocol)) return;
    if (location.protocol === "http:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") return;
    navigator.serviceWorker.register("sw.js").then(function (reg) {
      reg.addEventListener("updatefound", function () {
        var novo = reg.installing;
        if (!novo) return;
        novo.addEventListener("statechange", function () {
          if (novo.state === "installed" && navigator.serviceWorker.controller) {
            var faixa = document.getElementById("faixa-versao");
            faixa.hidden = false;
          }
        });
      });
    }).catch(function (e) { console.warn("sem modo offline:", e); });
  }

  // ------------------------------------------------------------------ sincronização
  // Chegou lançamento do outro aparelho: redesenha a tela, a não ser que a pessoa esteja preenchendo um formulário
  // (aí os dados novos aparecem na próxima troca de tela, sem perder o que foi digitado).
  document.addEventListener("input", function (e) {
    if (e.target && e.target.closest && e.target.closest("form")) A.digitando = true;
  });
  function chegaramDados() {
    if (A.bloqueado || A.digitando) return;
    var ativo = document.activeElement;
    if (ativo && /^(INPUT|SELECT|TEXTAREA)$/.test(ativo.tagName)) return;
    A.render(null, true);
  }
  function ligarNuvem(demo) {
    if (demo || location.protocol === "file:" || !PT.nuvem.disponivel()) return;
    try {
      PT.nuvem.iniciar(A.banco, chegaramDados);
      PT.nuvem.aoMudarEstado(function () {
        var el = document.getElementById("selo-nuvem");
        if (el && PT.telas.seloNuvem) el.outerHTML = PT.telas.seloNuvem();
        if (A.telaAtual() === "ajustes" && !A.digitando) {
          var ativo = document.activeElement;
          if (!(ativo && /^(INPUT|SELECT|TEXTAREA)$/.test(ativo.tagName))) A.render(null, true);
        }
      });
    } catch (e) { console.warn("sincronização desligada:", e); }
  }

  // ------------------------------------------------------------------ partida
  A.iniciar = function () {
    var demo = /[?&]demo\b/.test(location.search);
    var armazem = demo ? PT.banco.armazemMemoria() : PT.banco.armazemIndexedDB();
    A.banco = new PT.banco.Banco(armazem);
    return A.banco.carregar().then(function () {
      if (demo) PT.demo.preencher(A.banco);
      if (!demo && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
      ligarNuvem(demo);
      A.montarTopo();
      window.addEventListener("hashchange", function () { A.render(); });
      if (A.banco.config().senha && !demo) PT.senha.bloquear();
      else A.render();
      registrarOffline();
      document.getElementById("faixa-versao").addEventListener("click", function () { location.reload(); });
    }, function (e) {
      document.getElementById("conteudo").innerHTML = '<div class="caixa-erro">Não deu para abrir os dados do iPad: ' + U.h(e && e.message) +
        "<br>Feche o portal por completo e abra de novo. Se continuar, reinicie o iPad.</div>";
    });
  };
})(PT.app = PT.app || {}, PT.util, PT.pecas);
