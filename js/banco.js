/* Banco do iPad: tudo fica guardado no próprio aparelho (IndexedDB do Safari), num único "pacote" de dados.
   Ao abrir, o pacote é carregado para a memória; cada alteração grava o pacote inteiro de novo.

   Mesmas regras do transportadora.db: valores em CENTAVOS, preço do litro em MILÉSIMOS, exclusão lógica
   (excluido = 1, o lançamento antigo continua mostrando o nome) e registro do que foi feito (historico).

   Sincronização (nuvem.js): cada registro tem um número ÚNICO (hora em milésimos × 1000 + sorteio), para dois aparelhos
   nunca criarem o mesmo número. Toda mudança avisa banco.aoMudar(tabela, registro); o que chega do outro aparelho entra
   por banco.mesclar() — vale a versão com atualizado_em mais novo. O historico e a senha ficam só no aparelho. */
var PT = window.PT || (window.PT = {});

(function (B, U) {
  "use strict";
  var TABELAS = ["veiculos", "funcionarios", "clientes", "lancamentos", "recebimentos"];
  B.TABELAS = TABELAS;
  B.VERSAO = 1;
  var LIMITE_HISTORICO = 2000;

  B.CONFIG_PADRAO = {
    nome: "Portal Transportadora", empresa: "Transportadora", cnpj: "", iniciais: "PT",
    combustiveis: ["Diesel S10", "Diesel S500", "Gasolina", "Etanol", "Arla 32"],
    categorias_despesa: ["Alimentação", "Multa", "Lavagem", "Outros"],
    funcoes: ["Motorista", "Ajudante", "Outro"],
    tipos_veiculo: ["Truck", "Toco", "Carreta", "Bitruck", "VUC", "3/4", "Utilitário", "Outro"],
    formas_recebimento: ["PIX", "Boleto", "Dinheiro", "Transferência"],
    formas_pedagio: ["TAG Sem Parar", "TAG Veloe", "TAG ConectCar", "Cartão", "Dinheiro"],
    senha: ""          // vazio = abre direto; senão, código (resumo SHA-256) pedido ao abrir
  };

  B.vazio = function () {
    var d = {app: "portal-transportadora", versao: B.VERSAO, criado_em: U.agora(), seq: {}, historico: [],
             config: JSON.parse(JSON.stringify(B.CONFIG_PADRAO)), ultima_copia: null};
    TABELAS.forEach(function (t) { d[t] = []; d.seq[t] = 0; });
    return d;
  };

  // Confere e completa um pacote (o que veio do aparelho ou de uma cópia de segurança)
  B.validar = function (d) {
    if (!d || typeof d !== "object" || d.app !== "portal-transportadora") {
      throw new Error("Este arquivo não é uma cópia de segurança do Portal Transportadora.");
    }
    if ((d.versao || 0) > B.VERSAO) throw new Error("Esta cópia é de uma versão mais nova do portal. Atualize o aplicativo.");
    TABELAS.forEach(function (t) {
      if (!Array.isArray(d[t])) throw new Error("Cópia incompleta: falta a parte “" + t + "”.");
      d.seq = d.seq || {};
      var maior = d[t].reduce(function (m, r) { return Math.max(m, r.id || 0); }, 0);
      d.seq[t] = Math.max(d.seq[t] || 0, maior);
    });
    d.historico = Array.isArray(d.historico) ? d.historico : [];
    var c = d.config || {};
    Object.keys(B.CONFIG_PADRAO).forEach(function (k) {
      if (c[k] == null || (Array.isArray(B.CONFIG_PADRAO[k]) && (!Array.isArray(c[k]) || !c[k].length))) {
        c[k] = JSON.parse(JSON.stringify(B.CONFIG_PADRAO[k]));
      }
    });
    // Pedágio tem tipo próprio: não pode voltar como categoria de "Outra despesa"
    c.categorias_despesa = c.categorias_despesa.filter(function (x) { return U.normaliza(x) !== "PEDAGIO"; });
    if (!c.categorias_despesa.length) c.categorias_despesa = ["Outros"];
    d.config = c;
    d.versao = B.VERSAO;
    return d;
  };

  // ------------------------------------------------------------------ onde o pacote fica guardado
  // Memória (testes e fotos das telas) ou IndexedDB (o iPad de verdade).
  B.armazemMemoria = function (inicial) {
    var guardado = inicial ? JSON.stringify(inicial) : null;
    return {
      ler: function () { return Promise.resolve(guardado ? JSON.parse(guardado) : null); },
      gravar: function (d) { guardado = JSON.stringify(d); return Promise.resolve(); }
    };
  };

  B.armazemIndexedDB = function () {
    var NOME = "portal-transportadora", LOJA = "dados", CHAVE = "banco";
    function abrir() {
      return new Promise(function (ok, falha) {
        var req = indexedDB.open(NOME, 1);
        req.onupgradeneeded = function () { req.result.createObjectStore(LOJA); };
        req.onsuccess = function () { ok(req.result); };
        req.onerror = function () { falha(req.error); };
      });
    }
    var conexao = null;
    function db() { return conexao ? Promise.resolve(conexao) : abrir().then(function (c) { conexao = c; return c; }); }
    return {
      ler: function () {
        return db().then(function (c) {
          return new Promise(function (ok, falha) {
            var r = c.transaction(LOJA, "readonly").objectStore(LOJA).get(CHAVE);
            r.onsuccess = function () { ok(r.result || null); };
            r.onerror = function () { falha(r.error); };
          });
        });
      },
      gravar: function (d) {
        return db().then(function (c) {
          return new Promise(function (ok, falha) {
            var tx = c.transaction(LOJA, "readwrite");
            tx.objectStore(LOJA).put(d, CHAVE);
            tx.oncomplete = function () { ok(); };
            tx.onerror = function () { falha(tx.error); };
            tx.onabort = function () { falha(tx.error || new Error("gravação cancelada")); };
          });
        });
      }
    };
  };

  // ------------------------------------------------------------------ o banco
  function Banco(armazem) {
    this.armazem = armazem;
    this.d = B.vazio();
    this.fila = Promise.resolve();
  }
  B.Banco = Banco;
  var P = Banco.prototype;

  P.carregar = function () {
    var self = this;
    return this.armazem.ler().then(function (d) {
      self.d = d ? B.validar(d) : B.vazio();
      return self;
    });
  };

  // Grava o pacote inteiro (em fila: uma gravação de cada vez, na ordem)
  P.salvar = function () {
    var self = this, copia = JSON.parse(JSON.stringify(this.d));
    this.fila = this.fila.then(function () { return self.armazem.gravar(copia); });
    return this.fila;
  };

  P.config = function () { return this.d.config; };

  P._auditar = function (entidade, id, acao, antes, depois) {
    var h = this.d.historico;
    h.push({quando: U.agora(), entidade: entidade, id: id, acao: acao, antes: antes, depois: depois});
    if (h.length > LIMITE_HISTORICO) h.splice(0, h.length - LIMITE_HISTORICO);
  };

  // Número novo, único entre aparelhos e sempre crescente neste aparelho (cabe com folga num número exato do JavaScript)
  var ultimoId = 0;
  B.novoId = function () {
    var id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
    if (id <= ultimoId) id = ultimoId + 1;
    ultimoId = id;
    return id;
  };

  // Avisa quem estiver ouvindo (a sincronização) que um registro mudou
  P._mudou = function (tabela, r) {
    if (!this.aoMudar) return;
    try { this.aoMudar(tabela, JSON.parse(JSON.stringify(r))); } catch (e) { console.warn("sincronização:", e); }
  };

  // Registro vindo do outro aparelho: entra se for novo ou mais recente que o daqui. Devolve true se mudou algo.
  P.mesclar = function (tabela, remoto) {
    if (TABELAS.indexOf(tabela) < 0 || !remoto || !remoto.id) return false;
    var r = this._bruto(tabela, remoto.id);
    if (r && String(r.atualizado_em || "") >= String(remoto.atualizado_em || "")) return false;
    if (r) {
      Object.keys(r).forEach(function (k) { delete r[k]; });
      Object.assign(r, remoto);
    } else {
      this.d[tabela].push(Object.assign({}, remoto));
    }
    if (remoto.id > (this.d.seq[tabela] || 0)) this.d.seq[tabela] = remoto.id;
    this.salvar();
    return true;
  };

  // Ajustes (empresa, listas) mudaram aqui → marca a hora e avisa a sincronização. A senha não vai junto.
  P.configSemSenha = function () {
    var c = JSON.parse(JSON.stringify(this.d.config));
    delete c.senha;
    return c;
  };
  P.mudouConfig = function () {
    this.d.config_atualizado_em = U.agora();
    this.salvar();
    if (this.aoMudarConfig) {
      try { this.aoMudarConfig(this.configSemSenha(), this.d.config_atualizado_em); } catch (e) { console.warn("sincronização:", e); }
    }
  };
  // Ajustes vindos do outro aparelho (se forem mais novos); a senha daqui continua
  P.mesclarConfig = function (remoto, quando) {
    if (!remoto || !quando || String(this.d.config_atualizado_em || "") >= String(quando)) return false;
    var senha = this.d.config.senha;
    var c = JSON.parse(JSON.stringify(remoto));
    delete c.senha;
    this.d.config = B.validar(Object.assign({}, this.d, {config: c})).config;
    this.d.config.senha = senha || "";
    this.d.config_atualizado_em = quando;
    this.salvar();
    return true;
  };

  P.criar = function (tabela, dados) {
    var t = U.agora(), id = B.novoId(tabela);
    if (id > (this.d.seq[tabela] || 0)) this.d.seq[tabela] = id;
    var r = Object.assign({}, dados, {id: id, criado_em: t, atualizado_em: t, excluido: 0});
    this.d[tabela].push(r);
    this._auditar(tabela, id, "criar", null, dados);
    this.salvar();
    this._mudou(tabela, r);
    return id;
  };

  P._bruto = function (tabela, id) {
    id = Number(id);
    for (var i = 0; i < this.d[tabela].length; i++) if (this.d[tabela][i].id === id) return this.d[tabela][i];
    return null;
  };

  P.obter = function (tabela, id) {
    var r = this._bruto(tabela, id);
    return r && !r.excluido ? Object.assign({}, r) : null;
  };

  P.alterar = function (tabela, id, dados, acao) {
    var r = this._bruto(tabela, id);
    if (!r || r.excluido) return false;
    var antes = {};
    Object.keys(dados).forEach(function (k) { antes[k] = r[k]; });
    Object.assign(r, dados, {atualizado_em: U.agora()});
    this._auditar(tabela, r.id, acao || "editar", antes, dados);
    this.salvar();
    this._mudou(tabela, r);
    return true;
  };

  P.excluir = function (tabela, id) {
    var r = this._bruto(tabela, id);
    if (!r || r.excluido) return false;
    r.excluido = 1;
    r.atualizado_em = U.agora();
    this._auditar(tabela, r.id, "excluir", null, null);
    this.salvar();
    this._mudou(tabela, r);
    return true;
  };

  function porTexto(campo) {
    return function (a, b) { return String(a[campo]).localeCompare(String(b[campo]), "pt-BR", {sensitivity: "base"}); };
  }
  function vivos(lista) { return lista.filter(function (r) { return !r.excluido; }).map(function (r) { return Object.assign({}, r); }); }

  // ------------------------------------------------------------------ cadastros
  P.veiculos = function (soAtivos) {
    return vivos(this.d.veiculos).filter(function (v) { return !soAtivos || v.ativo; })
      .sort(function (a, b) { return (b.ativo - a.ativo) || (a.placa < b.placa ? -1 : a.placa > b.placa ? 1 : 0); });
  };
  P.funcionarios = function (soAtivos) {
    var cmp = porTexto("nome");
    return vivos(this.d.funcionarios).filter(function (v) { return !soAtivos || v.ativo; })
      .sort(function (a, b) { return (b.ativo - a.ativo) || cmp(a, b); });
  };
  P.clientes = function (soAtivos) {
    return vivos(this.d.clientes).filter(function (v) { return !soAtivos || v.ativo; }).sort(porTexto("nome"));
  };
  P.placaEmUso = function (placa, exceto) {
    return this.d.veiculos.some(function (v) { return !v.excluido && v.placa === placa && v.id !== (exceto || 0); });
  };
  // Abastecimento/manutenção com km maior que o do cadastro → o km atual do veículo acompanha
  P.atualizarKm = function (veiculoId, km) {
    var v = this.obter("veiculos", veiculoId);
    if (v && km && (v.km_atual || 0) < km) this.alterar("veiculos", veiculoId, {km_atual: km}, "km_automatico");
  };

  // nome/placa mesmo de cadastro excluído (o lançamento antigo continua mostrando)
  P._nome = function (tabela, id, campo) {
    var r = id ? this._bruto(tabela, id) : null;
    return r ? r[campo] : null;
  };

  function ordemData(a, b) { return (a.data < b.data ? 1 : a.data > b.data ? -1 : 0) || b.id - a.id; }

  // ------------------------------------------------------------------ lançamentos
  P.lancamentos = function (f) {
    f = f || {};
    var self = this;
    return vivos(this.d.lancamentos).filter(function (l) {
      return (!f.de || l.data >= f.de) && (!f.ate || l.data <= f.ate) && (!f.tipo || l.tipo === f.tipo) &&
        (!f.veiculo_id || l.veiculo_id === f.veiculo_id) && (!f.funcionario_id || l.funcionario_id === f.funcionario_id) &&
        (!f.situacao || l.situacao === f.situacao);
    }).map(function (l) {
      l.funcionario = self._nome("funcionarios", l.funcionario_id, "nome");
      l.placa = self._nome("veiculos", l.veiculo_id, "placa");
      return l;
    }).sort(ordemData);
  };

  P.abastecimentosDoVeiculo = function (veiculoId) {
    return vivos(this.d.lancamentos).filter(function (l) { return l.tipo === "abastecimento" && l.veiculo_id === veiculoId; })
      .sort(function (a, b) { return (a.data < b.data ? -1 : a.data > b.data ? 1 : 0) || a.id - b.id; });
  };

  // Maior km registrado (abastecimento/manutenção) ANTES da data — ponto de partida do km rodado no período
  P.ultimoKmAntes = function (veiculoId, data) {
    var kms = this.d.lancamentos.filter(function (l) {
      return !l.excluido && l.veiculo_id === veiculoId && l.km != null && l.data < data;
    }).map(function (l) { return l.km; });
    return kms.length ? Math.max.apply(null, kms) : null;
  };

  // ------------------------------------------------------------------ recebimentos
  P.recebimentos = function (f) {
    f = f || {};
    var self = this;
    return vivos(this.d.recebimentos).filter(function (r) {
      return (!f.de || r.data >= f.de) && (!f.ate || r.data <= f.ate) && (!f.tipo || r.tipo === f.tipo) &&
        (!f.cliente_id || r.cliente_id === f.cliente_id) && (!f.veiculo_id || r.veiculo_id === f.veiculo_id) &&
        (!f.funcionario_id || r.funcionario_id === f.funcionario_id) && (!f.situacao || r.situacao === f.situacao);
    }).map(function (r) {
      r.cliente = self._nome("clientes", r.cliente_id, "nome");
      r.funcionario = self._nome("funcionarios", r.funcionario_id, "nome");
      r.placa = self._nome("veiculos", r.veiculo_id, "placa");
      return r;
    }).sort(ordemData);
  };

  // ------------------------------------------------------------------ resumo do mês (Início)
  P.resumo = function (de, ate) {
    var noPeriodo = function (x) { return !x.excluido && x.data >= de && x.data <= ate; };
    var soma = function (lista) { return lista.reduce(function (s, x) { return s + x.valor; }, 0); };
    var L = this.d.lancamentos.filter(noPeriodo), R = this.d.recebimentos;
    var gasto = soma(L);
    var recebido = soma(R.filter(function (r) {
      var dt = r.data_recebimento || r.data;
      return !r.excluido && r.situacao === "Recebido" && dt >= de && dt <= ate;
    }));
    return {
      recebido: recebido, gasto: gasto, resultado: recebido - gasto,
      combustivel: soma(L.filter(function (l) { return l.tipo === "abastecimento"; })),
      pedagio: soma(L.filter(function (l) { return l.tipo === "pedagio"; })),
      a_pagar: soma(L.filter(function (l) { return l.situacao === "A pagar"; })),
      a_receber: soma(R.filter(function (r) { return noPeriodo(r) && r.situacao === "A receber"; }))
    };
  };

  // ------------------------------------------------------------------ pedágio
  // Praças/rodovias já digitadas (as mais usadas primeiro) — sugestões no campo do pedágio
  P.pracasUsadas = function (limite) {
    var cont = {};
    this.d.lancamentos.forEach(function (l) {
      if (l.excluido || l.tipo !== "pedagio" || !l.praca) return;
      var c = cont[l.praca] || (cont[l.praca] = {praca: l.praca, n: 0, ultima: ""});
      c.n++;
      if (l.data > c.ultima) c.ultima = l.data;
    });
    return Object.keys(cont).map(function (k) { return cont[k]; })
      .sort(function (a, b) { return b.n - a.n || (a.ultima < b.ultima ? 1 : a.ultima > b.ultima ? -1 : 0); })
      .slice(0, limite || 200).map(function (c) { return c.praca; });
  };

  // Fretes dos últimos N dias (até a data) para vincular ao pedágio; o já vinculado sempre aparece
  P.fretesParaVincular = function (ate, dias, incluirId) {
    var de = U.somaDias(ate, -(dias || 60));
    return this.recebimentos({tipo: "frete"}).filter(function (r) {
      return (r.data >= de && r.data <= ate) || r.id === incluirId;
    });
  };

  // ------------------------------------------------------------------ cópia de segurança
  P.exportar = function () {
    var d = JSON.parse(JSON.stringify(this.d));
    d.exportado_em = U.agora();
    return d;
  };
  P.marcarCopia = function () {
    this.d.ultima_copia = U.agora();
    return this.salvar();
  };
  P.restaurar = function (pacote) {
    var d = B.validar(JSON.parse(JSON.stringify(pacote)));
    d.ultima_copia = U.agora();          // acabou de vir de uma cópia: ela existe
    this.d = d;
    this._auditar("banco", 0, "restaurar", null, {de: pacote.exportado_em || ""});
    return this.salvar();
  };
  P.contagem = function () {
    var self = this, c = {};
    TABELAS.forEach(function (t) { c[t] = self.d[t].filter(function (r) { return !r.excluido; }).length; });
    return c;
  };
})(PT.banco = PT.banco || {}, PT.util);
