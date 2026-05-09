Add-Type -AssemblyName System.Drawing

function New-Brush($hex) {
  return New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($hex))
}

function Fill-CellRect {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Brush]$Brush,
    [int]$Cell,
    [int]$X,
    [int]$Y,
    [int]$Width = 1,
    [int]$Height = 1
  )

  $Graphics.FillRectangle($Brush, $X * $Cell, $Y * $Cell, $Width * $Cell, $Height * $Cell)
}

function Draw-PixelCat {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$Cell
  )

  $ink = New-Brush "#0d1117"
  $ear = New-Brush "#161b22"
  $nose = New-Brush "#7ee787"
  $flag = New-Brush "#d73a49"
  $pole = New-Brush "#2ea043"
  $trim = New-Brush "#ffdf5d"

  try {
    $headRows = @(
      @{ y = 4; x = 3; w = 2 },
      @{ y = 4; x = 7; w = 2 },
      @{ y = 5; x = 2; w = 3 },
      @{ y = 5; x = 7; w = 3 },
      @{ y = 6; x = 2; w = 8 },
      @{ y = 7; x = 1; w = 10 },
      @{ y = 8; x = 1; w = 10 },
      @{ y = 9; x = 1; w = 10 },
      @{ y = 10; x = 1; w = 10 },
      @{ y = 11; x = 1; w = 10 },
      @{ y = 12; x = 2; w = 8 },
      @{ y = 13; x = 3; w = 6 }
    )

    foreach ($row in $headRows) {
      Fill-CellRect -Graphics $Graphics -Brush $ink -Cell $Cell -X $row.x -Y $row.y -Width $row.w
    }

    Fill-CellRect -Graphics $Graphics -Brush $ear -Cell $Cell -X 3 -Y 5
    Fill-CellRect -Graphics $Graphics -Brush $ear -Cell $Cell -X 8 -Y 5

    Fill-CellRect -Graphics $Graphics -Brush ([System.Drawing.Brushes]::White) -Cell $Cell -X 3 -Y 8
    Fill-CellRect -Graphics $Graphics -Brush ([System.Drawing.Brushes]::White) -Cell $Cell -X 7 -Y 8
    Fill-CellRect -Graphics $Graphics -Brush $nose -Cell $Cell -X 5 -Y 10
    Fill-CellRect -Graphics $Graphics -Brush ([System.Drawing.Brushes]::White) -Cell $Cell -X 4 -Y 11
    Fill-CellRect -Graphics $Graphics -Brush ([System.Drawing.Brushes]::White) -Cell $Cell -X 6 -Y 11

    Fill-CellRect -Graphics $Graphics -Brush $pole -Cell $Cell -X 11 -Y 2 -Width 1 -Height 11
    Fill-CellRect -Graphics $Graphics -Brush $ink -Cell $Cell -X 10 -Y 11 -Width 2 -Height 2

    Fill-CellRect -Graphics $Graphics -Brush $flag -Cell $Cell -X 12 -Y 2 -Width 4 -Height 5
    Fill-CellRect -Graphics $Graphics -Brush $trim -Cell $Cell -X 12 -Y 2 -Width 4 -Height 1
    Fill-CellRect -Graphics $Graphics -Brush $trim -Cell $Cell -X 15 -Y 2 -Width 1 -Height 5
  }
  finally {
    $ink.Dispose()
    $ear.Dispose()
    $nose.Dispose()
    $flag.Dispose()
    $pole.Dispose()
    $trim.Dispose()
  }
}

function Draw-FlagText {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$Size
  )

  $Graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::SingleBitPerPixelGridFit
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center

  $han = [string][char]0x6C49
  $hua = [string][char]0x5316
  $stackedText = $han + "`n" + $hua

  try {
    if ($Size -ge 96) {
      $font = New-Object System.Drawing.Font("Microsoft YaHei UI", 16, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
      $rect = New-Object System.Drawing.RectangleF -ArgumentList ([single]($Size * 0.73)), ([single]($Size * 0.13)), ([single]($Size * 0.21)), ([single]($Size * 0.28))
      $Graphics.DrawString($stackedText, $font, [System.Drawing.Brushes]::White, $rect, $format)
      $font.Dispose()
    }
    elseif ($Size -ge 32) {
      $font = New-Object System.Drawing.Font("Microsoft YaHei UI", 7, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
      $rect = New-Object System.Drawing.RectangleF -ArgumentList ([single]($Size * 0.73)), ([single]($Size * 0.14)), ([single]($Size * 0.21)), ([single]($Size * 0.27))
      $Graphics.DrawString($stackedText, $font, [System.Drawing.Brushes]::White, $rect, $format)
      $font.Dispose()
    }
    else {
      $font = New-Object System.Drawing.Font("Microsoft YaHei UI", 6, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
      $rect = New-Object System.Drawing.RectangleF -ArgumentList ([single]($Size * 0.74)), ([single]($Size * 0.12)), ([single]($Size * 0.18)), ([single]($Size * 0.18))
      $Graphics.DrawString($han, $font, [System.Drawing.Brushes]::White, $rect, $format)
      $font.Dispose()
    }
  }
  finally {
    $format.Dispose()
  }
}

$root = Split-Path -Parent $PSScriptRoot
$iconDir = Join-Path $root "assets\\icons"
New-Item -ItemType Directory -Force $iconDir | Out-Null

$sizes = @(16, 32, 48, 128)
foreach ($size in $sizes) {
  $cell = [int]($size / 16)
  $bitmap = New-Object System.Drawing.Bitmap($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None

    Draw-PixelCat -Graphics $graphics -Cell $cell
    Draw-FlagText -Graphics $graphics -Size $size

    $path = Join-Path $iconDir ("icon{0}.png" -f $size)
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

Write-Output "Pixel icons generated in $iconDir"
