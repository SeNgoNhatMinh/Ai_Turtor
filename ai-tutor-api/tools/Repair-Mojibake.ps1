param(
    [Parameter(Mandatory = $true)]
    [string[]]$Path
)

$ErrorActionPreference = 'Stop'
$utf8 = [System.Text.UTF8Encoding]::new($false)
$windows1252 = [System.Text.Encoding]::GetEncoding(1252)

foreach ($item in $Path) {
    $fullPath = (Resolve-Path $item).Path
    $lines = [System.IO.File]::ReadAllLines($fullPath, [System.Text.Encoding]::UTF8)
    $changed = 0

    for ($i = 0; $i -lt $lines.Length; $i++) {
        $current = $lines[$i]
        if ($current -notmatch '[\u00C3\u00C2\u00C4\u00E2]') { continue }

        for ($pass = 0; $pass -lt 3; $pass++) {
            if ($current -notmatch '[\u00C3\u00C2\u00C4\u00E2]') { break }
            $candidate = [System.Text.Encoding]::UTF8.GetString($windows1252.GetBytes($current))
            if ($candidate.Contains([char]0xfffd)) { break }
            if (($candidate.ToCharArray() | Where-Object { $_ -eq '?' }).Count -gt
                ($current.ToCharArray() | Where-Object { $_ -eq '?' }).Count) { break }
            $current = $candidate
        }

        if ($current -ne $lines[$i]) {
            $lines[$i] = $current
            $changed++
        }
    }

    [System.IO.File]::WriteAllLines($fullPath, $lines, $utf8)
    Write-Host "${item}: repaired $changed line(s)"
}
