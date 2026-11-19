# =============================================================================
# SERVIDOR NATIVO DE DESENVOLVIMENTO E PERSISTENCIA - PDV POSTO
# Zero dependencias externas (usa apenas o PowerShell e .NET nativo do Windows)
# =============================================================================

$porta = 8085
$pastaBase = $PSScriptRoot
if (-not $pastaBase) { $pastaBase = Get-Location }

$pastaBackups = Join-Path $pastaBase "backups"
$pastaDados = Join-Path $pastaBase "dados"

if (-not (Test-Path $pastaBackups)) { New-Item -ItemType Directory -Path $pastaBackups -Force | Out-Null }
if (-not (Test-Path $pastaDados)) { New-Item -ItemType Directory -Path $pastaDados -Force | Out-Null }

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  PDV POSTO DE COMBUSTIVEIS - SERVIDOR LOCAL DE BACKUP     " -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Diretorio do projeto: $pastaBase"
Write-Host "Diretorio de backups: $pastaBackups"
Write-Host "Diretorio de dados:   $pastaDados"

$listener = $null
try {
    $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $porta)
    $listener.Start()
} catch {
    $porta = 8086
    $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $porta)
    $listener.Start()
}

$url = "http://localhost:$porta"
Write-Host "Servidor ativo em: $url" -ForegroundColor Green
Write-Host "Pressione Ctrl+C para encerrar o servidor a qualquer momento." -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

# Abrir automaticamente o navegador padrao no terminal de vendas
Start-Process $url

while ($true) {
    try {
        $client = $listener.AcceptTcpClient()
        $stream = $client.GetStream()
        $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
        $writer = New-Object System.IO.StreamWriter($stream, [System.Text.Encoding]::UTF8)
        $writer.AutoFlush = $true

        $requestLine = $reader.ReadLine()
        if (-not $requestLine) {
            $client.Close()
            continue
        }

        $parts = $requestLine.Split(" ")
        $method = $parts[0]
        $path = $parts[1]

        # Ler cabecalhos HTTP
        $headers = @{}
        $contentLength = 0
        while ($line = $reader.ReadLine()) {
            if ($line -eq "") { break }
            $headerParts = $line.Split(":", 2)
            if ($headerParts.Length -eq 2) {
                $headerName = $headerParts[0].Trim().ToLower()
                $headerVal = $headerParts[1].Trim()
                $headers[$headerName] = $headerVal
                if ($headerName -eq "content-length") {
                    $contentLength = [int]$headerVal
                }
            }
        }

        # Tratar requisicoes OPTIONS (CORS preflight)
        if ($method -eq "OPTIONS") {
            $writer.WriteLine("HTTP/1.1 200 OK")
            $writer.WriteLine("Access-Control-Allow-Origin: *")
            $writer.WriteLine("Access-Control-Allow-Methods: GET, POST, OPTIONS")
            $writer.WriteLine("Access-Control-Allow-Headers: Content-Type")
            $writer.WriteLine("Content-Length: 0")
            $writer.WriteLine("")
            $client.Close()
            continue
        }

        # API: Salvar Backup Instantaneo a cada alteracao
        if ($path -eq "/api/salvar_backup" -and $method -eq "POST") {
            $bodyChars = New-Object char[] $contentLength
            $reader.ReadBlock($bodyChars, 0, $contentLength) | Out-Null
            $bodyJson = -join $bodyChars

            $dadosReq = $bodyJson | ConvertFrom-Json
            $acao = $dadosReq.acao
            if (-not $acao) { $acao = "ALTERACAO" }

            $timestamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
            $nomeArquivo = "backup_${timestamp}_${acao}.sql"
            $caminhoBackup = Join-Path $pastaBackups $nomeArquivo
            $caminhoAtual = Join-Path $pastaDados "banco_pdv.sql"

            # Salvar no diretorio de backups
            [System.IO.File]::WriteAllText($caminhoBackup, $dadosReq.sql_dump, [System.Text.Encoding]::UTF8)

            # Atualizar tambem o banco atual vigente
            [System.IO.File]::WriteAllText($caminhoAtual, $dadosReq.sql_dump, [System.Text.Encoding]::UTF8)

            # Log de auditoria de alteracao
            $logEntry = "[$((Get-Date).ToString("yyyy-MM-dd HH:mm:ss"))] Acao: $acao | Arquivo: $nomeArquivo | Tamanho: $($dadosReq.sql_dump.Length) bytes`r`n"
            $caminhoLog = Join-Path $pastaBackups "historico_alteracoes.log"
            [System.IO.File]::AppendAllText($caminhoLog, $logEntry, [System.Text.Encoding]::UTF8)

            Write-Host "[BACKUP SALVO COM SUCESSO] $nomeArquivo ($acao)" -ForegroundColor Green

            $respostaObj = @{
                sucesso = $true
                arquivo = $nomeArquivo
                caminho = $caminhoBackup
                data_hora = (Get-Date).ToString("dd/MM/yyyy HH:mm:ss")
                mensagem = "Backup SQL gravado com sucesso na pasta backups."
            }
            $respostaJson = $respostaObj | ConvertTo-Json

            $writer.WriteLine("HTTP/1.1 200 OK")
            $writer.WriteLine("Content-Type: application/json; charset=utf-8")
            $writer.WriteLine("Access-Control-Allow-Origin: *")
            $writer.WriteLine("Content-Length: " + [System.Text.Encoding]::UTF8.GetByteCount($respostaJson))
            $writer.WriteLine("")
            $writer.Write($respostaJson)
            $client.Close()
            continue
        }

        # API: Listar todos os backups existentes
        if ($path -eq "/api/listar_backups" -and $method -eq "GET") {
            $arquivos = Get-ChildItem -Path $pastaBackups -Filter "*.sql" | Sort-Object LastWriteTime -Descending | Select-Object -First 50
            $lista = @()
            foreach ($arq in $arquivos) {
                $lista += @{
                    nome = $arq.Name
                    tamanho_kb = [math]::Round($arq.Length / 1024, 2)
                    data_modificacao = $arq.LastWriteTime.ToString("dd/MM/yyyy HH:mm:ss")
                }
            }
            $respostaJson = @{ backups = $lista } | ConvertTo-Json
            $writer.WriteLine("HTTP/1.1 200 OK")
            $writer.WriteLine("Content-Type: application/json; charset=utf-8")
            $writer.WriteLine("Access-Control-Allow-Origin: *")
            $writer.WriteLine("Content-Length: " + [System.Text.Encoding]::UTF8.GetByteCount($respostaJson))
            $writer.WriteLine("")
            $writer.Write($respostaJson)
            $client.Close()
            continue
        }

        # API: Carregar banco de dados atual
        if ($path -eq "/api/obter_banco_atual" -and $method -eq "GET") {
            $caminhoAtual = Join-Path $pastaDados "banco_pdv.sql"
            $conteudoSql = ""
            if (Test-Path $caminhoAtual) {
                $conteudoSql = [System.IO.File]::ReadAllText($caminhoAtual, [System.Text.Encoding]::UTF8)
            }
            $respostaJson = @{ sql = $conteudoSql } | ConvertTo-Json
            $writer.WriteLine("HTTP/1.1 200 OK")
            $writer.WriteLine("Content-Type: application/json; charset=utf-8")
            $writer.WriteLine("Access-Control-Allow-Origin: *")
            $writer.WriteLine("Content-Length: " + [System.Text.Encoding]::UTF8.GetByteCount($respostaJson))
            $writer.WriteLine("")
            $writer.Write($respostaJson)
            $client.Close()
            continue
        }

        # Servir Arquivos Estaticos (HTML, CSS, JS, SQL)
        $cleanPath = $path.Split("?")[0]
        if ($cleanPath -eq "/" -or $cleanPath -eq "") {
            $cleanPath = "/index.html"
        }

        $localFilePath = Join-Path $pastaBase $cleanPath.Replace("/", "\").TrimStart("\")
        if (Test-Path $localFilePath -PathType Leaf) {
            $extension = [System.IO.Path]::GetExtension($localFilePath).ToLower()
            $mime = "text/plain; charset=utf-8"
            if ($extension -eq ".html") { $mime = "text/html; charset=utf-8" }
            elseif ($extension -eq ".css") { $mime = "text/css; charset=utf-8" }
            elseif ($extension -eq ".js") { $mime = "application/javascript; charset=utf-8" }
            elseif ($extension -eq ".json") { $mime = "application/json; charset=utf-8" }
            elseif ($extension -eq ".sql") { $mime = "application/sql; charset=utf-8" }
            elseif ($extension -eq ".svg") { $mime = "image/svg+xml" }
            elseif ($extension -eq ".png") { $mime = "image/png" }

            $fileBytes = [System.IO.File]::ReadAllBytes($localFilePath)

            $writer.WriteLine("HTTP/1.1 200 OK")
            $writer.WriteLine("Content-Type: $mime")
            $writer.WriteLine("Access-Control-Allow-Origin: *")
            $writer.WriteLine("Content-Length: " + $fileBytes.Length)
            $writer.WriteLine("")
            $writer.Flush()
            $stream.Write($fileBytes, 0, $fileBytes.Length)
        } else {
            $msg = "404 - Arquivo nao encontrado"
            $writer.WriteLine("HTTP/1.1 404 Not Found")
            $writer.WriteLine("Content-Type: text/plain; charset=utf-8")
            $writer.WriteLine("Content-Length: " + $msg.Length)
            $writer.WriteLine("")
            $writer.Write($msg)
        }

        $client.Close()
    } catch {
        # Ignorar conexoes abortadas pelo navegador ao recarregar
    }
}
