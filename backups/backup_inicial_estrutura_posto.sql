-- =============================================================================
-- BACKUP INICIAL DE ESTRUTURA E CARGA DE DADOS - PDV POSTO
-- =============================================================================

CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    login VARCHAR(50) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    nome VARCHAR(100) NOT NULL,
    perfil VARCHAR(20) NOT NULL DEFAULT 'CAIXA',
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS funcionarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    matricula VARCHAR(20) NOT NULL UNIQUE,
    nome VARCHAR(100) NOT NULL,
    cargo VARCHAR(50) NOT NULL,
    turno VARCHAR(30) NOT NULL,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bombas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero INT NOT NULL UNIQUE,
    ilha VARCHAR(30) NOT NULL,
    descricao VARCHAR(100) NOT NULL,
    ativo TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS combustiveis (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo_interno VARCHAR(10) NOT NULL UNIQUE,
    nome VARCHAR(60) NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    unidade_medida VARCHAR(5) NOT NULL,
    codigo_anp VARCHAR(10) NOT NULL,
    ncm VARCHAR(10) NOT NULL,
    cfop VARCHAR(6) NOT NULL DEFAULT '5656',
    cst_icms VARCHAR(5) NOT NULL DEFAULT '060',
    cor_etiqueta VARCHAR(20) NOT NULL DEFAULT '#2563eb',
    ativo TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS bicos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_bomba INT NOT NULL,
    numero_bico INT NOT NULL,
    id_combustivel INT NOT NULL,
    encerrante_inicial DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    encerrante_atual DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    ativo TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS tabela_precos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_combustivel INT NOT NULL,
    preco_unitario DECIMAL(10, 3) NOT NULL,
    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_por VARCHAR(50) NOT NULL DEFAULT 'SISTEMA'
);

CREATE TABLE IF NOT EXISTS turnos_caixa (
    id INT AUTO_INCREMENT PRIMARY KEY,
    operador_id INT NOT NULL,
    nome_operador VARCHAR(100) NOT NULL,
    tipo_turno VARCHAR(30) NOT NULL,
    data_abertura DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_fechamento DATETIME NULL,
    fundo_troco_inicial DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total_dinheiro DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total_pix DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total_cartao_debito DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total_cartao_credito DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'ABERTO'
);

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
    unidade_medida VARCHAR(5) NOT NULL,
    preco_unitario DECIMAL(10, 3) NOT NULL,
    valor_total DECIMAL(10, 2) NOT NULL,
    forma_pagamento VARCHAR(30) NOT NULL,
    valor_recebido DECIMAL(10, 2) NOT NULL,
    valor_troco DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    cpf_cnpj_cliente VARCHAR(20) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'CONCLUIDA',
    motivo_cancelamento TEXT NULL,
    cancelado_por VARCHAR(50) NULL,
    cancelado_em DATETIME NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
    status VARCHAR(20) NOT NULL DEFAULT 'AUTORIZADA',
    emitido_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auditoria_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    acao VARCHAR(50) NOT NULL,
    entidade VARCHAR(50) NOT NULL,
    registro_id VARCHAR(50) NULL,
    usuario VARCHAR(50) NOT NULL,
    detalhes TEXT NOT NULL,
    data_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CARGA INICIAL
INSERT INTO usuarios (id, login, senha_hash, nome, perfil, ativo) VALUES
(1, 'gerente', '$2y$10$e8oY20Vv1q94w5gZ7r3.AOPcT4c8q2zD5t9P7s6M1b5K8n7P0q2aG', 'Carlos Eduardo (Gerente)', 'GERENTE', 1),
(2, 'encarregado', '$2y$10$e8oY20Vv1q94w5gZ7r3.AOPcT4c8q2zD5t9P7s6M1b5K8n7P0q2aG', 'Roberto Silva (Encarregado Noturno)', 'GERENTE', 1),
(3, 'caixa1', '$2y$10$e8oY20Vv1q94w5gZ7r3.AOPcT4c8q2zD5t9P7s6M1b5K8n7P0q2aG', 'Mariana Santos (Caixa 01)', 'CAIXA', 1);

INSERT INTO combustiveis (id, codigo_interno, nome, tipo, unidade_medida, codigo_anp, ncm, cfop, cst_icms, cor_etiqueta, ativo) VALUES
(1, 'GAS_COM', 'Gasolina Comum', 'LIQUIDO', 'LT', '320102001', '27101259', '5656', '060', '#dc2626', 1),
(2, 'GAS_ADI', 'Gasolina Aditivada', 'LIQUIDO', 'LT', '320102002', '27101259', '5656', '060', '#b91c1c', 1),
(3, 'ETA_COM', 'Etanol Comum', 'LIQUIDO', 'LT', '810101001', '22071090', '5656', '060', '#16a34a', 1),
(4, 'ETA_ADI', 'Etanol Aditivado', 'LIQUIDO', 'LT', '810101002', '22071090', '5656', '060', '#15803d', 1),
(5, 'DIE_S10', 'Diesel S10', 'LIQUIDO', 'LT', '820101034', '27101921', '5656', '060', '#475569', 1),
(6, 'DIE_500', 'Diesel S500', 'LIQUIDO', 'LT', '820101014', '27101921', '5656', '060', '#334155', 1),
(7, 'GNV_VEI', 'GNV (Gas Natural)', 'GASOSO', 'M3', '220101005', '27112100', '5656', '060', '#0284c7', 1);

INSERT INTO tabela_precos (id_combustivel, preco_unitario, atualizado_por) VALUES
(1, 5.890, 'CARLOS EDUARDO'),
(2, 6.090, 'CARLOS EDUARDO'),
(3, 3.990, 'CARLOS EDUARDO'),
(4, 4.190, 'CARLOS EDUARDO'),
(5, 6.190, 'CARLOS EDUARDO'),
(6, 5.990, 'CARLOS EDUARDO'),
(7, 4.490, 'CARLOS EDUARDO');
