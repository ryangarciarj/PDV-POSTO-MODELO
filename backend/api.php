<?php
/**
 * API REST - Backend PDV Posto de Combustiveis
 * Recebe requisicoes do frontend e persiste no banco relacional gerando backup instantaneo.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/conexao.php';
require_once __DIR__ . '/backup_manager.php';
require_once __DIR__ . '/nfce_service.php';

$pdo = Conexao::getConexao();
$backupManager = new BackupManager();
$nfceService = new NFCeService();

$rota = $_GET['rota'] ?? '';
$metodo = $_SERVER['REQUEST_METHOD'];

try {
    // 1. DADOS INICIAIS DO PDV (Bombas, Bicos, Combustiveis, Precos, Funcionarios)
    if ($rota === 'dados_iniciais' && $metodo === 'GET') {
        $bombas = $pdo->query("SELECT * FROM bombas WHERE ativo = 1 ORDER BY numero ASC")->fetchAll();
        $bicos = $pdo->query("SELECT b.*, c.nome as nome_combustivel, c.unidade_medida, c.tipo, tp.preco_unitario, c.cor_etiqueta 
                              FROM bicos b 
                              JOIN combustiveis c ON b.id_combustivel = c.id 
                              JOIN tabela_precos tp ON tp.id_combustivel = c.id 
                              WHERE b.ativo = 1 ORDER BY b.id_bomba, b.numero_bico")->fetchAll();
        $funcionarios = $pdo->query("SELECT * FROM funcionarios WHERE ativo = 1 ORDER BY cargo, nome")->fetchAll();
        $combustiveis = $pdo->query("SELECT c.*, tp.preco_unitario FROM combustiveis c 
                                    JOIN tabela_precos tp ON tp.id_combustivel = c.id 
                                    WHERE c.ativo = 1")->fetchAll();
        
        echo json_encode([
            'sucesso' => true,
            'bombas' => $bombas,
            'bicos' => $bicos,
            'funcionarios' => $funcionarios,
            'combustiveis' => $combustiveis
        ]);
        exit;
    }

    // 2. REGISTRAR VENDA COM PERSISTENCIA, EMISSAO FISCAL E BACKUP AUTOMATICO
    if ($rota === 'finalizar_venda' && $metodo === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) {
            throw new InvalidArgumentException("Dados de venda invalidos.");
        }

        $idBico = (int)$input['id_bico'];
        $matriculaFrentista = (string)$input['matricula_frentista'];
        $volume = (float)$input['volume'];
        $formaPagamento = (string)$input['forma_pagamento'];
        $valorRecebido = (float)($input['valor_recebido'] ?? 0.0);
        $cpfCnpj = !empty($input['cpf_cnpj']) ? preg_replace('/\D/', '', $input['cpf_cnpj']) : null;

        // Validar Bico e Combustivel
        $stmtBico = $pdo->prepare("SELECT b.*, c.id as comb_id, c.nome as comb_nome, c.unidade_medida, c.codigo_interno, c.codigo_anp, c.ncm, tp.preco_unitario 
                                   FROM bicos b 
                                   JOIN combustiveis c ON b.id_combustivel = c.id 
                                   JOIN tabela_precos tp ON tp.id_combustivel = c.id 
                                   WHERE b.id = ?");
        $stmtBico->execute([$idBico]);
        $bico = $stmtBico->fetch();
        if (!$bico) {
            throw new Exception("Bico de abastecimento nao encontrado.");
        }

        // Validar Frentista
        $stmtFrentista = $pdo->prepare("SELECT * FROM funcionarios WHERE matricula = ? AND ativo = 1");
        $stmtFrentista->execute([$matriculaFrentista]);
        $frentista = $stmtFrentista->fetch();
        if (!$frentista) {
            throw new Exception("Matricula de frentista invalida ou inativa.");
        }

        // Calculos Financeiros Rigorosos
        $precoUnitario = (float)$bico['preco_unitario'];
        $valorTotal = round($volume * $precoUnitario, 2);
        $valorTroco = 0.00;

        if ($formaPagamento === 'DINHEIRO') {
            if ($valorRecebido < $valorTotal) {
                throw new Exception("Valor recebido e menor que o total da venda.");
            }
            $valorTroco = round($valorRecebido - $valorTotal, 2);
        } else {
            $valorRecebido = $valorTotal;
        }

        $codigoVenda = 'VD-' . date('Ymd') . '-' . strtoupper(bin2hex(random_bytes(4)));

        // Transacao no Banco Relacional
        $pdo->beginTransaction();

        $stmtVenda = $pdo->prepare("INSERT INTO vendas (codigo_venda, id_turno, id_bico, id_bomba, id_combustivel, id_frentista, 
                                    nome_frentista, matricula_frentista, volume, unidade_medida, preco_unitario, valor_total, 
                                    forma_pagamento, valor_recebido, valor_troco, cpf_cnpj_cliente, status) 
                                    VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONCLUIDA')");
        $stmtVenda->execute([
            $codigoVenda,
            $bico['id'],
            $bico['id_bomba'],
            $bico['comb_id'],
            $frentista['id'],
            $frentista['nome'],
            $frentista['matricula'],
            $volume,
            $bico['unidade_medida'],
            $precoUnitario,
            $valorTotal,
            $formaPagamento,
            $valorRecebido,
            $valorTroco,
            $cpfCnpj
        ]);

        $vendaId = (int)$pdo->lastInsertId();

        // Atualizar Encerrante do Bico
        $novoEncerrante = (float)$bico['encerrante_atual'] + $volume;
        $stmtEncerrante = $pdo->prepare("UPDATE bicos SET encerrante_atual = ? WHERE id = ?");
        $stmtEncerrante->execute([$novoEncerrante, $bico['id']]);

        // Gerar NFC-e
        $dadosNfce = $nfceService->gerarNFCe([
            'id' => $vendaId,
            'valor_total' => $valorTotal,
            'volume' => $volume,
            'preco_unitario' => $precoUnitario,
            'forma_pagamento' => $formaPagamento,
            'cpf_cnpj_cliente' => $cpfCnpj
        ], [
            'codigo_interno' => $bico['codigo_interno'],
            'nome' => $bico['comb_nome'],
            'codigo_anp' => $bico['codigo_anp'],
            'ncm' => $bico['ncm'],
            'unidade_medida' => $bico['unidade_medida']
        ]);

        $stmtDoc = $pdo->prepare("INSERT INTO documentos_fiscais (id_venda, modelo, serie, numero_nfc, chave_acesso, 
                                  protocolo_autorizacao, digest_value, url_qrcode, conteudo_xml, status) 
                                  VALUES (?, '65', 1, ?, ?, ?, ?, ?, ?, 'AUTORIZADA')");
        $stmtDoc->execute([
            $vendaId,
            $dadosNfce['numero_nfc'],
            $dadosNfce['chave_acesso'],
            $dadosNfce['protocolo'],
            $dadosNfce['digest_value'],
            $dadosNfce['url_qrcode'],
            $dadosNfce['xml']
        ]);

        // Registrar Log de Auditoria
        $stmtAudit = $pdo->prepare("INSERT INTO auditoria_logs (acao, entidade, registro_id, usuario, detalhes) VALUES (?, 'VENDAS', ?, ?, ?)");
        $stmtAudit->execute([
            'VENDA_CONCLUIDA',
            (string)$vendaId,
            $frentista['nome'],
            "Venda {$codigoVenda}: {$volume} {$bico['unidade_medida']} de {$bico['comb_nome']} a R$ {$precoUnitario}. Total R$ {$valorTotal} ({$formaPagamento})."
        ]);

        $pdo->commit();

        // DISPARO DO BACKUP AUTOMATICO INSTANTANEO NA PASTA /backups
        $infoBackup = $backupManager->salvarBackup("VENDA_{$vendaId}", $frentista['nome']);

        echo json_encode([
            'sucesso' => true,
            'venda_id' => $vendaId,
            'codigo_venda' => $codigoVenda,
            'total' => $valorTotal,
            'troco' => $valorTroco,
            'nfce' => $dadosNfce,
            'backup' => $infoBackup
        ]);
        exit;
    }

    // 3. CANCELAMENTO DE VENDA COM SENHA DE GERENTE E BACKUP IMEDIATO
    if ($rota === 'cancelar_venda' && $metodo === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $vendaId = (int)$input['venda_id'];
        $senhaGerente = (string)$input['senha_gerente'];
        $motivo = (string)($input['motivo'] ?? 'Cancelamento solicitado pelo cliente');

        // Validar credencial do gerente (senha padrao: admin123)
        if ($senhaGerente !== 'admin123') {
            throw new Exception("Senha de autorizacao gerencial incorreta.");
        }

        $pdo->beginTransaction();
        $stmt = $pdo->prepare("UPDATE vendas SET status = 'CANCELADA', motivo_cancelamento = ?, cancelado_por = 'GERENTE', cancelado_em = NOW() WHERE id = ?");
        $stmt->execute([$motivo, $vendaId]);

        $stmtAudit = $pdo->prepare("INSERT INTO auditoria_logs (acao, entidade, registro_id, usuario, detalhes) VALUES ('VENDA_CANCELADA', 'VENDAS', ?, 'GERENTE', ?)");
        $stmtAudit->execute([(string)$vendaId, "Venda {$vendaId} cancelada. Motivo: {$motivo}"]);
        $pdo->commit();

        $infoBackup = $backupManager->salvarBackup("CANCELAMENTO_VENDA_{$vendaId}", 'GERENTE');

        echo json_encode([
            'sucesso' => true,
            'mensagem' => "Venda {$vendaId} cancelada com sucesso.",
            'backup' => $infoBackup
        ]);
        exit;
    }

    // 4. ATUALIZACAO DE TABELA DE PRECOS E BACKUP
    if ($rota === 'atualizar_precos' && $metodo === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $idCombustivel = (int)$input['id_combustivel'];
        $novoPreco = (float)$input['novo_preco'];
        $usuario = (string)($input['usuario'] ?? 'GERENTE');

        $pdo->beginTransaction();
        $stmt = $pdo->prepare("UPDATE tabela_precos SET preco_unitario = ?, atualizado_em = NOW(), atualizado_por = ? WHERE id_combustivel = ?");
        $stmt->execute([$novoPreco, $usuario, $idCombustivel]);

        $stmtAudit = $pdo->prepare("INSERT INTO auditoria_logs (acao, entidade, registro_id, usuario, detalhes) VALUES ('ALTERACAO_PRECO', 'TABELA_PRECOS', ?, ?, ?)");
        $stmtAudit->execute([(string)$idCombustivel, $usuario, "Preco alterado para R$ {$novoPreco}"]);
        $pdo->commit();

        $infoBackup = $backupManager->salvarBackup("PRECO_ALTERADO_COMB_{$idCombustivel}", $usuario);

        echo json_encode([
            'sucesso' => true,
            'mensagem' => "Preco atualizado com sucesso.",
            'backup' => $infoBackup
        ]);
        exit;
    }

    // 5. FECHAMENTO DE TURNO COM BACKUP AUTOMATICO
    if ($rota === 'fechar_turno' && $metodo === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $senhaGerente = (string)($input['senha_gerente'] ?? '');
        $proximoTipoTurno = (string)($input['proximo_turno_tipo'] ?? 'NOTURNO_12X36');
        $proximoResponsavel = (string)($input['proximo_responsavel'] ?? 'Roberto Silva');
        $proximoOperador = (string)($input['proximo_operador'] ?? 'Mariana Santos');

        if ($senhaGerente !== 'admin123') {
            throw new Exception("Senha gerencial incorreta para fechamento de turno.");
        }

        $pdo->beginTransaction();

        // Buscar turno aberto atual
        $stmtTurno = $pdo->query("SELECT * FROM turnos_caixa WHERE status = 'ABERTO' ORDER BY id DESC LIMIT 1");
        $turnoAtual = $stmtTurno->fetch();

        if ($turnoAtual) {
            $turnoId = (int)$turnoAtual['id'];
            // Consolidar totais das vendas do turno
            $stmtTotais = $pdo->prepare("SELECT 
                                            COUNT(id) as total_vendas,
                                            COALESCE(SUM(valor_total), 0) as receita_total,
                                            COALESCE(SUM(CASE WHEN forma_pagamento = 'DINHEIRO' THEN valor_total ELSE 0 END), 0) as total_dinheiro,
                                            COALESCE(SUM(CASE WHEN forma_pagamento = 'PIX' THEN valor_total ELSE 0 END), 0) as total_pix,
                                            COALESCE(SUM(CASE WHEN forma_pagamento = 'CARTAO_DEBITO' THEN valor_total ELSE 0 END), 0) as total_debito,
                                            COALESCE(SUM(CASE WHEN forma_pagamento = 'CARTAO_CREDITO' THEN valor_total ELSE 0 END), 0) as total_credito
                                         FROM vendas WHERE id_turno = ? AND status = 'CONCLUIDA'");
            $stmtTotais->execute([$turnoId]);
            $totais = $stmtTotais->fetch();

            $stmtUpdate = $pdo->prepare("UPDATE turnos_caixa SET 
                                            status = 'FECHADO', 
                                            data_fechamento = NOW(), 
                                            total_dinheiro = ?, 
                                            total_pix = ?, 
                                            total_cartao_debito = ?, 
                                            total_cartao_credito = ? 
                                         WHERE id = ?");
            $stmtUpdate->execute([
                $totais['total_dinheiro'],
                $totais['total_pix'],
                $totais['total_debito'],
                $totais['total_credito'],
                $turnoId
            ]);
        }

        // Criar o novo turno
        $stmtNovo = $pdo->prepare("INSERT INTO turnos_caixa (operador_id, nome_operador, tipo_turno, data_abertura, status) 
                                   VALUES (1, ?, ?, NOW(), 'ABERTO')");
        $stmtNovo->execute([$proximoResponsavel, $proximoTipoTurno]);
        $novoTurnoId = (int)$pdo->lastInsertId();

        $stmtAudit = $pdo->prepare("INSERT INTO auditoria_logs (acao, entidade, registro_id, usuario, detalhes) VALUES ('FECHAMENTO_TURNO', 'TURNOS_CAIXA', ?, 'GERENTE', ?)");
        $stmtAudit->execute([(string)($turnoAtual['id'] ?? 0), "Turno encerrado. Novo turno aberto: {$novoTurnoId} ({$proximoTipoTurno})"]);

        $pdo->commit();

        $infoBackup = $backupManager->salvarBackup("FECHAMENTO_TURNO_" . ($turnoAtual['id'] ?? 0), 'GERENTE');

        echo json_encode([
            'sucesso' => true,
            'mensagem' => "Turno encerrado e novo turno iniciado com sucesso.",
            'novo_turno_id' => $novoTurnoId,
            'backup' => $infoBackup
        ]);
        exit;
    }

    // 6. RELATORIO CONSOLIDADO DE VENDAS (COM FILTRO DE TURNO)
    if ($rota === 'relatorio' && $metodo === 'GET') {
        $turnoFiltro = $_GET['turno_id'] ?? null;
        $sqlVendas = "SELECT v.*, c.nome as nome_combustivel, b.numero as numero_bomba, bi.numero_bico 
                      FROM vendas v 
                      JOIN combustiveis c ON v.id_combustivel = c.id 
                      JOIN bombas b ON v.id_bomba = b.id 
                      JOIN bicos bi ON v.id_bico = bi.id ";
        
        $params = [];
        if ($turnoFiltro) {
            $sqlVendas .= " WHERE v.id_turno = ? ";
            $params[] = (int)$turnoFiltro;
        }
        $sqlVendas .= " ORDER BY v.id DESC LIMIT 100";

        $stmtVendas = $pdo->prepare($sqlVendas);
        $stmtVendas->execute($params);
        $vendas = $stmtVendas->fetchAll();

        $sqlTotais = "SELECT 
                        COUNT(id) as total_vendas,
                        COALESCE(SUM(CASE WHEN status = 'CONCLUIDA' THEN valor_total ELSE 0 END), 0) as receita_total,
                        COALESCE(SUM(CASE WHEN status = 'CONCLUIDA' AND unidade_medida = 'LT' THEN volume ELSE 0 END), 0) as total_litros,
                        COALESCE(SUM(CASE WHEN status = 'CONCLUIDA' AND unidade_medida = 'M3' THEN volume ELSE 0 END), 0) as total_gnv_m3,
                        COALESCE(SUM(CASE WHEN status = 'CONCLUIDA' AND forma_pagamento = 'DINHEIRO' THEN valor_total ELSE 0 END), 0) as total_dinheiro,
                        COALESCE(SUM(CASE WHEN status = 'CONCLUIDA' AND forma_pagamento = 'PIX' THEN valor_total ELSE 0 END), 0) as total_pix,
                        COALESCE(SUM(CASE WHEN status = 'CONCLUIDA' AND forma_pagamento LIKE 'CARTAO%' THEN valor_total ELSE 0 END), 0) as total_cartoes
                       FROM vendas ";
        if ($turnoFiltro) {
            $sqlTotais .= " WHERE id_turno = ? ";
            $stmtTotais = $pdo->prepare($sqlTotais);
            $stmtTotais->execute([(int)$turnoFiltro]);
            $totais = $stmtTotais->fetch();
        } else {
            $totais = $pdo->query($sqlTotais)->fetch();
        }

        echo json_encode([
            'sucesso' => true,
            'totais' => $totais,
            'vendas' => $vendas
        ]);
        exit;
    }

    throw new Exception("Rota ou metodo nao reconhecido.");

} catch (Throwable $e) {
    if ($pdo && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode([
        'sucesso' => false,
        'erro' => $e->getMessage()
    ]);
}
