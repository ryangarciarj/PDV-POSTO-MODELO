/**
 * CONTROLADOR PRINCIPAL DA APLICACAO - PDV POSTO DE COMBUSTIVEIS
 * Coordena interface touch, regras de negocio, autorizacao fiscal e backups.
 */

class AppPDV {
    constructor() {
        this.bicoSelecionado = null;
        this.frentistaSelecionado = null;
        this.formaPagamento = 'DINHEIRO';
        this.turnoAtualObj = null;
        this.filtroRelatorioTurno = 'TURNO_ATUAL';
        this.totalCalculado = 0.00;
        this.trocoCalculado = 0.00;
        this.vendaPendente = null;

        document.addEventListener('DOMContentLoaded', () => this.inicializar());
    }

    inicializar() {
        this.carregarTurnoAtual();
        this.renderizarBombasEBicos();
        this.carregarFrentistasPorTurno(this.turnoAtualObj ? this.turnoAtualObj.turno : 'DIURNO_12X36');
        this.carregarTabelaPrecos();
        this.carregarRelatorios();
        this.carregarListaBackups();
    }

    carregarTurnoAtual() {
        this.turnoAtualObj = sqlEngine.obterTurnoAtivo();
        if (!this.turnoAtualObj) {
            this.turnoAtualObj = {
                id: 1,
                codigo_turno: 'TRN-001',
                turno: 'DIURNO_12X36',
                responsavel_pista: 'Carlos Eduardo',
                operador: 'Mariana Santos',
                data_abertura: new Date().toISOString(),
                status: 'ABERTO'
            };
        }
        this.atualizarBadgeTurno();
    }

    atualizarBadgeTurno() {
        const badge = document.getElementById('badge-turno-ativo');
        if (badge && this.turnoAtualObj) {
            const nomeTurno = this.turnoAtualObj.turno === 'NOTURNO_12X36' ? 'Noturno' : 'Diurno';
            badge.textContent = `Turno: ${this.turnoAtualObj.codigo_turno} (${nomeTurno}) - ${this.turnoAtualObj.responsavel_pista}`;
        }
    }

    navegarAba(abaId) {
        document.querySelectorAll('.nav-tab-btn').forEach(btn => btn.classList.remove('ativo'));
        document.querySelectorAll('.tab-painel').forEach(p => p.classList.remove('ativo'));

        const painel = document.getElementById(`painel-${abaId}`);
        if (painel) painel.classList.add('ativo');

        const btnAtivo = Array.from(document.querySelectorAll('.nav-tab-btn')).find(b => b.getAttribute('onclick')?.includes(abaId));
        if (btnAtivo) btnAtivo.classList.add('ativo');

        if (abaId === 'relatorios') this.carregarRelatorios();
        if (abaId === 'precos') this.carregarTabelaPrecos();
        if (abaId === 'backups') this.carregarListaBackups();
    }

    atualizarTurnoAtivo(turno) {
        this.turnoAtivo = turno;
        this.carregarFrentistasPorTurno(turno);
    }

    carregarFrentistasPorTurno(turno) {
        const select = document.getElementById('select-frentista');
        if (!select) return;

        select.innerHTML = '<option value="">Selecione o frentista...</option>';
        const equipe = sqlEngine.db.funcionarios.filter(f => f.turno === turno && f.ativo === 1);

        for (const f of equipe) {
            const opt = document.createElement('option');
            opt.value = f.matricula;
            opt.textContent = `[Mat: ${f.matricula}] ${f.nome} (${f.cargo})`;
            select.appendChild(opt);
        }

        // Se houver frentistas, pre-selecionar o primeiro frentista de pista
        if (equipe.length > 0) {
            const primeiro = equipe.find(e => e.cargo.includes('Frentista')) || equipe[0];
            select.value = primeiro.matricula;
            this.selecionarFrentista(primeiro.matricula);
        }
    }

    selecionarFrentista(matricula) {
        const f = sqlEngine.db.funcionarios.find(func => func.matricula === matricula);
        this.frentistaSelecionado = f || null;

        const resumo = document.getElementById('resumo-frentista');
        const info = document.getElementById('frentista-cargo-info');

        if (f) {
            if (resumo) resumo.textContent = `${f.nome} (Mat: ${f.matricula})`;
            if (info) info.textContent = `Turno: ${f.turno.replace('_', ' ')} | Cargo: ${f.cargo}`;
        } else {
            if (resumo) resumo.textContent = '--';
            if (info) info.textContent = '';
        }
    }

    renderizarBombasEBicos() {
        const container = document.getElementById('grade-bombas');
        if (!container) return;

        container.innerHTML = '';
        const bombas = sqlEngine.db.bombas;

        for (const bomba of bombas) {
            const card = document.createElement('div');
            card.className = 'card-bomba';

            const topo = document.createElement('div');
            topo.className = 'bomba-topo';
            topo.innerHTML = `
                <span class="bomba-numero">Bomba ${String(bomba.numero).padStart(2, '0')}</span>
                <span class="bomba-ilha">${bomba.ilha}</span>
            `;
            card.appendChild(topo);

            const bicosContainer = document.createElement('div');
            bicosContainer.className = 'bicos-container';

            const bicosDaBomba = sqlEngine.db.bicos.filter(b => b.id_bomba === bomba.id);
            for (const bico of bicosDaBomba) {
                const comb = sqlEngine.db.combustiveis.find(c => c.id === bico.id_combustivel);
                const precoFormatado = Number(comb.preco_unitario).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'btn-bico';
                btn.id = `btn-bico-${bico.id}`;
                btn.onclick = () => this.selecionarBico(bico.id);

                btn.innerHTML = `
                    <div class="bico-nome-preco">
                        <span class="bico-nome">Bico ${bico.numero_bico}: ${comb.nome}</span>
                        <span class="bico-preco">R$ ${precoFormatado}</span>
                    </div>
                    <span class="bico-detalhe">Unidade: ${comb.unidade_medida} | Encerrante: ${Number(bico.encerrante).toFixed(3)}</span>
                `;
                bicosContainer.appendChild(btn);
            }

            card.appendChild(bicosContainer);
            container.appendChild(card);
        }

        // Selecionar o primeiro bico por padrao
        if (sqlEngine.db.bicos.length > 0) {
            this.selecionarBico(sqlEngine.db.bicos[0].id);
        }
    }

    selecionarBico(idBico) {
        document.querySelectorAll('.btn-bico').forEach(b => b.classList.remove('selecionado'));
        const btn = document.getElementById(`btn-bico-${idBico}`);
        if (btn) btn.classList.add('selecionado');

        const bico = sqlEngine.db.bicos.find(b => b.id === idBico);
        if (!bico) return;

        const comb = sqlEngine.db.combustiveis.find(c => c.id === bico.id_combustivel);
        const bomba = sqlEngine.db.bombas.find(bm => bm.id === bico.id_bomba);

        this.bicoSelecionado = {
            id: bico.id,
            id_bomba: bomba.id,
            numero_bomba: bomba.numero,
            numero_bico: bico.numero_bico,
            combustivel: comb,
            encerrante: bico.encerrante
        };

        // Atualizar interface
        document.getElementById('resumo-bomba-bico').textContent = `Bomba ${String(bomba.numero).padStart(2, '0')} (Bico ${bico.numero_bico})`;
        document.getElementById('resumo-combustivel').textContent = `${comb.nome} (${comb.tipo})`;
        document.getElementById('resumo-preco-unitario').textContent = `R$ ${Number(comb.preco_unitario).toFixed(3)} / ${comb.unidade_medida}`;
        document.getElementById('unidade-medida-sufixo').textContent = comb.unidade_medida;

        this.recalcularTotal();
    }

    definirVolumeAtalho(qtd) {
        const input = document.getElementById('volume-input');
        const valorAtual = parseFloat(input.value) || 0;
        input.value = (valorAtual + qtd).toFixed(3);
        this.recalcularTotal();
    }

    definirVolumePorValor(valorReais) {
        if (!this.bicoSelecionado) return;
        const preco = this.bicoSelecionado.combustivel.preco_unitario;
        const volumeCalculado = valorReais / preco;
        const input = document.getElementById('volume-input');
        input.value = volumeCalculado.toFixed(3);
        this.recalcularTotal();
    }

    recalcularTotal() {
        if (!this.bicoSelecionado) return;

        const inputVolume = document.getElementById('volume-input');
        const volume = parseFloat(inputVolume.value) || 0.00;
        const preco = this.bicoSelecionado.combustivel.preco_unitario;

        this.totalCalculado = Math.round((volume * preco) * 100) / 100;

        document.getElementById('display-valor-total').textContent = `R$ ${this.totalCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        document.getElementById('resumo-volume').textContent = `${volume.toFixed(3)} ${this.bicoSelecionado.combustivel.unidade_medida}`;

        this.calcularTroco();
    }

    definirFormaPagamento(forma) {
        this.formaPagamento = forma;
        document.querySelectorAll('.btn-pagamento').forEach(btn => {
            btn.classList.toggle('selecionado', btn.textContent.includes(forma));
        });

        const painelTroco = document.getElementById('painel-troco');
        if (forma === 'DINHEIRO') {
            painelTroco.classList.add('visivel');
        } else {
            painelTroco.classList.remove('visivel');
        }
    }

    calcularTroco() {
        if (this.formaPagamento !== 'DINHEIRO') {
            this.trocoCalculado = 0.00;
            return;
        }

        const inputRecebido = document.getElementById('valor-recebido-input');
        const recebido = parseFloat(inputRecebido.value) || 0.00;

        if (recebido >= this.totalCalculado && this.totalCalculado > 0) {
            this.trocoCalculado = Math.round((recebido - this.totalCalculado) * 100) / 100;
        } else {
            this.trocoCalculado = 0.00;
        }

        document.getElementById('valor-troco-display').textContent = `R$ ${this.trocoCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    processarFinalizacaoVenda() {
        const inputVolume = document.getElementById('volume-input');
        const volume = parseFloat(inputVolume.value) || 0.00;

        if (!this.bicoSelecionado) {
            alert("Selecione uma bomba e um bico de abastecimento.");
            return;
        }

        if (volume <= 0) {
            alert("Informe o volume abastecido (deve ser maior que zero).");
            return;
        }

        if (!this.frentistaSelecionado) {
            alert("Selecione o frentista responsavel pelo abastecimento.");
            return;
        }

        if (this.formaPagamento === 'DINHEIRO') {
            const inputRecebido = document.getElementById('valor-recebido-input');
            const recebido = parseFloat(inputRecebido.value) || 0.00;
            if (recebido < this.totalCalculado) {
                alert(`Valor entregue em dinheiro (R$ ${recebido.toFixed(2)}) e insuficiente para cobrir o total (R$ ${this.totalCalculado.toFixed(2)}).`);
                return;
            }
        }

        if (this.formaPagamento === 'PIX') {
            this.abrirModalPix();
            return;
        }

        // Se for cartao ou dinheiro ja validado
        this.concluirTransacaoVenda();
    }

    abrirModalPix() {
        const modal = document.getElementById('modal-pix');
        document.getElementById('modal-pix-valor').textContent = `R$ ${this.totalCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        
        // Gerador de Pix Estatico/Dinamico ficticio para testes
        const chavePixPosto = 'financeiro@autopostocidade.com.br';
        const payloadPix = `00020126580014BR.GOV.BCB.PIX0136${chavePixPosto}520400005303986540${this.totalCalculado.toFixed(2)}5802BR5925AUTO POSTO CIDADE MODELO6009SAO PAULO62070503***6304ABCD`;

        document.getElementById('pix-copia-cola').value = payloadPix;
        new QRCode(document.getElementById('qrcode-pix-area'), {
            text: payloadPix,
            width: 180,
            height: 180
        });

        modal.classList.add('visivel');
    }

    fecharModalPix() {
        document.getElementById('modal-pix').classList.remove('visivel');
    }

    confirmarPagamentoPix() {
        this.fecharModalPix();
        this.concluirTransacaoVenda();
    }

    async concluirTransacaoVenda() {
        const inputVolume = document.getElementById('volume-input');
        const volume = parseFloat(inputVolume.value);
        const inputCpf = document.getElementById('cpf-cnpj-input');
        const cpfCnpj = inputCpf.value.trim() || null;
        const inputRecebido = document.getElementById('valor-recebido-input');
        const valorRecebido = this.formaPagamento === 'DINHEIRO' ? (parseFloat(inputRecebido.value) || this.totalCalculado) : this.totalCalculado;

        const vendaId = (sqlEngine.db.vendas.length > 0 ? Math.max(...sqlEngine.db.vendas.map(v => v.id)) : 0) + 1;
        const codigoVenda = `VD-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}${String(new Date().getDate()).padStart(2,'0')}-${String(vendaId).padStart(5,'0')}`;

        const novaVenda = {
            id: vendaId,
            codigo_venda: codigoVenda,
            id_turno: this.turnoAtualObj ? this.turnoAtualObj.id : 1,
            codigo_turno: this.turnoAtualObj ? this.turnoAtualObj.codigo_turno : 'TRN-001',
            id_bomba: this.bicoSelecionado.id_bomba,
            numero_bomba: this.bicoSelecionado.numero_bomba,
            id_bico: this.bicoSelecionado.id,
            numero_bico: this.bicoSelecionado.numero_bico,
            id_combustivel: this.bicoSelecionado.combustivel.id,
            nome_combustivel: this.bicoSelecionado.combustivel.nome,
            unidade_medida: this.bicoSelecionado.combustivel.unidade_medida,
            id_frentista: this.frentistaSelecionado.id,
            nome_frentista: this.frentistaSelecionado.nome,
            matricula_frentista: this.frentistaSelecionado.matricula,
            volume: volume,
            preco_unitario: this.bicoSelecionado.combustivel.preco_unitario,
            valor_total: this.totalCalculado,
            forma_pagamento: this.formaPagamento,
            valor_recebido: valorRecebido,
            valor_troco: this.trocoCalculado,
            cpf_cnpj_cliente: cpfCnpj,
            status: 'CONCLUIDA',
            criado_em: new Date().toISOString()
        };

        // Atualizar Encerrante do Bico
        const bicoDb = sqlEngine.db.bicos.find(b => b.id === this.bicoSelecionado.id);
        if (bicoDb) {
            bicoDb.encerrante = Math.round((bicoDb.encerrante + volume) * 1000) / 1000;
        }

        // Emitir NFC-e
        const nfce = nfceEngine.emitirNFCe(novaVenda, this.bicoSelecionado.combustivel, this.bicoSelecionado);

        const docFiscal = {
            id: vendaId,
            id_venda: vendaId,
            numero_nfc: nfce.numero_nfc,
            chave_acesso: nfce.chave_acesso,
            protocolo_autorizacao: nfce.protocolo,
            url_qrcode: nfce.url_qrcode,
            status: 'AUTORIZADA',
            emitido_em: nfce.data_emissao
        };

        // Salvar na base relacional em memoria
        sqlEngine.db.vendas.unshift(novaVenda);
        sqlEngine.db.documentos_fiscais.unshift(docFiscal);
        sqlEngine.db.auditoria_logs.push({
            id: sqlEngine.db.auditoria_logs.length + 1,
            acao: 'VENDA_CONCLUIDA',
            entidade: 'VENDAS',
            registro_id: String(vendaId),
            usuario: this.frentistaSelecionado.nome,
            detalhes: `Venda ${codigoVenda} no valor de R$ ${this.totalCalculado.toFixed(2)} (${this.formaPagamento})`,
            data_hora: new Date().toISOString()
        });

        // DISPARAR BACKUP AUTOMATICO OBRIGATORIO EM SQL
        await sqlEngine.dispararBackupAutomatico(`VENDA_${vendaId}`, this.frentistaSelecionado.nome);

        // Renderizar e Exibir Cupom Fiscal DANFE
        const cupomHtml = nfceEngine.renderizarCupomDANFE(novaVenda, this.bicoSelecionado.combustivel, this.bicoSelecionado, nfce);
        document.getElementById('cupom-danfe-container').innerHTML = cupomHtml;

        new QRCode(document.getElementById('qrcode-danfe-area'), {
            text: nfce.url_qrcode,
            width: 110,
            height: 110
        });

        document.getElementById('modal-nfce').classList.add('visivel');

        // Limpar campos de entrada
        inputVolume.value = '';
        if (inputRecebido) inputRecebido.value = '';
        inputCpf.value = '';
        this.recalcularTotal();
        this.renderizarBombasEBicos();
    }

    fecharModalNfce() {
        document.getElementById('modal-nfce').classList.remove('visivel');
    }

    // RELATORIOS E CANCELAMENTO GERENCIAL
    carregarRelatorios() {
        this.atualizarSeletorFiltroTurnos();

        let vendas = sqlEngine.db.vendas;
        let etiquetaFiltro = "Turno Atual em Andamento";

        if (this.filtroRelatorioTurno === 'TURNO_ATUAL' && this.turnoAtualObj) {
            vendas = vendas.filter(v => v.id_turno === this.turnoAtualObj.id);
            etiquetaFiltro = `Turno Atual (${this.turnoAtualObj.codigo_turno})`;
        } else if (this.filtroRelatorioTurno === 'TODOS') {
            etiquetaFiltro = "Todos os Turnos (Historico Geral)";
        } else {
            const turnoIdFiltro = parseInt(this.filtroRelatorioTurno, 10);
            vendas = vendas.filter(v => v.id_turno === turnoIdFiltro);
            const turnoEncontrado = sqlEngine.db.turnos_caixa.find(t => t.id === turnoIdFiltro);
            etiquetaFiltro = turnoEncontrado ? `Turno ${turnoEncontrado.codigo_turno} (${turnoEncontrado.status})` : `Turno ${turnoIdFiltro}`;
        }

        const infoFiltro = document.getElementById('info-filtro-turno');
        if (infoFiltro) infoFiltro.textContent = `Exibindo: ${etiquetaFiltro}`;

        const totalVendas = vendas.filter(v => v.status === 'CONCLUIDA');

        const receitaTotal = totalVendas.reduce((acc, v) => acc + v.valor_total, 0);
        const totalLitros = totalVendas.filter(v => v.unidade_medida === 'LT').reduce((acc, v) => acc + v.volume, 0);
        const totalGnv = totalVendas.filter(v => v.unidade_medida === 'M3').reduce((acc, v) => acc + v.volume, 0);
        const totalDinheiro = totalVendas.filter(v => v.forma_pagamento === 'DINHEIRO').reduce((acc, v) => acc + v.valor_total, 0);

        document.getElementById('total-qtd-vendas').textContent = totalVendas.length;
        document.getElementById('total-receita').textContent = `R$ ${receitaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        document.getElementById('total-litros-liquido').textContent = `${totalLitros.toFixed(3)} L`;
        document.getElementById('total-volume-gnv').textContent = `${totalGnv.toFixed(3)} M3`;
        document.getElementById('total-recebido-dinheiro').textContent = `R$ ${totalDinheiro.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        const tbody = document.getElementById('tabela-vendas-corpo');
        if (!tbody) return;

        tbody.innerHTML = '';
        if (vendas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; color: var(--text-muted); padding: 24px;">Nenhum abastecimento registrado para ${etiquetaFiltro}.</td></tr>`;
            return;
        }

        for (const v of vendas) {
            const dataFmt = new Date(v.criado_em).toLocaleString('pt-BR');
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${v.codigo_venda}</strong></td>
                <td>${dataFmt}</td>
                <td>Bomba ${String(v.numero_bomba).padStart(2, '0')} (Bico ${v.numero_bico})</td>
                <td>${v.nome_combustivel}</td>
                <td>${Number(v.volume).toFixed(3)} ${v.unidade_medida}</td>
                <td>R$ ${Number(v.preco_unitario).toFixed(3)}</td>
                <td><strong>R$ ${Number(v.valor_total).toFixed(2)}</strong></td>
                <td>${v.forma_pagamento}</td>
                <td>${v.nome_frentista}</td>
                <td><span style="color: ${v.status === 'CONCLUIDA' ? '#34d399' : '#f87171'}; font-weight: 700;">${v.status}</span></td>
                <td>
                    ${v.status === 'CONCLUIDA' ? `
                        <button class="btn-acao-cancelar" onclick="app.abrirModalCancelamento(${v.id})">Cancelar</button>
                    ` : '<span style="color: var(--text-muted); font-size: 0.75rem;">Cancelada</span>'}
                </td>
            `;
            tbody.appendChild(tr);
        }
    }

    atualizarSeletorFiltroTurnos() {
        const select = document.getElementById('select-filtro-turno-relatorio');
        if (!select) return;

        const valorAtual = select.value || 'TURNO_ATUAL';
        select.innerHTML = '';

        const optAtual = document.createElement('option');
        optAtual.value = 'TURNO_ATUAL';
        optAtual.textContent = `Turno Atual (${this.turnoAtualObj ? this.turnoAtualObj.codigo_turno : 'TRN-001'}) [Em andamento]`;
        select.appendChild(optAtual);

        const turnosEncerrados = sqlEngine.db.turnos_caixa.filter(t => t.status === 'FECHADO').slice().reverse();
        for (const t of turnosEncerrados) {
            const opt = document.createElement('option');
            opt.value = String(t.id);
            const dtFechamento = t.data_fechamento ? new Date(t.data_fechamento).toLocaleDateString('pt-BR') : '';
            opt.textContent = `${t.codigo_turno} - ${t.turno.replace('_', ' ')} (${dtFechamento} - Encerrado)`;
            select.appendChild(opt);
        }

        const optTodos = document.createElement('option');
        optTodos.value = 'TODOS';
        optTodos.textContent = 'Todos os Turnos (Historico Consolidado)';
        select.appendChild(optTodos);

        select.value = valorAtual;
    }

    alterarFiltroTurnoRelatorio(valor) {
        this.filtroRelatorioTurno = valor;
        this.carregarRelatorios();
    }

    // MODAL DE TROCA DE TURNO
    abrirModalTrocaTurno() {
        this.carregarTurnoAtual();
        const modal = document.getElementById('modal-troca-turno');
        if (!modal) return;

        const vendasTurno = sqlEngine.db.vendas.filter(v => v.id_turno === this.turnoAtualObj.id && v.status === 'CONCLUIDA');
        const qtdVendas = vendasTurno.length;
        const receitaTotal = vendasTurno.reduce((acc, v) => acc + v.valor_total, 0);
        const totalLitros = vendasTurno.filter(v => v.unidade_medida === 'LT').reduce((acc, v) => acc + v.volume, 0);
        const totalGnv = vendasTurno.filter(v => v.unidade_medida === 'M3').reduce((acc, v) => acc + v.volume, 0);
        const totalDinheiro = vendasTurno.filter(v => v.forma_pagamento === 'DINHEIRO').reduce((acc, v) => acc + v.valor_total, 0);
        const totalPix = vendasTurno.filter(v => v.forma_pagamento === 'PIX').reduce((acc, v) => acc + v.valor_total, 0);
        const totalDebito = vendasTurno.filter(v => v.forma_pagamento === 'CARTAO_DEBITO').reduce((acc, v) => acc + v.valor_total, 0);
        const totalCredito = vendasTurno.filter(v => v.forma_pagamento === 'CARTAO_CREDITO').reduce((acc, v) => acc + v.valor_total, 0);

        this.resumoTurnoParaFechamento = {
            qtd_vendas: qtdVendas,
            receita_total: receitaTotal,
            total_litros: totalLitros,
            total_gnv: totalGnv,
            total_dinheiro: totalDinheiro,
            total_pix: totalPix,
            total_cartao_debito: totalDebito,
            total_cartao_credito: totalCredito
        };

        // Preencher informacoes do turno atual
        document.getElementById('tt-codigo-atual').textContent = this.turnoAtualObj.codigo_turno;
        document.getElementById('tt-tipo-atual').textContent = this.turnoAtualObj.turno.replace('_', ' ');
        document.getElementById('tt-abertura-atual').textContent = new Date(this.turnoAtualObj.data_abertura).toLocaleString('pt-BR');
        document.getElementById('tt-qtd-vendas').textContent = `${qtdVendas} abastecimentos`;
        document.getElementById('tt-receita-total').textContent = `R$ ${receitaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        document.getElementById('tt-litragem-liquido').textContent = `${totalLitros.toFixed(3)} L`;
        document.getElementById('tt-gnv-volume').textContent = `${totalGnv.toFixed(3)} M3`;
        document.getElementById('tt-total-dinheiro').textContent = `R$ ${totalDinheiro.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        document.getElementById('tt-total-pix').textContent = `R$ ${totalPix.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        document.getElementById('tt-total-cartoes').textContent = `R$ ${(totalDebito + totalCredito).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        // Sugerir o proximo turno na escala 12x36
        const selectProximoTurno = document.getElementById('select-proximo-turno-tipo');
        if (this.turnoAtualObj.turno === 'DIURNO_12X36') {
            selectProximoTurno.value = 'NOTURNO_12X36';
            document.getElementById('input-proximo-responsavel').value = 'Roberto Silva (Encarregado Noturno)';
        } else {
            selectProximoTurno.value = 'DIURNO_12X36';
            document.getElementById('input-proximo-responsavel').value = 'Carlos Eduardo (Gerente de Pista)';
        }

        document.getElementById('senha-troca-turno').value = '';
        modal.classList.add('visivel');
    }

    fecharModalTrocaTurno() {
        const modal = document.getElementById('modal-troca-turno');
        if (modal) modal.classList.remove('visivel');
    }

    atualizarSugestaoResponsavel(tipoTurno) {
        const inputResp = document.getElementById('input-proximo-responsavel');
        if (tipoTurno === 'NOTURNO_12X36') {
            inputResp.value = 'Roberto Silva (Encarregado Noturno)';
        } else {
            inputResp.value = 'Carlos Eduardo (Gerente de Pista)';
        }
    }

    async confirmarTrocaTurno() {
        const senha = document.getElementById('senha-troca-turno').value;
        if (senha !== 'admin123') {
            alert("Senha gerencial incorreta para fechamento e troca de turno.");
            return;
        }

        const proximoTipoTurno = document.getElementById('select-proximo-turno-tipo').value;
        const proximoResponsavel = document.getElementById('input-proximo-responsavel').value;
        const proximoOperador = document.getElementById('select-proximo-operador-caixa')?.value || 'Mariana Santos';

        const resultado = await sqlEngine.fecharTurnoECriarNovo(
            this.resumoTurnoParaFechamento,
            proximoTipoTurno,
            proximoResponsavel,
            proximoOperador
        );

        this.fecharModalTrocaTurno();

        // Atualizar estado ativo para o novo turno
        this.turnoAtualObj = resultado.novo_turno;
        this.atualizarBadgeTurno();

        // Carregar equipe do novo turno (ex: 8 frentistas noturnos ou 16 diurnos)
        this.carregarFrentistasPorTurno(proximoTipoTurno);

        // Limpar inputs da tela de vendas
        const inputVolume = document.getElementById('volume-input');
        if (inputVolume) inputVolume.value = '';
        const inputRecebido = document.getElementById('valor-recebido-input');
        if (inputRecebido) inputRecebido.value = '';
        this.recalcularTotal();

        // Atualizar relatorios (o novo turno comecara zerado)
        this.filtroRelatorioTurno = 'TURNO_ATUAL';
        this.carregarRelatorios();

        // Exibir comprovante impresso de fechamento do turno encerrado
        this.exibirComprovanteFechamento(resultado.turno_encerrado, this.resumoTurnoParaFechamento);
    }

    exibirComprovanteFechamento(turnoEncerrado, resumo) {
        const container = document.getElementById('comprovante-turno-container');
        if (!container) return;

        const dataFechamentoFmt = turnoEncerrado.data_fechamento ? new Date(turnoEncerrado.data_fechamento).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');
        const dataAberturaFmt = new Date(turnoEncerrado.data_abertura).toLocaleString('pt-BR');

        let html = `
        <div class="danfe-cupom">
            <div class="danfe-cabecalho">
                <div class="danfe-empresa">AUTO POSTO CIDADE MODELO LTDA</div>
                <div class="danfe-sub">COMPROVANTE DE FECHAMENTO DE TURNO / CAIXA</div>
                <div class="danfe-linha"></div>
                <div class="danfe-titulo">TURNO: ${turnoEncerrado.codigo_turno} (${turnoEncerrado.turno.replace('_', ' ')})</div>
                <div class="danfe-sub">Abertura: ${dataAberturaFmt}</div>
                <div class="danfe-sub">Fechamento: ${dataFechamentoFmt}</div>
                <div class="danfe-sub">Responsavel Pista: ${turnoEncerrado.responsavel_pista}</div>
                <div class="danfe-linha"></div>
            </div>

            <div class="danfe-corpo">
                <div class="danfe-linha-total valor-destaque">
                    <strong>TOTAL FATURADO NO TURNO:</strong>
                    <span>R$ ${resumo.receita_total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div class="danfe-linha-total">
                    <span>QTD. TOTAL ABASTECIMENTOS:</span>
                    <span>${resumo.qtd_vendas}</span>
                </div>
                <div class="danfe-linha-total">
                    <span>VOLUME COMBUSTIVEIS LIQUIDOS:</span>
                    <span>${resumo.total_litros.toFixed(3)} L</span>
                </div>
                <div class="danfe-linha-total">
                    <span>VOLUME GNV FATURADO:</span>
                    <span>${resumo.total_gnv.toFixed(3)} M3</span>
                </div>

                <div class="danfe-linha"></div>
                <div class="danfe-titulo" style="text-align: left; margin-bottom: 4px;">CONCILIACAO POR FORMA DE PAGAMENTO</div>

                <div class="danfe-linha-total">
                    <span>DINHEIRO EM ESPECIE:</span>
                    <span>R$ ${resumo.total_dinheiro.toFixed(2)}</span>
                </div>
                <div class="danfe-linha-total">
                    <span>RECEBIMENTOS PIX:</span>
                    <span>R$ ${resumo.total_pix.toFixed(2)}</span>
                </div>
                <div class="danfe-linha-total">
                    <span>CARTAO DE DEBITO:</span>
                    <span>R$ ${resumo.total_cartao_debito.toFixed(2)}</span>
                </div>
                <div class="danfe-linha-total">
                    <span>CARTAO DE CREDITO:</span>
                    <span>R$ ${resumo.total_cartao_credito.toFixed(2)}</span>
                </div>

                <div class="danfe-linha"></div>
                <div style="margin-top: 24px; text-align: center; font-size: 10px;">
                    <div>________________________________________________</div>
                    <div>Assinatura do Gerente de Pista / Fiscal</div>
                    <div style="margin-top: 16px;">________________________________________________</div>
                    <div>Assinatura do Operador de Caixa</div>
                </div>
            </div>
        </div>
        `;

        container.innerHTML = html;
        document.getElementById('modal-comprovante-turno').classList.add('visivel');
    }

    fecharModalComprovante() {
        const modal = document.getElementById('modal-comprovante-turno');
        if (modal) modal.classList.remove('visivel');
    }

    abrirModalCancelamento(vendaId) {
        document.getElementById('cancelar-venda-id').value = vendaId;
        document.getElementById('senha-gerente-input').value = '';
        document.getElementById('modal-cancelamento').classList.add('visivel');
    }

    fecharModalCancelamento() {
        document.getElementById('modal-cancelamento').classList.remove('visivel');
    }

    async confirmarCancelamentoGerencial() {
        const vendaId = parseInt(document.getElementById('cancelar-venda-id').value, 10);
        const senha = document.getElementById('senha-gerente-input').value;
        const motivo = document.getElementById('motivo-cancelamento-input').value.trim() || 'Cancelamento solicitado pelo cliente';

        // Senha padrao do gerente: admin123
        if (senha !== 'admin123') {
            alert("Senha de autorizacao gerencial incorreta.");
            return;
        }

        const venda = sqlEngine.db.vendas.find(v => v.id === vendaId);
        if (venda) {
            venda.status = 'CANCELADA';
            venda.motivo_cancelamento = motivo;
            venda.cancelado_em = new Date().toISOString();

            sqlEngine.db.auditoria_logs.push({
                id: sqlEngine.db.auditoria_logs.length + 1,
                acao: 'VENDA_CANCELADA',
                entidade: 'VENDAS',
                registro_id: String(vendaId),
                usuario: 'GERENTE',
                detalhes: `Venda ${venda.codigo_venda} cancelada. Motivo: ${motivo}`,
                data_hora: new Date().toISOString()
            });

            // DISPARAR BACKUP AUTOMATICO OBRIGATORIO
            await sqlEngine.dispararBackupAutomatico(`CANCELAMENTO_VENDA_${vendaId}`, 'GERENTE');

            this.fecharModalCancelamento();
            this.carregarRelatorios();
            alert(`Venda ${venda.codigo_venda} cancelada com sucesso.`);
        }
    }

    // TABELA DE PRECOS
    carregarTabelaPrecos() {
        const tbody = document.getElementById('tabela-precos-corpo');
        if (!tbody) return;

        tbody.innerHTML = '';
        for (const comb of sqlEngine.db.combustiveis) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${comb.nome}</strong></td>
                <td>${comb.tipo}</td>
                <td>${comb.unidade_medida}</td>
                <td>${comb.codigo_anp}</td>
                <td>R$ ${Number(comb.preco_unitario).toFixed(3)}</td>
                <td>
                    <input type="number" id="input-preco-${comb.id}" class="campo-input" style="padding: 4px 8px; width: 110px; font-size: 0.9rem;" step="0.001" value="${comb.preco_unitario.toFixed(3)}">
                </td>
                <td>
                    <button class="btn-primario" style="padding: 4px 10px; font-size: 0.75rem;" onclick="app.salvarPrecoCombustivel(${comb.id})">Salvar e Fazer Backup</button>
                </td>
            `;
            tbody.appendChild(tr);
        }
    }

    async salvarPrecoCombustivel(idCombustivel) {
        const input = document.getElementById(`input-preco-${idCombustivel}`);
        const novoPreco = parseFloat(input.value);

        if (isNaN(novoPreco) || novoPreco <= 0) {
            alert("Informe um preco unitario valido.");
            return;
        }

        const comb = sqlEngine.db.combustiveis.find(c => c.id === idCombustivel);
        if (comb) {
            const precoAntigo = comb.preco_unitario;
            comb.preco_unitario = Math.round(novoPreco * 1000) / 1000;

            sqlEngine.db.auditoria_logs.push({
                id: sqlEngine.db.auditoria_logs.length + 1,
                acao: 'ALTERACAO_PRECO',
                entidade: 'COMBUSTIVEIS',
                registro_id: String(idCombustivel),
                usuario: 'GERENTE',
                detalhes: `Preco de ${comb.nome} alterado de R$ ${precoAntigo.toFixed(3)} para R$ ${comb.preco_unitario.toFixed(3)}`,
                data_hora: new Date().toISOString()
            });

            // DISPARAR BACKUP AUTOMATICO OBRIGATORIO
            await sqlEngine.dispararBackupAutomatico(`PRECO_COMB_${idCombustivel}`, 'GERENTE');

            this.carregarTabelaPrecos();
            this.renderizarBombasEBicos();
        }
    }

    // BACKUPS
    async carregarListaBackups() {
        const tbody = document.getElementById('tabela-backups-corpo');
        if (!tbody) return;

        tbody.innerHTML = '';

        // Tentar listar backups do servidor local
        try {
            const resp = await fetch('/api/listar_backups');
            if (resp.ok) {
                const dados = await resp.json();
                if (dados.backups && dados.backups.length > 0) {
                    for (const b of dados.backups) {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td><code>${b.nome}</code></td>
                            <td>${b.data_modificacao}</td>
                            <td>${b.tamanho_kb} KB</td>
                            <td>backups/${b.nome}</td>
                        `;
                        tbody.appendChild(tr);
                    }
                    return;
                }
            }
        } catch (e) {
            // Modo direto sem servidor HTTP local
        }

        // Exibicao de historico de auditoria e backups realizados
        const logsBackup = sqlEngine.db.auditoria_logs.slice().reverse();
        for (const log of logsBackup) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><code>backup_${log.acao}.sql</code></td>
                <td>${new Date(log.data_hora).toLocaleString('pt-BR')}</td>
                <td>--</td>
                <td>${log.detalhes}</td>
            `;
            tbody.appendChild(tr);
        }
    }
}

window.app = new AppPDV();
