<?php
/**
 * Servico de Emissao Fiscal - NFC-e Modelo 65 para Postos de Combustiveis
 * Gera XML no padrao SEFAZ, calcula chave de 44 digitos e gera payload do QR Code v2.
 */

declare(strict_types=1);

class NFCeService {
    private string $cnpjFicticio = '12345678000195';
    private string $uf = '33'; // Rio de Janeiro (SEFAZ RJ)
    private string $ambiente = '2'; // 2 = Homologacao / Testes, 1 = Producao
    private string $cscId = '000001';
    private string $cscToken = 'A1B2C3D4E5F67890123456789ABCDEF0';

    /**
     * Gera XML e Chave de Acesso para uma venda de combustivel
     */
    public function gerarNFCe(array $venda, array $combustivel): array {
        $ano = date('y');
        $mes = date('m');
        $modelo = '65';
        $serie = '001';
        $numeroNota = str_pad((string)($venda['id'] ?? rand(1000, 99999)), 9, '0', STR_PAD_LEFT);
        $tipoEmissao = '1'; // 1 = Normal, 9 = Contingencia
        $codigoNumerico = str_pad((string)rand(10000000, 99999999), 8, '0', STR_PAD_LEFT);

        // Montagem da Chave de 44 digitos
        $chaveSemDigito = "{$this->uf}{$ano}{$mes}{$this->cnpjFicticio}{$modelo}{$serie}{$numeroNota}{$tipoEmissao}{$codigoNumerico}";
        $digitoVerificador = $this->calcularDigitoVerificador($chaveSemDigito);
        $chaveAcesso = $chaveSemDigito . $digitoVerificador;

        $protocolo = '133' . date('y') . str_pad((string)rand(1000000000, 9999999999), 10, '0', STR_PAD_LEFT);
        $digestValue = base64_encode(sha1($chaveAcesso . microtime(), true));

        // URL do QR Code (Padrao SEFAZ Homologacao v2)
        $dataEmissaoHex = bin2hex(date('c'));
        $valorHex = bin2hex(number_format((float)$venda['valor_total'], 2, '.', ''));
        $digestHex = bin2hex($digestValue);
        
        $qrCodeParam = "chNFe={$chaveAcesso}&nVersao=100&tpAmb={$this->ambiente}&cDest=" . ($venda['cpf_cnpj_cliente'] ?? '') . "&dhEmi={$dataEmissaoHex}&vNF={$valorHex}&vICMS=0.00&digVal={$digestHex}&cIdToken={$this->cscId}";
        $qrCodeHash = sha1($qrCodeParam . $this->cscToken);
        $urlQrCode = "https://dfe-portal.svrs.rs.gov.br/dfe-qr-code/nfce/qrcode?" . $qrCodeParam . "&cHashQRCode=" . $qrCodeHash;

        // XML Completo no padrao SEFAZ com informacoes de combustivel
        $unidade = $combustivel['unidade_medida']; // LT ou M3
        $anp = $combustivel['codigo_anp'];
        $ncm = $combustivel['ncm'];
        $volumeFormatado = number_format((float)$venda['volume'], 3, '.', '');
        $precoFormatado = number_format((float)$venda['preco_unitario'], 3, '.', '');
        $totalFormatado = number_format((float)$venda['valor_total'], 2, '.', '');
        $dataISO = date('c');

        $xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
        $xml .= "<NFe xmlns=\"http://www.portalfiscal.inf.br/nfe\">\n";
        $xml .= "  <infNFe Id=\"NFe{$chaveAcesso}\" versao=\"4.00\">\n";
        $xml .= "    <ide>\n";
        $xml .= "      <cUF>{$this->uf}</cUF>\n";
        $xml .= "      <cNF>{$codigoNumerico}</cNF>\n";
        $xml .= "      <natOp>VENDA DE COMBUSTIVEL</natOp>\n";
        $xml .= "      <mod>{$modelo}</mod>\n";
        $xml .= "      <serie>1</serie>\n";
        $xml .= "      <nNF>" . (int)$numeroNota . "</nNF>\n";
        $xml .= "      <dhEmi>{$dataISO}</dhEmi>\n";
        $xml .= "      <tpNF>1</tpNF>\n";
        $xml .= "      <idDest>1</idDest>\n";
        $xml .= "      <cMunFG>3304557</cMunFG>\n";
        $xml .= "      <tpImp>4</tpImp>\n";
        $xml .= "      <tpEmis>{$tipoEmissao}</tpEmis>\n";
        $xml .= "      <cDV>{$digitoVerificador}</cDV>\n";
        $xml .= "      <tpAmb>{$this->ambiente}</tpAmb>\n";
        $xml .= "      <finNFe>1</finNFe>\n";
        $xml .= "      <indFinal>1</indFinal>\n";
        $xml .= "      <indPres>1</indPres>\n";
        $xml .= "      <procEmi>0</procEmi>\n";
        $xml .= "      <verProc>PDV_POSTO_1.0</verProc>\n";
        $xml .= "    </ide>\n";
        $xml .= "    <emit>\n";
        $xml .= "      <CNPJ>{$this->cnpjFicticio}</CNPJ>\n";
        $xml .= "      <xNome>AUTO POSTO CIDADE MODELO LTDA</xNome>\n";
        $xml .= "      <xFant>POSTO BRASIL</xFant>\n";
        $xml .= "      <enderEmit>\n";
        $xml .= "        <xLgr>AVENIDA CENTRAL DAS ILHAS</xLgr>\n";
        $xml .= "        <nro>1500</nro>\n";
        $xml .= "        <xBairro>CENTRO</xBairro>\n";
        $xml .= "        <cMun>3304557</cMun>\n";
        $xml .= "        <xMun>RIO DE JANEIRO</xMun>\n";
        $xml .= "        <UF>RJ</UF>\n";
        $xml .= "        <CEP>20000000</CEP>\n";
        $xml .= "      </enderEmit>\n";
        $xml .= "      <IE>99999999</IE>\n";
        $xml .= "      <CRT>3</CRT>\n";
        $xml .= "    </emit>\n";
        if (!empty($venda['cpf_cnpj_cliente'])) {
            $xml .= "    <dest>\n";
            $doc = preg_replace('/\D/', '', $venda['cpf_cnpj_cliente']);
            if (strlen($doc) <= 11) {
                $xml .= "      <CPF>{$doc}</CPF>\n";
            } else {
                $xml .= "      <CNPJ>{$doc}</CNPJ>\n";
            }
            $xml .= "    </dest>\n";
        }
        $xml .= "    <det nItem=\"1\">\n";
        $xml .= "      <prod>\n";
        $xml .= "        <cProd>{$combustivel['codigo_interno']}</cProd>\n";
        $xml .= "        <cEAN>SEM GTIN</cEAN>\n";
        $xml .= "        <xProd>{$combustivel['nome']}</xProd>\n";
        $xml .= "        <NCM>{$ncm}</NCM>\n";
        $xml .= "        <CFOP>5656</CFOP>\n";
        $xml .= "        <uCom>{$unidade}</uCom>\n";
        $xml .= "        <qCom>{$volumeFormatado}</qCom>\n";
        $xml .= "        <vUnCom>{$precoFormatado}</vUnCom>\n";
        $xml .= "        <vProd>{$totalFormatado}</vProd>\n";
        $xml .= "        <uTrib>{$unidade}</uTrib>\n";
        $xml .= "        <qTrib>{$volumeFormatado}</qTrib>\n";
        $xml .= "        <vUnTrib>{$precoFormatado}</vUnTrib>\n";
        $xml .= "        <indTot>1</indTot>\n";
        $xml .= "        <comb>\n";
        $xml .= "          <cProdANP>{$anp}</cProdANP>\n";
        $xml .= "          <descANP>{$combustivel['nome']}</descANP>\n";
        $xml .= "          <UFCons>RJ</UFCons>\n";
        $xml .= "        </comb>\n";
        $xml .= "      </prod>\n";
        $xml .= "      <imposto>\n";
        $xml .= "        <ICMS>\n";
        $xml .= "          <ICMS02>\n";
        $xml .= "            <orig>0</orig>\n";
        $xml .= "            <CST>02</CST>\n"; // Tributacao monofasica ad rem
        $xml .= "            <qBCMono>{$volumeFormatado}</qBCMono>\n";
        $xml .= "            <adRemICMS>1.3700</adRemICMS>\n";
        $xml .= "            <vICMSMono>" . number_format((float)$volumeFormatado * 1.37, 2, '.', '') . "</vICMSMono>\n";
        $xml .= "          </ICMS02>\n";
        $xml .= "        </ICMS>\n";
        $xml .= "        <PIS><PISNT><CST>04</CST></PISNT></PIS>\n";
        $xml .= "        <COFINS><COFINSNT><CST>04</CST></COFINSNT></COFINS>\n";
        $xml .= "      </imposto>\n";
        $xml .= "    </det>\n";
        $xml .= "    <total>\n";
        $xml .= "      <ICMSTot>\n";
        $xml .= "        <vBC>0.00</vBC>\n";
        $xml .= "        <vICMS>0.00</vICMS>\n";
        $xml .= "        <vProd>{$totalFormatado}</vProd>\n";
        $xml .= "        <vNF>{$totalFormatado}</vNF>\n";
        $xml .= "      </ICMSTot>\n";
        $xml .= "    </total>\n";
        $xml .= "    <pag>\n";
        $xml .= "      <detPag>\n";
        $tPag = '01'; // 01=Dinheiro, 03=Cartao Credito, 04=Cartao Debito, 17=Pix
        if ($venda['forma_pagamento'] === 'CARTAO_CREDITO') $tPag = '03';
        elseif ($venda['forma_pagamento'] === 'CARTAO_DEBITO') $tPag = '04';
        elseif ($venda['forma_pagamento'] === 'PIX') $tPag = '17';
        $xml .= "        <tPag>{$tPag}</tPag>\n";
        $xml .= "        <vPag>{$totalFormatado}</vPag>\n";
        $xml .= "      </detPag>\n";
        $xml .= "    </pag>\n";
        $xml .= "  </infNFe>\n";
        $xml .= "  <protNFe versao=\"4.00\">\n";
        $xml .= "    <infProt>\n";
        $xml .= "      <tpAmb>{$this->ambiente}</tpAmb>\n";
        $xml .= "      <verAplic>SVRS_2026</verAplic>\n";
        $xml .= "      <chNFe>{$chaveAcesso}</chNFe>\n";
        $xml .= "      <dhRecbto>{$dataISO}</dhRecbto>\n";
        $xml .= "      <nProt>{$protocolo}</nProt>\n";
        $xml .= "      <digVal>{$digestValue}</digVal>\n";
        $xml .= "      <cStat>100</cStat>\n";
        $xml .= "      <xMotivo>Autorizado o uso da NF-e</xMotivo>\n";
        $xml .= "    </infProt>\n";
        $xml .= "  </protNFe>\n";
        $xml .= "</NFe>";

        return [
            'chave_acesso' => $chaveAcesso,
            'numero_nfc' => (int)$numeroNota,
            'protocolo' => $protocolo,
            'digest_value' => $digestValue,
            'url_qrcode' => $urlQrCode,
            'xml' => $xml,
            'status' => 'AUTORIZADA'
        ];
    }

    private function calcularDigitoVerificador(string $chave43): int {
        $pesos = [2, 3, 4, 5, 6, 7, 8, 9];
        $soma = 0;
        $tamanho = strlen($chave43);
        $pesoIdx = 0;

        for ($i = $tamanho - 1; $i >= 0; $i--) {
            $soma += (int)$chave43[$i] * $pesos[$pesoIdx];
            $pesoIdx = ($pesoIdx + 1) % count($pesos);
        }

        $resto = $soma % 11;
        $dv = 11 - $resto;
        return ($dv >= 10) ? 0 : $dv;
    }
}
