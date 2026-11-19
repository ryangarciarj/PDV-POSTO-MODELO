-- =============================================================================
-- BANCO DE DADOS RELACIONAL DO PDV DE POSTO DE COMBUSTIVEIS
-- Compativel com MySQL 8.x, MariaDB 10.x e SQLite 3
-- Estrutura com rastreabilidade, auditoria e parametros fiscais da NFC-e
-- =============================================================================

-- 1. TABELA DE USUARIOS DO SISTEMA
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    login VARCHAR(50) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    nome VARCHAR(100) NOT NULL,
    perfil VARCHAR(20) NOT NULL DEFAULT 'CAIXA', -- 'FRENTISTA', 'CAIXA', 'GERENTE'
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABELA DE FUNCIONARIOS (FRENTISTAS, CAIXAS, GERENTES)
CREATE TABLE IF NOT EXISTS funcionarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    matricula VARCHAR(20) NOT NULL UNIQUE,
    nome VARCHAR(100) NOT NULL,
    cargo VARCHAR(50) NOT NULL,
    turno VARCHAR(30) NOT NULL, -- 'DIURNO_12X36', 'NOTURNO_12X36'
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABELA DE BOMBAS FISICAS
CREATE TABLE IF NOT EXISTS bombas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero INT NOT NULL UNIQUE,
    ilha VARCHAR(30) NOT NULL,
    descricao VARCHAR(100) NOT NULL,
    ativo TINYINT(1) NOT NULL DEFAULT 1
);

-- 4. TABELA DE COMBUSTIVEIS E PARAMETROS FISCAIS
CREATE TABLE IF NOT EXISTS combustiveis (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo_interno VARCHAR(10) NOT NULL UNIQUE,
    nome VARCHAR(60) NOT NULL,
    tipo VARCHAR(20) NOT NULL, -- 'LIQUIDO', 'GASOSO'
    unidade_medida VARCHAR(5) NOT NULL, -- 'LT', 'M3'
    codigo_anp VARCHAR(10) NOT NULL,
    ncm VARCHAR(10) NOT NULL,
    cfop VARCHAR(6) NOT NULL DEFAULT '5656',
    cst_icms VARCHAR(5) NOT NULL DEFAULT '060',
    cor_etiqueta VARCHAR(20) NOT NULL DEFAULT '#2563eb',
    ativo TINYINT(1) NOT NULL DEFAULT 1
);

-- 5. TABELA DE BICOS DE ABASTECIMENTO
CREATE TABLE IF NOT EXISTS bicos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_bomba INT NOT NULL,
    numero_bico INT NOT NULL,
    id_combustivel INT NOT NULL,
    encerrante_inicial DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    encerrante_atual DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    FOREIGN KEY (id_bomba) REFERENCES bombas(id),
    FOREIGN KEY (id_combustivel) REFERENCES combustiveis(id)
);

-- 6. TABELA DE PRECOS VIGENTES
CREATE TABLE IF NOT EXISTS tabela_precos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_combustivel INT NOT NULL,
    preco_unitario DECIMAL(10, 3) NOT NULL,
    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_por VARCHAR(50) NOT NULL DEFAULT 'SISTEMA',
    FOREIGN KEY (id_combustivel) REFERENCES combustiveis(id)
);

-- 7. TABELA DE TURNOS E SESSAO DE CAIXA
CREATE TABLE IF NOT EXISTS turnos_caixa (
    id INT AUTO_INCREMENT PRIMARY KEY,
    operador_id INT NOT NULL,
    nome_operador VARCHAR(100) NOT NULL,
    tipo_turno VARCHAR(30) NOT NULL, -- 'DIURNO_12X36', 'NOTURNO_12X36'
    data_abertura DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_fechamento DATETIME NULL,
    fundo_troco_inicial DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total_dinheiro DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total_pix DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total_cartao_debito DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total_cartao_credito DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'ABERTO' -- 'ABERTO', 'FECHADO'
);

-- 8. TABELA DE VENDAS E ABASTECIMENTOS
CREATE TABLE IF NOT EXISTS vendas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo_venda VARCHAR(32) NOT NULL UNIQUE,
    id_turno INT NOT NULL,
    id_bico INT NOT NULL,
    id_bomba INT NOT NULL,
    id_combustivel INT NOT NULL,
    id_frentista INT NOT NULL,
    nome_frentista VARCHAR(100) NOT NULL,
    matricula_frentista VARCHAR(20) NOT NULL,
    volume DECIMAL(10, 3) NOT NULL,
    unidade_medida VARCHAR(5) NOT NULL, -- 'LT' ou 'M3'
    preco_unitario DECIMAL(10, 3) NOT NULL,
    valor_total DECIMAL(10, 2) NOT NULL,
    forma_pagamento VARCHAR(30) NOT NULL, -- 'DINHEIRO', 'PIX', 'CARTAO_DEBITO', 'CARTAO_CREDITO'
    valor_recebido DECIMAL(10, 2) NOT NULL,
    valor_troco DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    cpf_cnpj_cliente VARCHAR(20) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'CONCLUIDA', -- 'CONCLUIDA', 'CANCELADA'
    motivo_cancelamento TEXT NULL,
    cancelado_por VARCHAR(50) NULL,
    cancelado_em DATETIME NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. TABELA DE DOCUMENTOS FISCAIS (NFC-e MODELO 65)
CREATE TABLE IF NOT EXISTS documentos_fiscais (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_venda INT NOT NULL UNIQUE,
    modelo VARCHAR(5) NOT NULL DEFAULT '65',
    serie INT NOT NULL DEFAULT 1,
    numero_nfc INT NOT NULL,
    chave_acesso VARCHAR(44) NOT NULL UNIQUE,
    protocolo_autorizacao VARCHAR(30) NOT NULL,
    digest_value VARCHAR(40) NULL,
    url_qrcode TEXT NOT NULL,
    conteudo_xml MEDIUMTEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'AUTORIZADA', -- 'AUTORIZADA', 'CONTINGENCIA', 'CANCELADA'
    emitido_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_venda) REFERENCES vendas(id)
);

-- 10. TABELA DE LOGS DE AUDITORIA
CREATE TABLE IF NOT EXISTS auditoria_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    acao VARCHAR(50) NOT NULL,
    entidade VARCHAR(50) NOT NULL,
    registro_id VARCHAR(50) NULL,
    usuario VARCHAR(50) NOT NULL,
    detalhes TEXT NOT NULL,
    data_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- DADOS INICIAIS (SEED) DO POSTO
-- =============================================================================

-- Usuarios Padrao (Senhas codificadas / simuladas: admin123, caixa123)
INSERT INTO usuarios (id, login, senha_hash, nome, perfil, ativo) VALUES
(1, 'gerente', '$2y$10$e8oY20Vv1q94w5gZ7r3.AOPcT4c8q2zD5t9P7s6M1b5K8n7P0q2aG', 'Carlos Eduardo (Gerente)', 'GERENTE', 1),
(2, 'encarregado', '$2y$10$e8oY20Vv1q94w5gZ7r3.AOPcT4c8q2zD5t9P7s6M1b5K8n7P0q2aG', 'Roberto Silva (Encarregado Noturno)', 'GERENTE', 1),
(3, 'caixa1', '$2y$10$e8oY20Vv1q94w5gZ7r3.AOPcT4c8q2zD5t9P7s6M1b5K8n7P0q2aG', 'Mariana Santos (Caixa 01)', 'CAIXA', 1),
(4, 'caixa2', '$2y$10$e8oY20Vv1q94w5gZ7r3.AOPcT4c8q2zD5t9P7s6M1b5K8n7P0q2aG', 'Felipe Oliveira (Caixa 02)', 'CAIXA', 1)
ON DUPLICATE KEY UPDATE nome=VALUES(nome);

-- Funcionarios do Posto (Escala 12x36)
INSERT INTO funcionarios (matricula, nome, cargo, turno, ativo) VALUES
('1000', 'Carlos Eduardo', 'Gerente de Pista', 'DIURNO_12X36', 1),
('2000', 'Roberto Silva', 'Encarregado de Pista', 'NOTURNO_12X36', 1),
-- 16 Frentistas Diurnos
('1001', 'Joao Pereira', 'Frentista', 'DIURNO_12X36', 1),
('1002', 'Lucas Souza', 'Frentista', 'DIURNO_12X36', 1),
('1003', 'Marcos Vinicius', 'Frentista', 'DIURNO_12X36', 1),
('1004', 'Andre Luis', 'Frentista', 'DIURNO_12X36', 1),
('1005', 'Bruno Cesar', 'Frentista', 'DIURNO_12X36', 1),
('1006', 'Daniel Rocha', 'Frentista', 'DIURNO_12X36', 1),
('1007', 'Eduardo Lima', 'Frentista', 'DIURNO_12X36', 1),
('1008', 'Fabio Alves', 'Frentista', 'DIURNO_12X36', 1),
('1009', 'Gabriel Martins', 'Frentista', 'DIURNO_12X36', 1),
('1010', 'Henrique Costa', 'Frentista', 'DIURNO_12X36', 1),
('1011', 'Igor Santos', 'Frentista', 'DIURNO_12X36', 1),
('1012', 'Julio Cesar', 'Frentista', 'DIURNO_12X36', 1),
('1013', 'Leonardo Ferreira', 'Frentista', 'DIURNO_12X36', 1),
('1014', 'Matheus Ribeiro', 'Frentista', 'DIURNO_12X36', 1),
('1015', 'Natan Silva', 'Frentista', 'DIURNO_12X36', 1),
('1016', 'Otavio Mendes', 'Frentista', 'DIURNO_12X36', 1),
-- 8 Frentistas Noturnos
('2001', 'Paulo Henrique', 'Frentista', 'NOTURNO_12X36', 1),
('2002', 'Rafael Gomes', 'Frentista', 'NOTURNO_12X36', 1),
('2003', 'Samuel Barbosa', 'Frentista', 'NOTURNO_12X36', 1),
('2004', 'Thiago Moreira', 'Frentista', 'NOTURNO_12X36', 1),
('2005', 'Victor Hugo', 'Frentista', 'NOTURNO_12X36', 1),
('2006', 'Wagner Dias', 'Frentista', 'NOTURNO_12X36', 1),
('2007', 'Yuri Nascimento', 'Frentista', 'NOTURNO_12X36', 1),
('2008', 'Zaqueu Fernandes', 'Frentista', 'NOTURNO_12X36', 1);

-- Combustiveis
INSERT INTO combustiveis (id, codigo_interno, nome, tipo, unidade_medida, codigo_anp, ncm, cfop, cst_icms, cor_etiqueta, ativo) VALUES
(1, 'GAS_COM', 'Gasolina Comum', 'LIQUIDO', 'LT', '320102001', '27101259', '5656', '060', '#dc2626', 1),
(2, 'GAS_ADI', 'Gasolina Aditivada', 'LIQUIDO', 'LT', '320102002', '27101259', '5656', '060', '#b91c1c', 1),
(3, 'ETA_COM', 'Etanol Comum', 'LIQUIDO', 'LT', '810101001', '22071090', '5656', '060', '#16a34a', 1),
(4, 'ETA_ADI', 'Etanol Aditivado', 'LIQUIDO', 'LT', '810101002', '22071090', '5656', '060', '#15803d', 1),
(5, 'DIE_S10', 'Diesel S10', 'LIQUIDO', 'LT', '820101034', '27101921', '5656', '060', '#475569', 1),
(6, 'DIE_500', 'Diesel S500', 'LIQUIDO', 'LT', '820101014', '27101921', '5656', '060', '#334155', 1),
(7, 'GNV_VEI', 'GNV (Gas Natural)', 'GASOSO', 'M3', '220101005', '27112100', '5656', '060', '#0284c7', 1);

-- Tabela de Precos Iniciais
INSERT INTO tabela_precos (id_combustivel, preco_unitario, atualizado_por) VALUES
(1, 5.890, 'CARLOS EDUARDO'),
(2, 6.090, 'CARLOS EDUARDO'),
(3, 3.990, 'CARLOS EDUARDO'),
(4, 4.190, 'CARLOS EDUARDO'),
(5, 6.190, 'CARLOS EDUARDO'),
(6, 5.990, 'CARLOS EDUARDO'),
(7, 4.490, 'CARLOS EDUARDO');

-- 8 Bombas Fisicas (com localizacao e ilhas)
INSERT INTO bombas (id, numero, ilha, descricao, ativo) VALUES
(1, 1, 'Ilha 1 - Leves', 'Bomba 01 - Combustiveis Leves (Gasolina/Etanol)', 1),
(2, 2, 'Ilha 1 - Leves', 'Bomba 02 - Combustiveis Leves (Gasolina/Etanol)', 1),
(3, 3, 'Ilha 2 - Diesel', 'Bomba 03 - Diesel S10 e S500', 1),
(4, 4, 'Ilha 2 - Diesel', 'Bomba 04 - Diesel S10 e S500', 1),
(5, 5, 'Ilha 3 - GNV 1', 'Bomba 05 - GNV Alta Pressao', 1),
(6, 6, 'Ilha 3 - GNV 1', 'Bomba 06 - GNV Alta Pressao', 1),
(7, 7, 'Ilha 4 - GNV 2', 'Bomba 07 - GNV Alta Pressao', 1),
(8, 8, 'Ilha 4 - GNV 2', 'Bomba 08 - GNV Alta Pressao', 1);

-- 16 Bicos (2 bicos por bomba)
INSERT INTO bicos (id, id_bomba, numero_bico, id_combustivel, encerrante_inicial, encerrante_atual, ativo) VALUES
-- Bomba 1: Gasolina Comum e Gasolina Aditivada
(1, 1, 1, 1, 150000.000, 150000.000, 1),
(2, 1, 2, 2, 85000.000, 85000.000, 1),
-- Bomba 2: Etanol Comum e Etanol Aditivado
(3, 2, 3, 3, 92000.000, 92000.000, 1),
(4, 2, 4, 4, 41000.000, 41000.000, 1),
-- Bomba 3: Diesel S10 e Diesel S500
(5, 3, 5, 5, 310000.000, 310000.000, 1),
(6, 3, 6, 6, 215000.000, 215000.000, 1),
-- Bomba 4: Diesel S10 e Diesel S500
(7, 4, 7, 5, 290000.000, 290000.000, 1),
(8, 4, 8, 6, 185000.000, 185000.000, 1),
-- Bombas 5 a 8: Bicos de GNV (M3)
(9,  5, 9,  7, 450000.000, 450000.000, 1),
(10, 5, 10, 7, 442000.000, 442000.000, 1),
(11, 6, 11, 7, 398000.000, 398000.000, 1),
(12, 6, 12, 7, 401000.000, 401000.000, 1),
(13, 7, 13, 7, 510000.000, 510000.000, 1),
(14, 7, 14, 7, 498000.000, 498000.000, 1),
(15, 8, 15, 7, 475000.000, 475000.000, 1),
(16, 8, 16, 7, 469000.000, 469000.000, 1);
