<?php
/**
 * Conexao com Banco de Dados Relacional - PDV Posto
 * Suporta MySQL, MariaDB e SQLite de forma intercambiavel via PDO.
 */

declare(strict_types=1);

class Conexao {
    private static ?PDO $instancia = null;

    public static function getConexao(): PDO {
        if (self::$instancia === null) {
            $driver = getenv('DB_DRIVER') ?: 'sqlite'; // 'mysql' ou 'sqlite'
            
            if ($driver === 'mysql') {
                $host = getenv('DB_HOST') ?: '127.0.0.1';
                $port = getenv('DB_PORT') ?: '3306';
                $db   = getenv('DB_NAME') ?: 'pdv_posto';
                $user = getenv('DB_USER') ?: 'root';
                $pass = getenv('DB_PASS') ?: '';
                
                $dsn = "mysql:host={$host};port={$port};dbname={$db};charset=utf8mb4";
                self::$instancia = new PDO($dsn, $user, $pass, [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ]);
            } else {
                $caminhoSqlite = __DIR__ . '/../dados/pdv_posto.sqlite';
                self::$instancia = new PDO("sqlite:{$caminhoSqlite}", null, null, [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
                ]);
            }
        }
        return self::$instancia;
    }
}
