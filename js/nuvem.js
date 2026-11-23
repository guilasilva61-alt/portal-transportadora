/* Sincronização entre aparelhos (iPad do patrão, computador…) pelo Firebase do Google, plano gratuito "Spark".

   - O portal continua guardando TUDO no próprio aparelho e funcionando sem internet. A nuvem é uma cópia a mais.
   - Entrou com o e-mail liberado (e já confirmado)? Cada mudança vai para a nuvem; o que o outro aparelho lança chega
     sozinho. Sem internet, o Firebase guarda na fila e envia quando a conexão voltar.
   - Na nuvem: uma coleção por tabela (veiculos, funcionarios, clientes, lancamentos, recebimentos), um documento por
     registro (nome = número do registro), e "ajustes/geral" com os dados da empresa e as listas (sem a senha).
   - Quem pode ler/gravar é decidido pelas REGRAS no console do Firebase (só os e-mails liberados, confirmados).
   - Vale a versão mais nova (atualizado_em). O histórico e a senha ficam só no aparelho. */
var PT = window.PT || (window.PT = {});

(function (N, U) {
  "use strict";
  N.CONFIG = {
    apiKey: "AIzaSyAxHCyK58Q1D3IhhN8MEIl-LCLHF8jLSyc",
    authDomain: "portal-transportadora-9fef7.firebaseapp.com",
    projectId: "portal-transportadora-9fef7",
    storageBucket: "portal-transportadora-9fef7.firebasestorage.app",
    messagingSenderId: "181678739013",
    appId: "1:181678739013:web:2286e556700dcb22f45d2c"
  };

  var auth = null, db = null, banco = null, ouvintes = [], pendentes = 0, conferidas = {};
  var estado = {situacao: "desligada", email: "", erro: ""};   // desligada | entrando | confirmar | ligada | erro
  N.estado = function () {
    return {situacao: estado.situacao, email: estado.email, erro: estado.erro, pendentes: pendentes, online: navigator.onLine !== false};
  };

  var avisarTela = null;
  function mudouEstado() { if (avisarTela) avisarTela(); }
  N.aoMudarEstado = function (fn) { avisarTela = fn; };

  N.disponivel = function () { return !!(window.firebase && firebase.initializeApp); };

  // ------------------------------------------------------------------ partida
  N.iniciar = function (b, aoChegarDados) {
    banco = b;
    if (!N.disponivel()) { estado = {situacao: "erro", email: "", erro: "Biblioteca do Firebase não carregou."}; return; }
    firebase.initializeApp(N.CONFIG);
    auth = firebase.auth();
    db = firebase.firestore();
    // Fila de envio guardada no aparelho: lançou sem internet e fechou o portal? Envia quando abrir com internet.
    db.enablePersistence({synchronizeTabs: true}).catch(function (e) { console.warn("fila sem persistência:", e && e.code); });
    auth.languageCode = "pt";

    banco.aoMudar = function (tabela, r) { enviar(db.collection(tabela).doc(String(r.id)), r); };
    banco.aoMudarConfig = function (cfg, quando) { enviar(db.collection("ajustes").doc("geral"), {config: cfg, atualizado_em: quando}); };

    var aguardandoTela = null;
    function chegou() {           // junta várias mudanças seguidas num redesenho só
      clearTimeout(aguardandoTela);
      aguardandoTela = setTimeout(function () { if (aoChegarDados) aoChegarDados(); }, 300);
    }

    auth.onAuthStateChanged(function (u) {
      pararOuvintes();
      if (!u) { estado = {situacao: "desligada", email: "", erro: ""}; mudouEstado(); return; }
      estado.email = u.email || "";
      estado.erro = "";
      if (!u.emailVerified) { estado.situacao = "confirmar"; mudouEstado(); return; }
      estado.situacao = "ligada";
      mudouEstado();
      ouvir(chegou);
    });
    window.addEventListener("online", mudouEstado);
    window.addEventListener("offline", mudouEstado);
  };

  function enviar(ref, dados) {
    if (!db || estado.situacao !== "ligada") return;   // desligado: a conferência ao entrar manda depois
    pendentes++;
    mudouEstado();
    ref.set(dados).then(function () {
      pendentes--; mudouEstado();
    }, function (e) {
      pendentes--;
      estado.erro = traduzir(e);
      mudouEstado();
    });
  }

  function pararOuvintes() {
    ouvintes.forEach(function (parar) { parar(); });
    ouvintes = [];
    conferidas = {};
  }

  // Escuta cada tabela. Na primeira resposta do SERVIDOR, confere: o que só existe aqui (ou é mais novo aqui) sobe.
  function ouvir(chegou) {
    PT.banco.TABELAS.forEach(function (t) {
      ouvintes.push(db.collection(t).onSnapshot({includeMetadataChanges: true}, function (snap) {
        var mudou = false;
        snap.docChanges().forEach(function (ch) {
          if (ch.type !== "removed" && banco.mesclar(t, ch.doc.data())) mudou = true;
        });
        if (mudou) chegou();
        if (!snap.metadata.fromCache && !conferidas[t]) {
          conferidas[t] = true;
          var remotos = {};
          snap.docs.forEach(function (d) { remotos[d.id] = String(d.get("atualizado_em") || ""); });
          banco.d[t].forEach(function (r) {
            var rem = remotos[String(r.id)];
            if (rem === undefined || String(r.atualizado_em || "") > rem) enviar(db.collection(t).doc(String(r.id)), r);
          });
        }
      }, function (e) { estado.erro = traduzir(e); mudouEstado(); }));
    });
    ouvintes.push(db.collection("ajustes").doc("geral").onSnapshot({includeMetadataChanges: true}, function (doc) {
      if (doc.exists && banco.mesclarConfig(doc.get("config"), doc.get("atualizado_em"))) {
        if (PT.app && PT.app.montarTopo) PT.app.montarTopo();
        chegou();
      }
      if (!doc.metadata.fromCache && !conferidas.ajustes) {
        conferidas.ajustes = true;
        var quando = banco.d.config_atualizado_em;
        if (quando && (!doc.exists || String(quando) > String(doc.get("atualizado_em") || ""))) {
          enviar(db.collection("ajustes").doc("geral"), {config: banco.configSemSenha(), atualizado_em: quando});
        }
      }
    }, function (e) { estado.erro = traduzir(e); mudouEstado(); }));
  }

  // Depois de restaurar uma cópia de segurança: manda tudo de novo para a nuvem
  N.enviarTudo = function () {
    if (estado.situacao !== "ligada") return;
    PT.banco.TABELAS.forEach(function (t) {
      banco.d[t].forEach(function (r) { enviar(db.collection(t).doc(String(r.id)), r); });
    });
    if (banco.d.config_atualizado_em) {
      enviar(db.collection("ajustes").doc("geral"), {config: banco.configSemSenha(), atualizado_em: banco.d.config_atualizado_em});
    }
  };

  // ------------------------------------------------------------------ entrar / criar acesso / sair
  N.entrar = function (email, senha) {
    if (!auth) return Promise.reject(new Error("Sincronização indisponível neste aparelho."));
    estado.situacao = "entrando"; mudouEstado();
    return auth.signInWithEmailAndPassword(String(email || "").trim(), senha || "").catch(falhou);
  };
  // Primeira vez: cria o acesso e manda o e-mail de confirmação (as regras só liberam e-mail confirmado)
  N.criarAcesso = function (email, senha) {
    if (!auth) return Promise.reject(new Error("Sincronização indisponível neste aparelho."));
    estado.situacao = "entrando"; mudouEstado();
    return auth.createUserWithEmailAndPassword(String(email || "").trim(), senha || "").then(function (c) {
      return c.user.sendEmailVerification();
    }).catch(falhou);
  };
  N.reenviarConfirmacao = function () {
    var u = auth && auth.currentUser;
    if (!u) return Promise.reject(new Error("Entre primeiro."));
    return u.sendEmailVerification().catch(falhou);
  };
  // Depois de clicar no link do e-mail: atualiza o acesso para valer a confirmação
  N.jaConfirmei = function () {
    var u = auth && auth.currentUser;
    if (!u) return Promise.reject(new Error("Entre primeiro."));
    return u.reload().then(function () {
      var u2 = auth.currentUser;
      if (!u2.emailVerified) throw new Error("O e-mail ainda não foi confirmado. Abra a mensagem do Firebase e toque no link.");
      return u2.getIdToken(true).then(function () {
        pararOuvintes();
        estado.situacao = "ligada"; estado.erro = "";
        mudouEstado();
        ouvir(function () { if (PT.app) PT.app.render(null, true); });
      });
    });
  };
  N.esqueciSenha = function (email) {
    if (!auth) return Promise.reject(new Error("Sincronização indisponível neste aparelho."));
    return auth.sendPasswordResetEmail(String(email || "").trim()).catch(falhou);
  };
  N.sair = function () { return auth ? auth.signOut() : Promise.resolve(); };

  function falhou(e) {
    var msg = traduzir(e);
    estado.situacao = auth && auth.currentUser ? estado.situacao : "desligada";
    estado.erro = msg;
    mudouEstado();
    throw new Error(msg);
  }

  function traduzir(e) {
    var c = (e && e.code) || "";
    var M = {
      "auth/invalid-email": "E-mail inválido.",
      "auth/missing-password": "Digite a senha.",
      "auth/weak-password": "Senha fraca: use pelo menos 6 letras ou números.",
      "auth/email-already-in-use": "Esse e-mail já tem acesso. Use “Entrar”.",
      "auth/invalid-credential": "E-mail ou senha errados.",
      "auth/invalid-login-credentials": "E-mail ou senha errados.",
      "auth/wrong-password": "E-mail ou senha errados.",
      "auth/user-not-found": "E-mail ou senha errados.",
      "auth/too-many-requests": "Muitas tentativas. Espere alguns minutos e tente de novo.",
      "auth/network-request-failed": "Sem internet agora. Tente quando conectar.",
      "permission-denied": "A nuvem recusou: este e-mail não está liberado ou ainda não foi confirmado.",
      "unavailable": "Sem internet agora: o que for lançado fica guardado e vai depois."
    };
    return M[c] || (e && e.message) || "Erro desconhecido na sincronização.";
  }
})(PT.nuvem = PT.nuvem || {}, PT.util);
