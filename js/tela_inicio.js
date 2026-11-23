/* Início (resumo do mês + cartões) e Ajustes (cópia de segurança, dados da empresa, listas e senha). */
var PT = window.PT || (window.PT = {});
PT.telas = PT.telas || {};

(function (T, U, Pc) {
  "use strict";
  var h = U.h;
  function b() { return PT.app.banco; }
  var DIAS_AVISO_COPIA = 7;

  // Quantos dias desde a última cópia de segurança (null = nunca fez)
  function diasSemCopia() {
    var u = b().d.ultima_copia;
    if (!u) return null;
    return Math.floor((Date.now() - new Date(u + "Z").getTime()) / 86400000);
  }
  function temDados() {
    var c = b().contagem();
    return c.lancamentos + c.recebimentos + c.veiculos + c.funcionarios > 0;
  }
  // Faixa de lembrete da cópia (no Início)
  T.avisoCopia = function () {
    if (!temDados()) return "";
    var d = diasSemCopia();
    if (d !== null && d < DIAS_AVISO_COPIA) return "";
    return '<p class="faixa amarela faixa-copia">' + Pc.icone("copia") + "<span>" +
      (d === null ? "Você ainda não fez nenhuma cópia de segurança." : "A última cópia de segurança foi há " + d + " dias.") +
      " Se o iPad quebrar ou for perdido, os lançamentos só voltam com ela.</span>" +
      '<button type="button" class="botao-pequeno destaque" data-acao="copia">Fazer cópia agora</button></p>';
  };

  // ------------------------------------------------------------------ sincronização (selo e painel)
  function nuvemDisponivel() { return PT.nuvem && PT.nuvem.disponivel() && location.protocol !== "file:" && !/[?&]demo\b/.test(location.search); }

  // Selo pequeno com a situação da sincronização (Início e Ajustes); some quando ela nem existe neste aparelho
  T.seloNuvem = function () {
    if (!nuvemDisponivel()) return '<span id="selo-nuvem" hidden></span>';
    var e = PT.nuvem.estado(), txt, cor;
    if (e.situacao === "ligada") {
      if (!e.online) { txt = "Sem internet: o que lançar aqui vai depois"; cor = "aviso"; }
      else if (e.pendentes) { txt = "Enviando " + e.pendentes + " alteração(ões)…"; cor = "aviso"; }
      else { txt = "Sincronizado com os outros aparelhos"; cor = "ok"; }
    } else if (e.situacao === "confirmar") { txt = "Falta confirmar o e-mail para sincronizar"; cor = "aviso"; }
    else if (e.situacao === "entrando") { txt = "Entrando…"; cor = "aviso"; }
    else { txt = "Sincronização desligada (dados só neste aparelho)"; cor = "desligada"; }
    return '<a id="selo-nuvem" class="selo-nuvem selo-' + cor + '" href="#/ajustes">' + Pc.icone("copia") + "<span>" + h(txt) + "</span></a>";
  };

  function painelNuvem() {
    var titulo = '<h2 class="painel-titulo">Sincronização entre aparelhos</h2>';
    if (!nuvemDisponivel()) {
      return '<section class="painel-form">' + titulo + '<p class="explica">A sincronização só funciona no portal instalado pelo endereço com cadeado ' +
        "(não no modo de demonstração).</p></section>";
    }
    var e = PT.nuvem.estado();
    var erro = e.erro ? '<div class="flash flash-erro" role="alert">' + h(e.erro) + "</div>" : "";
    var corpo;
    if (e.situacao === "ligada") {
      corpo = '<p class="explica">Ligada com <b>' + h(e.email) + "</b>. Tudo o que for lançado aqui aparece nos outros aparelhos que " +
        "entraram com o mesmo e-mail — e o que eles lançam aparece aqui. Sem internet continua funcionando: as alterações ficam " +
        "guardadas e vão quando a conexão voltar.</p>" + '<p class="explica">' + T.seloNuvem() + "</p>" +
        '<div class="acoes-form"><button type="button" class="botao-pequeno" data-nuvem="sair">Sair desta conta</button></div>';
    } else if (e.situacao === "confirmar") {
      corpo = '<p class="explica">Falta só confirmar o e-mail <b>' + h(e.email) + "</b>: abra a mensagem do Firebase (veja também o Spam), " +
        "toque no link e depois volte aqui e toque em <b>Já confirmei</b>.</p>" +
        '<div class="acoes-form"><button type="button" class="botao-salvar sem-seta" data-nuvem="confirmei">Já confirmei</button>' +
        '<button type="button" class="botao-pequeno" data-nuvem="reenviar">Reenviar o e-mail</button>' +
        '<button type="button" class="botao-pequeno" data-nuvem="sair">Sair</button></div>';
    } else {
      corpo = '<p class="explica">Desligada: os dados ficam <b>só neste aparelho</b>. Para o iPad e o computador mostrarem a mesma coisa, ' +
        "entre com o <b>mesmo e-mail e senha</b> nos dois. Na primeira vez use <b>Primeira vez: criar acesso</b> (chega um e-mail para confirmar).</p>" +
        '<form id="form-nuvem" novalidate><div class="campos">' +
        '<label>E-mail <input class="campo" type="email" name="email" autocomplete="username" autocapitalize="off" value="' + h(e.email) + '"></label>' +
        '<label>Senha <input class="campo" type="password" name="senha" autocomplete="current-password"></label></div>' +
        '<div class="acoes-form"><button class="botao-salvar" type="submit"' + (e.situacao === "entrando" ? " disabled" : "") + ">" +
        (e.situacao === "entrando" ? "Entrando…" : "Entrar") + "</button>" +
        '<button type="button" class="botao-pequeno" data-nuvem="criar">Primeira vez: criar acesso</button>' +
        '<button type="button" class="botao-pequeno" data-nuvem="esqueci">Esqueci a senha</button></div></form>';
    }
    return '<section class="painel-form" id="painel-nuvem">' + titulo + erro + corpo + "</section>";
  }

  function ligarNuvem(raiz) {
    var painel = raiz.querySelector("#painel-nuvem");
    if (!painel) return;
    function depois(msg, cat) {
      return function () { if (msg) PT.app.aviso(msg, cat || "ok"); PT.app.digitando = false; PT.app.render(null, true); };
    }
    function falha(e) { PT.app.aviso(e.message, "erro"); PT.app.digitando = false; PT.app.render(null, true); }
    var form = painel.querySelector("#form-nuvem");
    var dados = function () { return form ? Pc.lerForm(form) : {}; };
    if (form) {
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var f = dados();
        PT.nuvem.entrar(f.email, f.senha).then(depois("Entrou. Os dados deste aparelho e da nuvem estão sendo juntados."), falha);
      });
    }
    painel.querySelectorAll("[data-nuvem]").forEach(function (bt) {
      bt.addEventListener("click", function () {
        var acao = bt.dataset.nuvem, f = dados();
        if (acao === "criar") {
          PT.nuvem.criarAcesso(f.email, f.senha).then(depois("Acesso criado. Enviamos um e-mail de confirmação para " + String(f.email || "").trim() + "."), falha);
        } else if (acao === "esqueci") {
          if (!f.email) { falha(new Error("Digite o e-mail para receber o link de nova senha.")); return; }
          PT.nuvem.esqueciSenha(f.email).then(depois("Enviamos um link para criar uma senha nova em " + String(f.email).trim() + "."), falha);
        } else if (acao === "confirmei") {
          PT.nuvem.jaConfirmei().then(depois("E-mail confirmado: sincronização ligada."), falha);
        } else if (acao === "reenviar") {
          PT.nuvem.reenviarConfirmacao().then(depois("E-mail de confirmação enviado de novo."), falha);
        } else if (acao === "sair") {
          if (!window.confirm("Sair da sincronização neste aparelho?\n\nOs dados continuam guardados aqui; só param de ir e vir.")) return;
          PT.nuvem.sair().then(depois("Saiu: este aparelho parou de sincronizar."), falha);
        }
      });
    });
  }

  T[""] = function () {
    var cfg = b().config(), mes = U.mesAtual(), r = b().resumo(mes[0], mes[1]);
    function item(cor, icone, rotulo, valor, sub) {
      return '<div class="resumo-item ' + cor + '">' + Pc.icone(icone) + '<span class="resumo-rotulo">' + rotulo + "</span><b>" + U.rs(valor) + "</b>" +
        (sub ? "<small>" + sub + "</small>" : "") + "</div>";
    }
    function pct(v) { return r.gasto ? Math.round(100 * v / r.gasto) + "% do gasto" : ""; }
    var cartoes = [
      ["lancamentos", "Lançamentos", "Diárias, bonificações, abastecimentos, manutenções, pedágio e outras despesas", "#/lancamentos", "cor-vermelho"],
      ["recebimentos", "Recebimentos", "Fretes recebidos e a receber, e outras entradas", "#/recebimentos", "cor-verde"],
      ["veiculos", "Veículos", "Placa, modelo, tipo, ano e km atual da frota", "#/veiculos", "cor-azul"],
      ["funcionarios", "Funcionários", "Motoristas e ajudantes, com o valor padrão da diária", "#/funcionarios", "cor-dourado"],
      ["relatorios", "Relatórios", "Por motorista, por veículo e geral do mês, para imprimir", "#/relatorios", "cor-laranja"],
      ["ajustes", "Ajustes", "Cópia de segurança, dados da empresa, listas e senha", "#/ajustes", "cor-cinza"]
    ].map(function (c) {
      return '<a class="cartao" href="' + c[3] + '"><span class="cartao-icone ' + c[4] + '">' + Pc.icone(c[0]) + '</span><span class="cartao-titulo">' +
        c[1] + '</span><span class="cartao-desc">' + c[2] + "</span></a>";
    }).join("");
    var html = T.avisoCopia() +
      '<div class="portal-cabeca">' + Pc.logo(cfg, "logo-grande") + '<h1 class="portal-titulo">' + Pc.tituloOuro(cfg.nome) + "</h1>" +
      '<p class="portal-sub">Resumo de ' + U.mesTxt() + "</p>" + T.seloNuvem() + "</div>" +
      '<div class="resumo-mes">' +
      item("verde", "recebimentos", "Total recebido", r.recebido, r.a_receber ? "a receber: " + U.rs(r.a_receber) : "") +
      item("vermelho", "gasto", "Total gasto", r.gasto, r.a_pagar ? "a pagar: " + U.rs(r.a_pagar) : "") +
      item(r.resultado >= 0 ? "verde" : "vermelho", "resultado", "Resultado", r.resultado, "recebido − gasto") +
      item("dourado", "abastecimento", "Combustível", r.combustivel, pct(r.combustivel)) +
      item("laranja", "pedagio", "Pedágio", r.pedagio, pct(r.pedagio)) + "</div>" +
      '<div class="cartoes">' + cartoes + "</div>";
    return {html: html, menu: "", depois: ligarCopia};
  };

  function ligarCopia(raiz) {
    raiz.querySelectorAll("[data-acao=copia]").forEach(function (bt) {
      bt.addEventListener("click", function () { PT.copia.salvar().then(function () { PT.app.render(null, true); }); });
    });
  }

  // ------------------------------------------------------------------ ajustes
  T.ajustes = function (p, estado) {
    estado = estado || {};
    var cfg = b().config(), c = b().contagem(), dias = diasSemCopia();
    var ultima = b().d.ultima_copia ? U.dataBr(b().d.ultima_copia.slice(0, 10)) + " (há " + dias + " dia" + (dias === 1 ? "" : "s") + ")" : "nunca";
    function area(nome, rotulo) {
      return '<label>' + h(rotulo) + ' <textarea class="campo lista-opcoes" name="' + nome + '" rows="5">' + h(cfg[nome].join("\n")) + "</textarea></label>";
    }
    var html = "<h1>Ajustes</h1>" + painelNuvem() +
      '<section class="painel-form"><h2 class="painel-titulo">Cópia de segurança</h2>' +
      '<p class="explica">Tudo o que é lançado fica guardado <b>neste aparelho</b> (e na nuvem, se a sincronização estiver ligada). ' +
      "A cópia de segurança é um arquivo com todos os dados: " +
      "salve no iCloud Drive (app Arquivos) ou mande para você mesmo no WhatsApp/e-mail. Se o iPad quebrar, for trocado ou o aplicativo for apagado, " +
      "é com ela que tudo volta.</p>" +
      '<p class="explica">Última cópia: <b>' + ultima + "</b> · Guardado agora: " + c.lancamentos + " lançamento(s), " + c.recebimentos +
      " recebimento(s), " + c.veiculos + " veículo(s), " + c.funcionarios + " funcionário(s), " + c.clientes + " cliente(s).</p>" +
      '<div class="acoes-form"><button type="button" class="botao-salvar sem-seta" data-acao="copia">' + Pc.icone("copia") + " Fazer cópia agora</button>" +
      '<label class="botao-pequeno botao-arquivo">Restaurar de uma cópia… <input type="file" id="arquivo-copia" accept=".json,application/json"></label></div>' +
      '<p class="explica nota-armazem" id="nota-armazem"></p></section>' +

      '<form class="painel-form" id="form-empresa" novalidate><h2 class="painel-titulo">Dados da empresa</h2>' +
      (estado.erros ? Pc.erros(estado.erros) : "") + '<div class="campos">' +
      '<label>Nome do portal <input class="campo" name="nome" maxlength="40" value="' + h(cfg.nome) + '"></label>' +
      '<label>Iniciais (no selo) <input class="campo" name="iniciais" maxlength="4" value="' + h(cfg.iniciais) + '"></label>' +
      '<label>Empresa (sai no recibo) <input class="campo" name="empresa" maxlength="80" value="' + h(cfg.empresa) + '"></label>' +
      '<label>CNPJ <input class="campo" name="cnpj" maxlength="20" inputmode="numeric" value="' + h(cfg.cnpj) + '" placeholder="opcional"></label></div>' +
      '<h2 class="painel-titulo sub">Opções das listas <small>(uma por linha)</small></h2><div class="campos">' +
      area("combustiveis", "Combustíveis") + area("categorias_despesa", "Categorias de “Outra despesa”") +
      area("formas_pedagio", "Formas de pagamento do pedágio") + area("formas_recebimento", "Formas de recebimento") +
      area("tipos_veiculo", "Tipos de veículo") + area("funcoes", "Funções dos funcionários") + "</div>" +
      '<div class="acoes-form"><button class="botao-salvar" type="submit">Salvar ajustes</button></div></form>' +

      '<form class="painel-form" id="form-senha" novalidate><h2 class="painel-titulo">Senha para abrir</h2>' +
      '<p class="explica">' + (cfg.senha ? "O portal pede a senha ao abrir e depois de 5 minutos fora dele." :
        "Hoje o portal abre direto, sem senha. Se quiser, crie uma senha (só números, de 4 a 8) para ninguém mexer se pegar o iPad.") +
      " <b>Atenção:</b> se esquecer a senha, só dá para entrar apagando o aplicativo e restaurando uma cópia de segurança.</p>" +
      '<div class="campos">' +
      (cfg.senha ? '<label>Senha atual <input class="campo" type="password" name="atual" inputmode="numeric" autocomplete="off"></label>' : "") +
      '<label>' + (cfg.senha ? "Nova senha (vazio = tirar a senha)" : "Nova senha") + ' <input class="campo" type="password" name="nova" inputmode="numeric" autocomplete="new-password"></label>' +
      '<label>Repita a nova senha <input class="campo" type="password" name="repete" inputmode="numeric" autocomplete="new-password"></label></div>' +
      '<div class="acoes-form"><button class="botao-salvar" type="submit">' + (cfg.senha ? "Trocar / tirar a senha" : "Criar senha") + "</button></div></form>" +
      '<p class="nota versao">Portal Transportadora para iPad · versão ' + PT.VERSAO + "</p>";

    return {
      html: html, menu: "ajustes",
      depois: function (raiz) {
        ligarCopia(raiz);
        ligarNuvem(raiz);
        var nota = raiz.querySelector("#nota-armazem");
        if (navigator.storage && navigator.storage.persisted) {
          navigator.storage.persisted().then(function (ok) {
            nota.textContent = ok ? "O iPad marcou estes dados como permanentes (ele não apaga sozinho para liberar espaço)." :
              "Abra o portal sempre pelo ícone na Tela de Início: assim o iPad guarda os dados de forma permanente.";
          }).catch(function () {});
        }
        raiz.querySelector("#arquivo-copia").addEventListener("change", function (e) {
          var arq = e.target.files && e.target.files[0];
          e.target.value = "";
          if (arq) PT.copia.restaurar(arq);
        });
        var fe = raiz.querySelector("#form-empresa");
        PT.comportamento.formulario(fe);
        fe.addEventListener("submit", function (e) {
          e.preventDefault();
          var f = Pc.lerForm(fe);
          var linhas = function (t) {
            var vistos = {};
            return String(t || "").split(/[\n,]/).map(function (x) { return U.txt(x, 40); })
              .filter(function (x) { if (!x || vistos[x]) return false; vistos[x] = 1; return true; });
          };
          var novo = {nome: U.txt(f.nome, 40) || "Portal Transportadora", iniciais: U.txt(f.iniciais, 4) || "PT",
                      empresa: U.txt(f.empresa, 80) || "Transportadora", cnpj: U.txt(f.cnpj, 20)};
          ["combustiveis", "categorias_despesa", "formas_pedagio", "formas_recebimento", "tipos_veiculo", "funcoes"].forEach(function (k) {
            novo[k] = linhas(f[k]);
            if (!novo[k].length) novo[k] = PT.banco.CONFIG_PADRAO[k].slice();
          });
          var tirados = novo.categorias_despesa.filter(function (x) { return U.normaliza(x) === "PEDAGIO"; }).length;
          novo.categorias_despesa = novo.categorias_despesa.filter(function (x) { return U.normaliza(x) !== "PEDAGIO"; });
          if (!novo.categorias_despesa.length) novo.categorias_despesa = ["Outros"];
          Object.assign(b().d.config, novo);
          b()._auditar("config", 0, "editar", null, novo);
          b().mudouConfig();
          PT.app.aviso("Ajustes salvos." + (tirados ? " (“Pedágio” saiu das categorias: ele tem botão próprio nos Lançamentos.)" : ""), "ok");
          PT.app.montarTopo();
          PT.app.render(null, true);
        });
        var fs = raiz.querySelector("#form-senha");
        fs.addEventListener("submit", function (e) {
          e.preventDefault();
          var f = Pc.lerForm(fs);
          PT.senha.trocar(f.atual || "", f.nova || "", f.repete || "").then(function (msg) {
            PT.app.aviso(msg, "ok");
            PT.app.render(null, true);
          }, function (erro) {
            PT.app.aviso(erro.message, "erro");
            PT.app.render(null, true);
          });
        });
      }
    };
  };
})(PT.telas, PT.util, PT.pecas);
