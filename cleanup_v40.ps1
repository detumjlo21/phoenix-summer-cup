param(
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$archive = Join-Path $root "_archive_v40"

function Write-Log {
  param([string]$Text)
  Write-Host $Text
  Add-Content -Path (Join-Path $root "CLEANUP_REPORT.txt") -Value $Text
}

function Ensure-Dir {
  param([string]$Path)
  if (-not (Test-Path $Path)) {
    if ($DryRun) {
      Write-Log "[DRY-RUN] Tạo thư mục: $Path"
    } else {
      New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
  }
}

function Move-Safe {
  param(
    [string]$Source,
    [string]$DestinationDir
  )

  if (-not (Test-Path $Source)) { return }

  Ensure-Dir $DestinationDir
  $name = Split-Path $Source -Leaf
  $destination = Join-Path $DestinationDir $name

  if (Test-Path $destination) {
    $base = [System.IO.Path]::GetFileNameWithoutExtension($name)
    $ext = [System.IO.Path]::GetExtension($name)
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $destination = Join-Path $DestinationDir "$base-$stamp$ext"
  }

  if ($DryRun) {
    Write-Log "[DRY-RUN] Chuyển: $name -> $DestinationDir"
  } else {
    Move-Item -Path $Source -Destination $destination
    Write-Log "[ĐÃ CHUYỂN] $name -> $DestinationDir"
  }
}

function Is-ReferencedByHtml {
  param([string]$FileName)

  $htmlFiles = Get-ChildItem -Path $root -Filter "*.html" -File -ErrorAction SilentlyContinue
  foreach ($html in $htmlFiles) {
    $content = Get-Content -Path $html.FullName -Raw -ErrorAction SilentlyContinue
    if ($content -match [regex]::Escape($FileName)) {
      return $true
    }
  }
  return $false
}

Set-Content -Path (Join-Path $root "CLEANUP_REPORT.txt") -Value @"
PHOENIX V40 - CLEANUP REPORT
Thời gian: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Chế độ: $(if ($DryRun) { "DRY-RUN" } else { "THỰC THI" })
============================================================
"@

Write-Log "Bắt đầu dọn repo: $root"

# 1) Tài liệu phiên bản cũ
$docPatterns = @(
  "HUONG-DAN*.txt",
  "HUONG_DAN*.txt",
  "README-V*.md",
  "README-V*.txt",
  "README-MUA-*.txt",
  "THEM_VAO_*.txt"
)

foreach ($pattern in $docPatterns) {
  Get-ChildItem -Path $root -Filter $pattern -File -ErrorAction SilentlyContinue |
    ForEach-Object {
      Move-Safe $_.FullName (Join-Path $archive "docs")
    }
}

# Giữ README.md chính, chuyển README.txt cũ nếu có
$legacyReadme = Join-Path $root "README.txt"
Move-Safe $legacyReadme (Join-Path $archive "docs")

# 2) SQL: gom vào database cho gọn, không xóa
$dbDir = Join-Path $root "database"
$dbArchive = Join-Path $dbDir "archive"
Ensure-Dir $dbDir
Ensure-Dir $dbArchive

# setup.sql giữ ở database/schema.sql để dễ tìm
$setup = Join-Path $root "setup.sql"
if (Test-Path $setup) {
  if ($DryRun) {
    Write-Log "[DRY-RUN] Chuyển setup.sql -> database/schema.sql"
  } else {
    $schema = Join-Path $dbDir "schema.sql"
    if (Test-Path $schema) {
      Move-Safe $setup $dbArchive
    } else {
      Move-Item $setup $schema
      Write-Log "[ĐÃ CHUYỂN] setup.sql -> database/schema.sql"
    }
  }
}

# Các bản vá SQL cũ vào database/archive
Get-ChildItem -Path $root -Filter "repair_*.sql" -File -ErrorAction SilentlyContinue |
  ForEach-Object {
    Move-Safe $_.FullName $dbArchive
  }

foreach ($name in @("upgrade.sql","v37_layout_manager.sql","v37_1_countdown_layout.sql","v38_prizes.sql")) {
  Move-Safe (Join-Path $root $name) $dbArchive
}

# 3) File JS chắc chắn không được HTML hiện tại gọi
# Chỉ chuyển khi không có HTML nào tham chiếu, tránh làm hỏng website.
$possibleUnused = @(
  "admin-quick.js",
  "admin-layout.js",
  "public-layout.js",
  "admin-prizes.js",
  "public-prizes.js"
)

foreach ($name in $possibleUnused) {
  $path = Join-Path $root $name
  if (Test-Path $path) {
    if (Is-ReferencedByHtml $name) {
      Write-Log "[GIỮ LẠI] $name đang được HTML sử dụng."
    } else {
      Move-Safe $path (Join-Path $archive "unused-modules")
    }
  }
}

# 4) File CSS module chỉ chuyển nếu không được HTML tham chiếu
$optionalCss = @("prizes.css")
foreach ($name in $optionalCss) {
  $path = Join-Path $root $name
  if (Test-Path $path) {
    if (Is-ReferencedByHtml $name) {
      Write-Log "[GIỮ LẠI] $name đang được HTML sử dụng."
    } else {
      Move-Safe $path (Join-Path $archive "unused-modules")
    }
  }
}

# 5) Tạo README cho database
$dbReadme = Join-Path $dbDir "README.md"
if (-not $DryRun) {
  @"
# Database

- `schema.sql`: file khởi tạo chính đã được chuyển từ `setup.sql`.
- `archive/`: các bản vá SQL cũ đã chạy qua từng phiên bản.

Website không tải trực tiếp các file SQL này. Chúng được giữ lại để sao lưu và dựng lại Supabase khi cần.
"@ | Set-Content -Path $dbReadme -Encoding UTF8
}

# 6) Báo các file runtime đang được HTML sử dụng
Write-Log ""
Write-Log "===== FILE RUNTIME ĐƯỢC HTML THAM CHIẾU ====="
$htmlFiles = Get-ChildItem -Path $root -Filter "*.html" -File -ErrorAction SilentlyContinue
$references = New-Object System.Collections.Generic.HashSet[string]

foreach ($html in $htmlFiles) {
  $content = Get-Content -Path $html.FullName -Raw
  [regex]::Matches($content, '(?:src|href)="([^"]+\.(?:js|css|png|jpg|jpeg|webp))"') |
    ForEach-Object {
      $value = $_.Groups[1].Value
      if ($value -notmatch '^https?://') {
        [void]$references.Add($value)
      }
    }
}

$references | Sort-Object | ForEach-Object {
  Write-Log "[RUNTIME] $_"
}

Write-Log ""
Write-Log "Hoàn tất. Website runtime không bị thay đổi."
Write-Log "Các file cũ được chuyển vào _archive_v40, không bị xóa vĩnh viễn."
