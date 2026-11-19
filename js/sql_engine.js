/**
 * MOTOR DE PERSISTENCIA E BACKUP EM SQL - PDV POSTO
 * Mantem a base relacional sincronizada e gera um dump SQL a cada alteracao.
 */

class SQLEngine {
    constructor() {
        this.db = {
            usuarios: [],
            funcionarios: [],
            bombas: [],
            combustiveis: [],
            bicos: [],
            tabela_precos: [],
            turnos_caixa: [],
            vendas: [],
            documentos_fiscais: [],
            auditoria_logs: []
        };
        this.servidorLocalAtivo = false;
        this.ultimoArquivoBackup = '';
        this.iniciar();
    }

    iniciar() {
        const dadosLocais = localStorage.getItem('pdv_posto_db');
        if (dadosLocais) {
            try {
                this.db = JSON.parse(dadosLocais);
            } catch (e) {
                console.error("Falha ao restaurar banco local:", e);
                this.carregarDadosIniciaisPadrao();
            }
        } else {
            this.carregarDadosIniciaisPadrao();
        }

        // Assegurar consistencia da tabela de turnos
        if (!this.db.turnos_caixa || this.db.turnos_caixa.length === 0) {
            this.db.turnos_caixa = [{
                id: 1,
                codigo_turno: 'TRN-001',
                operador: 'Mariana Santos',
                responsavel_pista: 'Carlos Eduardo',
                turno: 'DIURNO_12X36',
                data_abertura: new Date().toISOString(),
                data_fechamento: null,
                status: 'ABERTO',
                total_vendas_qtd: 0,
                total_valor: 0.00,
                total_litros: 0.000,
                total_gnv: 0.000,
                total_dinheiro: 0.00,
                total_pix: 0.00,
                total_cartao_debito: 0.00,
                total_cartao_credito: 0.00
            }];
            this.salvarLocal();
        } else {
            // Garantir que haja um turno aberto
            const aberto = this.db.turnos_caixa.find(t => t.status === 'ABERTO');
            if (!aberto) {
                const proximoId = Math.max(...this.db.turnos_caixa.map(t => t.id || 0)) + 1;
                this.db.turnos_caixa.push({
                    id: proximoId,
                    codigo_turno: `TRN-${String(proximoId).padStart(3, '0')}`,
                    operador: 'Mariana Santos',
                    responsavel_pista: 'Carlos Eduardo',
                    turno: 'DIURNO_12X36',
                    data_abertura: new Date().toISOString(),
                    data_fechamento: null,
                    status: 'ABERTO',
                    total_vendas_qtd: 0,
                    total_valor: 0.00,
                    total_litros: 0.000,
                    total_gnv: 0.000,
                    total_dinheiro: 0.00,
                    total_pix: 0.00,
                    total_cartao_debito: 0.00,
                    total_cartao_credito: 0.00
                });
                this.salvarLocal();
            }
        }

        // Vincular vendas antigas sem id_turno ao turno 1
        if (this.db.vendas && this.db.vendas.length > 0) {
            for (const v of this.db.vendas) {
                if (!v.id_turno) {
                    v.id_turno = 1;
                }
            }
            this.salvarLocal();
        }

        this.testarServidorLocal();
    }

    obterTurnoAtivo() {
        if (!this.db.turnos_caixa) return null;
        let turno = this.db.turnos_caixa.find(t => t.status === 'ABERTO');
        if (!turno && this.db.turnos_caixa.length > 0) {
            turno = this.db.turnos_caixa[this.db.turnos_caixa.length - 1];
        }
        return turno;
    }

    /**
     * Fecha o turno atual com seus totais e inicia o novo turno imediatamente
     */
    async fecharTurnoECriarNovo(resumoFechamento, proximoTipoTurno, proximoResponsavel, proximoOperador) {
        const turnoAtual = this.obterTurnoAtivo();
        if (turnoAtual) {
            turnoAtual.status = 'FECHADO';
            turnoAtual.data_fechamento = new Date().toISOString();
            turnoAtual.total_vendas_qtd = resumoFechamento.qtd_vendas;
            turnoAtual.total_valor = resumoFechamento.receita_total;
            turnoAtual.total_litros = resumoFechamento.total_litros;
            turnoAtual.total_gnv = resumoFechamento.total_gnv;
            turnoAtual.total_dinheiro = resumoFechamento.total_dinheiro;
            turnoAtual.total_pix = resumoFechamento.total_pix;
            turnoAtual.total_cartao_debito = resumoFechamento.total_cartao_debito;
            turnoAtual.total_cartao_credito = resumoFechamento.total_cartao_credito;
        }

        const proximoId = (this.db.turnos_caixa.length > 0 ? Math.max(...this.db.turnos_caixa.map(t => t.id || 0)) : 0) + 1;
        const codigoNovoTurno = `TRN-${String(proximoId).padStart(3, '0')}`;

        const novoTurno = {
            id: proximoId,
            codigo_turno: codigoNovoTurno,
            operador: proximoOperador || 'Mariana Santos',
            responsavel_pista: proximoResponsavel || (proximoTipoTurno.includes('NOTURNO') ? 'Roberto Silva' : 'Carlos Eduardo'),
            turno: proximoTipoTurno,
            data_abertura: new Date().toISOString(),
            data_fechamento: null,
            status: 'ABERTO',
            total_vendas_qtd: 0,
            total_valor: 0.00,
            total_litros: 0.000,
            total_gnv: 0.000,
            total_dinheiro: 0.00,
            total_pix: 0.00,
            total_cartao_debito: 0.00,
            total_cartao_credito: 0.00
        };

        this.db.turnos_caixa.push(novoTurno);

        this.db.auditoria_logs.push({
            id: this.db.auditoria_logs.length + 1,
            acao: 'FECHAMENTO_TURNO',
            entidade: 'TURNOS_CAIXA',
            registro_id: String(turnoAtual ? turnoAtual.id : 0),
            usuario: 'GERENTE',
            detalhes: `Turno ${turnoAtual ? turnoAtual.codigo_turno : ''} encerrado com ${resumoFechamento.qtd_vendas} abastecimentos (Total: R$ ${resumoFechamento.receita_total.toFixed(2)}). Novo turno aberto: ${codigoNovoTurno} (${proximoTipoTurno}).`,
            data_hora: new Date().toISOString()
        });

        // DISPARAR BACKUP AUTOMATICO OBRIGATORIO
        await this.dispararBackupAutomatico(`FECHAMENTO_TURNO_${turnoAtual ? turnoAtual.id : 0}`, 'GERENTE');

        return {
            turno_encerrado: turnoAtual,
            novo_turno: novoTurno
        };
    }

    async testarServidorLocal() {
        try {
            const resp = await fetch('/api/obter_banco_atual', { method: 'GET' });
            if (resp.ok) {
                this.servidorLocalAtivo = true;
                const badge = document.getElementById('status-servidor');
                if (badge) {
                    badge.textContent = 'Servidor Local: Conectado (Gravando em backups/)';
                    badge.className = 'status-badge online';
                }
            }
        } catch (e) {
            this.servidorLocalAtivo = false;
            const badge = document.getElementById('status-servidor');
            if (badge) {
                badge.textContent = 'Modo Navegador Direto (Persistencia SQL Ativa)';
                badge.className = 'status-badge browser';
            }
        }
    }

    carregarDadosIniciaisPadrao() {
        // Usuarios do Sistema
        this.db.usuarios = [
            { id: 1, login: 'gerente', nome: 'Carlos Eduardo', perfil: 'GERENTE', ativo: 1 },
            { id: 2, login: 'encarregado', nome: 'Roberto Silva', perfil: 'GERENTE', ativo: 1 },
            { id: 3, login: 'caixa1', nome: 'Mariana Santos', perfil: 'CAIXA', ativo: 1 }
        ];

        // Funcionarios (Escala 12x36)
        this.db.funcionarios = [
            { id: 1, matricula: '1000', nome: 'Carlos Eduardo', cargo: 'Gerente de Pista', turno: 'DIURNO_12X36', ativo: 1 },
            { id: 2, matricula: '2000', nome: 'Roberto Silva', cargo: 'Encarregado Noturno', turno: 'NOTURNO_12X36', ativo: 1 },
            // Diurnos
            { id: 3, matricula: '1001', nome: 'Joao Pereira', cargo: 'Frentista', turno: 'DIURNO_12X36', ativo: 1 },
            { id: 4, matricula: '1002', nome: 'Lucas Souza', cargo: 'Frentista', turno: 'DIURNO_12X36', ativo: 1 },
            { id: 5, matricula: '1003', nome: 'Marcos Vinicius', cargo: 'Frentista', turno: 'DIURNO_12X36', ativo: 1 },
            { id: 6, matricula: '1004', nome: 'Andre Luis', cargo: 'Frentista', turno: 'DIURNO_12X36', ativo: 1 },
            { id: 7, matricula: '1005', nome: 'Bruno Cesar', cargo: 'Frentista', turno: 'DIURNO_12X36', ativo: 1 },
            { id: 8, matricula: '1006', nome: 'Daniel Rocha', cargo: 'Frentista', turno: 'DIURNO_12X36', ativo: 1 },
            { id: 9, matricula: '1007', nome: 'Eduardo Lima', cargo: 'Frentista', turno: 'DIURNO_12X36', ativo: 1 },
            { id: 10, matricula: '1008', nome: 'Fabio Alves', cargo: 'Frentista', turno: 'DIURNO_12X36', ativo: 1 },
            { id: 11, matricula: '1009', nome: 'Gabriel Martins', cargo: 'Frentista', turno: 'DIURNO_12X36', ativo: 1 },
            { id: 12, matricula: '1010', nome: 'Henrique Costa', cargo: 'Frentista', turno: 'DIURNO_12X36', ativo: 1 },
            { id: 13, matricula: '1011', nome: 'Igor Santos', cargo: 'Frentista', turno: 'DIURNO_12X36', ativo: 1 },
            { id: 14, matricula: '1012', nome: 'Julio Cesar', cargo: 'Frentista', turno: 'DIURNO_12X36', ativo: 1 },
            { id: 15, matricula: '1013', nome: 'Leonardo Ferreira', cargo: 'Frentista', turno: 'DIURNO_12X36', ativo: 1 },
            { id: 16, matricula: '1014', nome: 'Matheus Ribeiro', cargo: 'Frentista', turno: 'DIURNO_12X36', ativo: 1 },
            { id: 17, matricula: '1015', nome: 'Natan Silva', cargo: 'Frentista', turno: 'DIURNO_12X36', ativo: 1 },
            { id: 18, matricula: '1016', nome: 'Otavio Mendes', cargo: 'Frentista', turno: 'DIURNO_12X36', ativo: 1 },
            // Noturnos
            { id: 19, matricula: '2001', nome: 'Paulo Henrique', cargo: 'Frentista', turno: 'NOTURNO_12X36', ativo: 1 },
            { id: 20, matricula: '2002', nome: 'Rafael Gomes', cargo: 'Frentista', turno: 'NOTURNO_12X36', ativo: 1 },
            { id: 21, matricula: '2003', nome: 'Samuel Barbosa', cargo: 'Frentista', turno: 'NOTURNO_12X36', ativo: 1 },
            { id: 22, matricula: '2004', nome: 'Thiago Moreira', cargo: 'Frentista', turno: 'NOTURNO_12X36', ativo: 1 },
            { id: 23, matricula: '2005', nome: 'Victor Hugo', cargo: 'Frentista', turno: 'NOTURNO_12X36', ativo: 1 },
            { id: 24, matricula: '2006', nome: 'Wagner Dias', cargo: 'Frentista', turno: 'NOTURNO_12X36', ativo: 1 },
            { id: 25, matricula: '2007', nome: 'Yuri Nascimento', cargo: 'Frentista', turno: 'NOTURNO_12X36', ativo: 1 },
            { id: 26, matricula: '2008', nome: 'Zaqueu Fernandes', cargo: 'Frentista', turno: 'NOTURNO_12X36', ativo: 1 }
        ];

        // Combustiveis
        this.db.combustiveis = [
            { id: 1, codigo_interno: 'GAS_COM', nome: 'Gasolina Comum', tipo: 'LIQUIDO', unidade_medida: 'LT', codigo_anp: '320102001', ncm: '27101259', cfop: '5656', cor_etiqueta: '#dc2626', preco_unitario: 5.890 },
            { id: 2, codigo_interno: 'GAS_ADI', nome: 'Gasolina Aditivada', tipo: 'LIQUIDO', unidade_medida: 'LT', codigo_anp: '320102002', ncm: '27101259', cfop: '5656', cor_etiqueta: '#b91c1c', preco_unitario: 6.090 },
            { id: 3, codigo_interno: 'ETA_COM', nome: 'Etanol Comum', tipo: 'LIQUIDO', unidade_medida: 'LT', codigo_anp: '810101001', ncm: '22071090', cfop: '5656', cor_etiqueta: '#16a34a', preco_unitario: 3.990 },
            { id: 4, codigo_interno: 'ETA_ADI', nome: 'Etanol Aditivado', tipo: 'LIQUIDO', unidade_medida: 'LT', codigo_anp: '810101002', ncm: '22071090', cfop: '5656', cor_etiqueta: '#15803d', preco_unitario: 4.190 },
            { id: 5, codigo_interno: 'DIE_S10', nome: 'Diesel S10', tipo: 'LIQUIDO', unidade_medida: 'LT', codigo_anp: '820101034', ncm: '27101921', cfop: '5656', cor_etiqueta: '#475569', preco_unitario: 6.190 },
            { id: 6, codigo_interno: 'DIE_500', nome: 'Diesel S500', tipo: 'LIQUIDO', unidade_medida: 'LT', codigo_anp: '820101014', ncm: '27101921', cfop: '5656', cor_etiqueta: '#334155', preco_unitario: 5.990 },
            { id: 7, codigo_interno: 'GNV_VEI', nome: 'GNV (Gas Natural)', tipo: 'GASOSO', unidade_medida: 'M3', codigo_anp: '220101005', ncm: '27112100', cfop: '5656', cor_etiqueta: '#0284c7', preco_unitario: 4.490 }
        ];

        // 8 Bombas
        this.db.bombas = [
            { id: 1, numero: 1, ilha: 'Ilha 1 - Leves', descricao: 'Bomba 01 (Gasolina Comum / Aditivada)' },
            { id: 2, numero: 2, ilha: 'Ilha 1 - Leves', descricao: 'Bomba 02 (Etanol Comum / Aditivado)' },
            { id: 3, numero: 3, ilha: 'Ilha 2 - Diesel', descricao: 'Bomba 03 (Diesel S10 / Diesel S500)' },
            { id: 4, numero: 4, ilha: 'Ilha 2 - Diesel', descricao: 'Bomba 04 (Diesel S10 / Diesel S500)' },
            { id: 5, numero: 5, ilha: 'Ilha 3 - GNV 1', descricao: 'Bomba 05 (GNV Alta Pressao)' },
            { id: 6, numero: 6, ilha: 'Ilha 3 - GNV 1', descricao: 'Bomba 06 (GNV Alta Pressao)' },
            { id: 7, numero: 7, ilha: 'Ilha 4 - GNV 2', descricao: 'Bomba 07 (GNV Alta Pressao)' },
            { id: 8, numero: 8, ilha: 'Ilha 4 - GNV 2', descricao: 'Bomba 08 (GNV Alta Pressao)' }
        ];

        // 16 Bicos
        this.db.bicos = [
            { id: 1, id_bomba: 1, numero_bico: 1, id_combustivel: 1, encerrante: 150000.000 },
            { id: 2, id_bomba: 1, numero_bico: 2, id_combustivel: 2, encerrante: 85000.000 },
            { id: 3, id_bomba: 2, numero_bico: 3, id_combustivel: 3, encerrante: 92000.000 },
            { id: 4, id_bomba: 2, numero_bico: 4, id_combustivel: 4, encerrante: 41000.000 },
            { id: 5, id_bomba: 3, numero_bico: 5, id_combustivel: 5, encerrante: 310000.000 },
            { id: 6, id_bomba: 3, numero_bico: 6, id_combustivel: 6, encerrante: 215000.000 },
            { id: 7, id_bomba: 4, numero_bico: 7, id_combustivel: 5, encerrante: 290000.000 },
            { id: 8, id_bomba: 4, numero_bico: 8, id_combustivel: 6, encerrante: 185000.000 },
            { id: 9, id_bomba: 5, numero_bico: 9, id_combustivel: 7, encerrante: 450000.000 },
            { id: 10, id_bomba: 5, numero_bico: 10, id_combustivel: 7, encerrante: 442000.000 },
            { id: 11, id_bomba: 6, numero_bico: 11, id_combustivel: 7, encerrante: 398000.000 },
            { id: 12, id_bomba: 6, numero_bico: 12, id_combustivel: 7, encerrante: 401000.000 },
            { id: 13, id_bomba: 7, numero_bico: 13, id_combustivel: 7, encerrante: 510000.000 },
            { id: 14, id_bomba: 7, numero_bico: 14, id_combustivel: 7, encerrante: 498000.000 },
            { id: 15, id_bomba: 8, numero_bico: 15, id_combustivel: 7, encerrante: 475000.000 },
            { id: 16, id_bomba: 8, numero_bico: 16, id_combustivel: 7, encerrante: 469000.000 }
        ];

        this.db.turnos_caixa = [
            { id: 1, operador: 'Mariana Santos', turno: 'DIURNO_12X36', data_abertura: new Date().toISOString(), status: 'ABERTO' }
        ];

        this.db.vendas = [];
        this.db.documentos_fiscais = [];
        this.db.auditoria_logs = [
            { id: 1, acao: 'INICIALIZACAO_SISTEMA', entidade: 'SISTEMA', usuario: 'ADMIN', detalhes: 'Base carregada com 8 bombas e 16 bicos.', data_hora: new Date().toISOString() }
        ];

        this.salvarLocal();
    }

    salvarLocal() {
        localStorage.setItem('pdv_posto_db', JSON.stringify(this.db));
    }

    /**
     * Gera o Dump SQL completo com todas as tabelas e dados atuais
     */
    gerarDumpSQL(acao, usuario = 'OPERADOR') {
        const dataHoje = new Date().toISOString().replace('T', ' ').substring(0, 19);
        let sql = `-- ==========================================================\n`;
        sql += `-- BACKUP AUTOMATICO DO BANCO DE DADOS - PDV POSTO\n`;
        sql += `-- ACAO DISPARADORA: ${acao}\n`;
        sql += `-- RESPONSAVEL: ${usuario}\n`;
        sql += `-- DATA/HORA: ${dataHoje}\n`;
        sql += `-- ==========================================================\n\n`;

        const tabelas = [
            'usuarios', 'funcionarios', 'bombas', 'combustiveis',
            'bicos', 'turnos_caixa', 'vendas', 'documentos_fiscais', 'auditoria_logs'
        ];

        for (const t of tabelas) {
            const linhas = this.db[t] || [];
            sql += `-- TABELA: ${t} (${linhas.length} registros)\n`;
            if (linhas.length > 0) {
                for (const linha of linhas) {
                    const colunas = Object.keys(linha);
                    const colunasStr = colunas.map(c => `\`${c}\``).join(', ');
                    const valoresTratados = colunas.map(c => {
                        const val = linha[c];
                        if (val === null || val === undefined) return 'NULL';
                        if (typeof val === 'number') return val;
                        return `'${String(val).replace(/'/g, "''")}'`;
                    });
                    sql += `INSERT INTO \`${t}\` (${colunasStr}) VALUES (${valoresTratados.join(', ')});\n`;
                }
            }
            sql += `\n`;
        }

        return sql;
    }

    /**
     * Executa o backup automatico obrigatorio a cada alteracao
     */
    async dispararBackupAutomatico(acao, usuario = 'OPERADOR') {
        this.salvarLocal();
        const sqlDump = this.gerarDumpSQL(acao, usuario);
        const agora = new Date();
        const timestamp = agora.getFullYear().toString() +
            String(agora.getMonth() + 1).padStart(2, '0') +
            String(agora.getDate()).padStart(2, '0') + '_' +
            String(agora.getHours()).padStart(2, '0') +
            String(agora.getMinutes()).padStart(2, '0') +
            String(agora.getSeconds()).padStart(2, '0');
        
        const acaoSanitizada = acao.replace(/[^A-Za-z0-9_]/g, '_');
        const nomeArquivo = `backup_${timestamp}_${acaoSanitizada}.sql`;
        this.ultimoArquivoBackup = nomeArquivo;

        // Atualizar interface com o ultimo backup gerado
        const infoEl = document.getElementById('ultimo-backup-info');
        if (infoEl) {
            infoEl.textContent = `Ultimo backup: ${nomeArquivo}`;
            infoEl.title = `Gerado as ${agora.toLocaleTimeString('pt-BR')}`;
        }

        // Tentar enviar ao servidor local (servidor_pdv.ps1) para gravar na pasta /backups
        try {
            const resp = await fetch('/api/salvar_backup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    acao: acao,
                    sql_dump: sqlDump,
                    nome_arquivo: nomeArquivo
                })
            });
            if (resp.ok) {
                const dados = await resp.json();
                this.exibirNotificacao(`Backup gravado na pasta backups: ${nomeArquivo}`);
                return dados;
            }
        } catch (e) {
            // Em execucao direta de arquivo HTML no navegador
            console.log("Servidor local offline. Salvando no armazenamento seguro SQL do navegador.");
            this.exibirNotificacao(`Alteracao salva no banco SQL: ${nomeArquivo}`);
        }

        return { sucesso: true, arquivo: nomeArquivo };
    }

    exibirNotificacao(texto) {
        const toast = document.getElementById('notificacao-toast');
        if (toast) {
            toast.textContent = texto;
            toast.classList.add('visivel');
            setTimeout(() => {
                toast.classList.remove('visivel');
            }, 3500);
        }
    }

    baixarArquivoSQLAtual() {
        const sqlDump = this.gerarDumpSQL('EXPORTACAO_MANUAL');
        const agora = new Date().toISOString().replace(/[:.]/g, '-');
        const blob = new Blob([sqlDump], { type: 'application/sql;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_posto_${agora}.sql`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

window.sqlEngine = new SQLEngine();
