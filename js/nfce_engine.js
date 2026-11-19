/**
 * GERADOR FISCAL NFC-e (MODELO 65) E EMISSOR DE DANFE TERMICO
 * Simula a geracao e autorizacao com regras da SEFAZ para combustiveis.
 */

class NFCeEngine {
    constructor() {
        this.cnpjFicticio = '12345678000195';
        this.uf = '33'; // RJ
        this.ambiente = '2'; // Homologacao
    }

    gerarChave44Digitos(numeroNota) {
        const ano = new Date().getFullYear().toString().substring(2);
        const mes = String(new Date().getMonth() + 1).padStart(2, '0');
        const mod = '65';
        const serie = '001';
        const numFormatado = String(numeroNota).padStart(9, '0');
        const tpEmis = '1';
        const codNumerico = String(Math.floor(10000000 + Math.random() * 90000000));

        const chaveSemDv = `${this.uf}${ano}${mes}${this.cnpjFicticio}${mod}${serie}${numFormatado}${tpEmis}${codNumerico}`;
        
        // Modulo 11
        const pesos = [2, 3, 4, 5, 6, 7, 8, 9];
        let soma = 0;
        let pIdx = 0;
        for (let i = chaveSemDv.length - 1; i >= 0; i--) {
            soma += parseInt(chaveSemDv[i], 10) * pesos[pIdx];
            pIdx = (pIdx + 1) % pesos.length;
        }
        const resto = soma % 11;
        const dv = (11 - resto >= 10) ? 0 : (11 - resto);

        return chaveSemDv + dv;
    }

    emitirNFCe(venda, combustivel, bico) {
        const numeroNota = venda.id || Math.floor(1000 + Math.random() * 90000);
        const chaveAcesso = this.gerarChave44Digitos(numeroNota);
        const protocolo = `1332600${Math.floor(100000000 + Math.random() * 900000000)}`;
        const dataEmissao = new Date().toISOString();

        // Montagem do XML Padrao SEFAZ
        const volumeFormatado = Number(venda.volume).toFixed(3);
        const precoFormatado = Number(venda.preco_unitario).toFixed(3);
        const totalFormatado = Number(venda.valor_total).toFixed(2);
        const unidade = combustivel.unidade_medida;

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe${chaveAcesso}" versao="4.00">
    <ide>
      <cUF>${this.uf}</cUF>
      <natOp>VENDA DE COMBUSTIVEL</natOp>
      <mod>65</mod>
      <serie>1</serie>
      <nNF>${numeroNota}</nNF>
      <dhEmi>${dataEmissao}</dhEmi>
      <tpNF>1</tpNF>
      <tpAmb>${this.ambiente}</tpAmb>
    </ide>
    <emit>
      <CNPJ>${this.cnpjFicticio}</CNPJ>
      <xNome>AUTO POSTO CIDADE MODELO LTDA</xNome>
      <xFant>POSTO BRASIL</xFant>
      <IE>99999999</IE>
    </emit>
    <det nItem="1">
      <prod>
        <cProd>${combustivel.codigo_interno}</cProd>
        <xProd>${combustivel.nome}</xProd>
        <NCM>${combustivel.ncm}</NCM>
        <CFOP>5656</CFOP>
        <uCom>${unidade}</uCom>
        <qCom>${volumeFormatado}</qCom>
        <vUnCom>${precoFormatado}</vUnCom>
        <vProd>${totalFormatado}</vProd>
        <comb>
          <cProdANP>${combustivel.codigo_anp}</cProdANP>
          <descANP>${combustivel.nome}</descANP>
          <UFCons>RJ</UFCons>
        </comb>
      </prod>
    </det>
    <total>
      <ICMSTot>
        <vNF>${totalFormatado}</vNF>
      </ICMSTot>
    </total>
  </infNFe>
</NFe>`;

        const qrCodeUrl = `https://dfe-portal.svrs.rs.gov.br/dfe-qr-code/nfce/qrcode?chNFe=${chaveAcesso}&nVersao=100&tpAmb=2`;

        return {
            numero_nfc: numeroNota,
            chave_acesso: chaveAcesso,
            protocolo: protocolo,
            data_emissao: dataEmissao,
            xml: xml,
            url_qrcode: qrCodeUrl,
            status: 'AUTORIZADA'
        };
    }

    renderizarCupomDANFE(venda, combustivel, bico, nfce) {
        const docFormatado = venda.cpf_cnpj_cliente ? venda.cpf_cnpj_cliente : 'CONSUMIDOR NAO IDENTIFICADO';
        const dataBr = new Date(nfce.data_emissao).toLocaleString('pt-BR');

        let html = `
        <div class="danfe-cupom">
            <div class="danfe-cabecalho">
                <div class="danfe-empresa">AUTO POSTO CIDADE MODELO LTDA</div>
                <div class="danfe-sub">CNPJ: 12.345.678/0001-95 - IE: 99.999.999</div>
                <div class="danfe-sub">AV. CENTRAL DAS ILHAS, 1500 - CENTRO - RJ</div>
                <div class="danfe-linha"></div>
                <div class="danfe-titulo">DANFE NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletronica</div>
                <div class="danfe-aviso">Nao permite aproveitamento de credito de ICMS</div>
                <div class="danfe-linha"></div>
            </div>

            <div class="danfe-corpo">
                <div class="danfe-grid-item">
                    <span>Item: 001 - ${combustivel.nome}</span>
                </div>
                <div class="danfe-grid-item">
                    <span>ANP: ${combustivel.codigo_anp} | Bico: ${bico.numero_bico}</span>
                </div>
                <div class="danfe-grid-calc">
                    <span>Qtd: ${Number(venda.volume).toFixed(3)} ${combustivel.unidade_medida}</span>
                    <span>Vl. Unit: R$ ${Number(venda.preco_unitario).toFixed(3)}</span>
                    <span class="danfe-total-item">R$ ${Number(venda.valor_total).toFixed(2)}</span>
                </div>

                <div class="danfe-linha"></div>

                <div class="danfe-resumo-total">
                    <div class="danfe-linha-total">
                        <strong>QTD. TOTAL DE ITENS:</strong>
                        <span>1</span>
                    </div>
                    <div class="danfe-linha-total valor-destaque">
                        <strong>VALOR TOTAL R$:</strong>
                        <span>${Number(venda.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div class="danfe-linha-total">
                        <strong>FORMA DE PAGAMENTO:</strong>
                        <span>${venda.forma_pagamento}</span>
                    </div>
                    <div class="danfe-linha-total">
                        <strong>VALOR RECEBIDO:</strong>
                        <span>R$ ${Number(venda.valor_recebido).toFixed(2)}</span>
                    </div>
                    ${venda.valor_troco > 0 ? `
                    <div class="danfe-linha-total troco-destaque">
                        <strong>TROCO:</strong>
                        <span>R$ ${Number(venda.valor_troco).toFixed(2)}</span>
                    </div>` : ''}
                </div>

                <div class="danfe-linha"></div>

                <div class="danfe-fiscal">
                    <div>CONSUMIDOR: ${docFormatado}</div>
                    <div>FRENTISTA: ${venda.nome_frentista} (Mat: ${venda.matricula_frentista})</div>
                    <div>NFC-e N.: ${nfce.numero_nfc} - SERIE: 001 - EMISSAO: ${dataBr}</div>
                    <div class="danfe-protocolo">PROTOCOLO: ${nfce.protocolo}</div>
                    <div class="danfe-chave">
                        <strong>CHAVE DE ACESSO:</strong>
                        <span>${this.formatarChave(nfce.chave_acesso)}</span>
                    </div>
                </div>

                <div class="danfe-qrcode-container">
                    <div id="qrcode-danfe-area"></div>
                    <div class="danfe-consulta">Consulte pela Chave de Acesso em:<br>www.fazenda.rj.gov.br/nfce/consulta</div>
                </div>
            </div>
        </div>
        `;
        return html;
    }

    formatarChave(chave) {
        return chave.replace(/(\d{4})/g, '$1 ').trim();
    }
}

window.nfceEngine = new NFCeEngine();
