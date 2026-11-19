# PDV Posto de Combustiveis - Documentacao e Manual do Sistema

Sistema completo de Ponto de Venda (PDV) desenvolvido especialmente para postos de combustiveis, com arquitetura minimalista, interface touch-friendly de alta legibilidade, persistencia estrita em banco relacional SQL, emissao fiscal NFC-e (modelo 65) e recurso de backup automatico instantaneo a cada alteracao.

---

## 1. Como Iniciar o Programa

O sistema foi concebido para rodar imediatamente no seu computador com Windows, sem necessidade de instalar dependencias complexas.

### Opcao A: Inicializacao Rapida de 1 Clique (Recomendada no Windows)
1. Dê um duplo clique no arquivo:
   `iniciar_pdv.bat`
2. Uma janela preta do PowerShell sera aberta iniciando o servidor local e seu navegador padrao (Chrome, Edge ou Firefox) abrira automaticamente em:
   `http://localhost:8085` (ou 8086)
3. Nesse modo, todas as alteracoes feitas no PDV sao gravadas fisicamente e instantaneamente na pasta `backups/` como arquivos `.sql`.

### Opcao B: Execucao Direta pelo Navegador (Sem Servidor)
1. Dê um duplo clique no arquivo `index.html`.
2. O sistema roda imediatamente com todos os calculos, emissao de NFC-e, QR Code Pix e persistencia SQL ativa no armazenamento local seguro, alem de permitir baixar o dump SQL completo a qualquer momento na aba **Backups SQL**.

### Opcao C: Implantacao no Linux / Apache / PHP / MariaDB
1. Copie o conteudo da pasta `backend/` para o seu servidor web Linux (ex.: `/var/www/html/pdv`).
2. Importe o arquivo `dados/banco_pdv.sql` no MariaDB ou MySQL:
   `mysql -u root -p pdv_posto < dados/banco_pdv.sql`
3. O endpoint `backend/api.php` processa as vendas e o `backend/backup_manager.php` grava os backups automaticos na pasta `backups/`.

---

## 2. Recurso de Backup Automatico e Persistencia SQL

O sistema atende rigorosamente a exigencia de **persistencia de dados independente em formato SQL com backup a cada alteracao**:

1. **A cada venda finalizada**: O sistema gera um arquivo `backup_YYYYMMDD_HHMMSS_VENDA_X.sql` contendo o estado completo de todas as tabelas.
2. **A cada cancelamento de venda**: E gravado `backup_YYYYMMDD_HHMMSS_CANCELAMENTO_VENDA_X.sql`.
3. **A cada mudanca de preco de combustivel**: E gravado `backup_YYYYMMDD_HHMMSS_PRECO_COMB_X.sql`.
4. **Pasta de destino**:
   `C:\Users\Ryan Garcia\Desktop\Projeto\PDV - POSTO\backups\`
5. **Base ativa vigente**:
   O arquivo `dados/banco_pdv.sql` e mantido sempre atualizado com o ultimo estado valido do posto.
6. **Historico de Auditoria**:
   O arquivo `backups/historico_alteracoes.log` registra data, hora, usuario responsavel, acao executada e tamanho de cada snapshot.

---

## 3. Estrutura Fisica do Posto (8 Bombas - 16 Bicos)

- **Bombas 01 e 02 (Ilha 1 - Leves)**:
  - Bico 01: Gasolina Comum (LT) - R$ 5,890 / L (Codigo ANP: 320102001)
  - Bico 02: Gasolina Aditivada (LT) - R$ 6,090 / L (Codigo ANP: 320102002)
  - Bico 03: Etanol Hidratado Comum (LT) - R$ 3,990 / L (Codigo ANP: 810101001)
  - Bico 04: Etanol Aditivado (LT) - R$ 4,190 / L (Codigo ANP: 810101002)
- **Bombas 03 e 04 (Ilha 2 - Diesel)**:
  - Bicos 05 e 07: Diesel S10 (LT) - R$ 6,190 / L (Codigo ANP: 820101034)
  - Bicos 06 e 08: Diesel S500 (LT) - R$ 5,990 / L (Codigo ANP: 820101014)
- **Bombas 05, 06, 07 e 08 (Ilhas 3 e 4 - GNV)**:
  - Bicos 09 a 16: GNV - Gas Natural Veicular (M3) - R$ 4,490 / m3 (Codigo ANP: 220101005)
  - Medido rigorosamente em **Metros Cubicos (M3)** conforme regulamentacao da ANP e SEFAZ.

---

## 4. Escala de Trabalho 12x36, Troca de Turno e Fechamento de Caixa

- **Turno Diurno (12x36)**:
  - 1 Gerente de Pista: Carlos Eduardo (Matricula 1000)
  - 16 Frentistas: Matriculas de 1001 a 1016
- **Turno Noturno (12x36)**:
  - 1 Encarregado de Pista: Roberto Silva (Matricula 2000)
  - 8 Frentistas: Matriculas de 2001 a 2008

### Recurso de Troca de Turno e Isolamento Rigoroso de Abastecimentos
1. **Botao "Trocar de Turno"**: Disponivel na barra superior e na aba de relatorios.
2. **Consolidacao e Fechamento**: O sistema calcula todos os abastecimentos do turno que esta encerrando (litragem total, GNV m3, faturamento por forma de pagamento e vendas por frentista).
3. **Backup Automatico SQL do Turno**: Um arquivo `backup_YYYYMMDD_HHMMSS_FECHAMENTO_TURNO_X.sql` e gravado imediatamente na pasta `backups/`.
4. **Comprovante Termico de Fechamento**: Exibe e permite imprimir o comprovante de fechamento de caixa (bobina 80mm) com as assinaturas do gerente e do caixa.
5. **Isolamento Total**: Ao iniciar o proximo turno (ex: mudanca do Diurno para o Noturno), o terminal do PDV comeca **completamente zerado (0 vendas, R$ 0,00)**. Nenhum abastecimento do turno anterior cai ou se mistura com o turno atual! Na aba de relatorios, o operador pode filtrar pelo turno atual ou consultar qualquer turno encerrado no historico.

---

## 5. Formas de Pagamento e Emissao Fiscal (NFC-e)

1. **Dinheiro**: Campo para digitacao do valor entregue pelo cliente com calculo de troco em tempo real na tela.
2. **Pix**: Gera instantaneamente o QR Code em tela e a chave Copia e Cola no padrao do Banco Central.
3. **Cartao de Debito e Credito**: Registro de bandeira e transacao.
4. **CPF ou CNPJ na Nota**: Campo opcional para inclusao do documento do consumidor na NFC-e.
5. **NFC-e Modelo 65**:
   - Gera chave de acesso valida de 44 digitos com digito verificador modulo 11.
   - Gera XML estruturado com tags obrigatorias de combustivel (`<comb>`, `<cProdANP>`, ICMS Monofasico ad rem).
   - Exibe o DANFE termico no formato padrao para impressoras de 80mm e 58mm, pronto para impressao via `Ctrl+P` ou botao em tela.

---

## 6. Seguranca e Cancelamento Gerencial

- Frentistas e caixas nao podem cancelar abastecimentos sozinhos.
- O cancelamento de venda exige **senha gerencial** (padrao inicial: `admin123`) e obriga a digitacao do motivo, gerando registro no log de auditoria e um novo arquivo de backup SQL imediatamente.

---

## 7. Estrutura de Arquivos

```
PDV - POSTO/
├── index.html                  # Interface do PDV touch-screen
├── iniciar_pdv.bat             # Atalho de 1 clique para iniciar o PDV
├── servidor_pdv.ps1            # Servidor local nativo em PowerShell com gravador de backups
├── css/
│   └── estilo.css              # Design minimalista, limpo e de alto contraste
├── js/
│   ├── app.js                  # Controle de vendas, interface, turnos e cancelamentos
│   ├── sql_engine.js           # Motor de persistencia e geracao automatica de backups SQL
│   ├── nfce_engine.js          # Emissor fiscal de NFC-e (modelo 65) e DANFE termico
│   └── qrcode.min.js           # Gerador matricial de QR Code para Pix e NFC-e
├── dados/
│   └── banco_pdv.sql           # Estado SQL ativo e vigente do banco de dados
├── backups/                    # Pasta onde sao salvos os snapshots SQL timestampados
│   └── historico_alteracoes.log
├── backend/                    # Modulo PHP + MariaDB para servidores Linux
│   ├── conexao.php
│   ├── api.php
│   ├── backup_manager.php
│   ├── nfce_service.php
│   └── database.sql
└── README.md                   # Manual de operacao
```
