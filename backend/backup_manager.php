<?php
/**
 * Gerenciador de Backup Automatico e Auditoria
 * Salva um snapshot completo em formato SQL a cada alteracao realizada no sistema.
 */

declare(strict_types=1);

require_once __DIR__ . '/conexao.php';

class BackupManager {
    private string $diretorioBackups;
    private string $diretorioDados;

    public function __construct() {
        $this->diretorioBackups = __DIR__ . '/../backups';
        $this->diretorioDados = __DIR__ . '/../dados';

        if (!is_dir($this->diretorioBackups)) {
            mkdir($this->diretorioBackups, 0777, true);
        }
        if (!is_dir($this->diretorioDados)) {
            mkdir($this->diretorioDados, 0777, true);
        }
    }

    /**
     * Gera backup SQL completo e persiste na pasta backups/
     * 
     * @param string $acao Motivo da gravacao (ex: VENDA_REALIZADA, PRECO_ALTERADO, CANCELAMENTO)
     * @param string|null $usuario Operador responsavel
     * @return array Informacoes do arquivo gerado
     */
    public function salvarBackup(string $acao, ?string $usuario = 'SISTEMA'): array {
        $pdo = Conexao::getConexao();
        $tabelas = [
            'usuarios',
            'funcionarios',
            'bombas',
            'combustiveis',
            'bicos',
            'tabela_precos',
            'turnos_caixa',
            'vendas',
            'documentos_fiscais',
            'auditoria_logs'
        ];

        $timestamp = date('Ymd_His');
        $acaoSanitizada = preg_replace('/[^A-Za-z0-9_]/', '_', strtoupper($acao));
        $nomeArquivo = "backup_{$timestamp}_{$acaoSanitizada}.sql";
        $caminhoArquivo = $this->diretorioBackups . '/' . $nomeArquivo;
        $caminhoAtual = $this->diretorioDados . '/banco_pdv.sql';

        $buffer = "-- ==========================================================\n";
        $buffer .= "-- BACKUP AUTOMATICO - PDV POSTO DE COMBUSTIVEIS\n";
        $buffer .= "-- ACAO: {$acao}\n";
        $buffer .= "-- RESPONSAVEL: {$usuario}\n";
        $buffer .= "-- DATA/HORA: " . date('Y-m-d H:i:s') . "\n";
        $buffer .= "-- ==========================================================\n\n";

        foreach ($tabelas as $tabela) {
            try {
                $stmt = $pdo->query("SELECT * FROM {$tabela}");
                $linhas = $stmt->fetchAll();
                
                $buffer .= "-- DADOS DA TABELA {$tabela}\n";
                if (!empty($linhas)) {
                    $colunas = array_keys($linhas[0]);
                    $colunasStr = '`' . implode('`, `', $colunas) . '`';
                    
                    foreach ($linhas as $linha) {
                        $valoresTratados = [];
                        foreach ($linha as $val) {
                            if ($val === null) {
                                $valoresTratados[] = "NULL";
                            } elseif (is_numeric($val)) {
                                $valoresTratados[] = (string)$val;
                            } else {
                                $valoresTratados[] = "'" . addslashes((string)$val) . "'";
                            }
                        }
                        $valoresStr = implode(', ', $valoresTratados);
                        $buffer .= "INSERT INTO `{$tabela}` ({$colunasStr}) VALUES ({$valoresStr});\n";
                    }
                }
                $buffer .= "\n";
            } catch (Exception $e) {
                // Tabela pode nao existir ainda dependendo da inicializacao
                $buffer .= "-- Aviso: {$tabela} nao exportada ({$e->getMessage()})\n\n";
            }
        }

        // Salvar snapshot timestampado na pasta backups
        file_put_contents($caminhoArquivo, $buffer, LOCK_EX);

        // Atualizar o banco ativo na pasta dados
        file_put_contents($caminhoAtual, $buffer, LOCK_EX);

        // Registrar no historico
        $logPath = $this->diretorioBackups . '/historico_alteracoes.log';
        $logEntry = "[" . date('Y-m-d H:i:s') . "] Acao: {$acao} | Usuario: {$usuario} | Arquivo: {$nomeArquivo} | Bytes: " . strlen($buffer) . "\n";
        file_put_contents($logPath, $logEntry, FILE_APPEND | LOCK_EX);

        return [
            'sucesso' => true,
            'arquivo' => $nomeArquivo,
            'caminho' => $caminhoArquivo,
            'tamanho_bytes' => strlen($buffer),
            'data_hora' => date('d/m/Y H:i:s')
        ];
    }
}
