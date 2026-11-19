try {
    $tcp = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, 8089)
    $tcp.Start()
    Write-Output "TCP_OK"
    $tcp.Stop()
} catch {
    Write-Output ("TCP_ERR: " + $_.Exception.Message)
}
