# Gera os ícones PNG do Bolso (iPhone exige PNG para a tela de início).
# Uso: powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1
Add-Type -AssemblyName System.Drawing
$out = Join-Path $PSScriptRoot '..\icons'
New-Item -ItemType Directory -Force $out | Out-Null

function New-Icon([int]$size, [string]$file, [double]$pad) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.TextRenderingHint = 'AntiAliasGridFit'
  $g.InterpolationMode = 'HighQualityBicubic'

  # Fundo: tinta noturna
  $g.Clear([System.Drawing.Color]::FromArgb(255, 11, 16, 32))

  # Aurora: manchas com as cores das cédulas
  $blobs = @(
    @{ x = 0.05; y = 0.0;  r = 0.75; c = @(79, 163, 224) },   # azul R$100
    @{ x = 0.55; y = 0.55; r = 0.70; c = @(165, 139, 239) },  # lilás R$5
    @{ x = 0.70; y = -0.1; r = 0.50; c = @(242, 181, 68) }    # dourado R$20
  )
  foreach ($b in $blobs) {
    $d = $size * $b.r
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse([float]($size * $b.x - $d / 4), [float]($size * $b.y - $d / 4), [float]$d, [float]$d)
    $pg = New-Object System.Drawing.Drawing2D.PathGradientBrush $path
    $pg.CenterColor = [System.Drawing.Color]::FromArgb(150, $b.c[0], $b.c[1], $b.c[2])
    $pg.SurroundColors = @([System.Drawing.Color]::FromArgb(0, $b.c[0], $b.c[1], $b.c[2]))
    $g.FillPath($pg, $path)
  }

  # Placa de vidro
  $p = $size * $pad
  $w = $size - 2 * $p
  $rad = $w * 0.26
  $rect = New-Object System.Drawing.RectangleF ([float]$p), ([float]$p), ([float]$w), ([float]$w)
  $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
  $gp.AddArc($rect.X, $rect.Y, $rad, $rad, 180, 90)
  $gp.AddArc($rect.Right - $rad, $rect.Y, $rad, $rad, 270, 90)
  $gp.AddArc($rect.Right - $rad, $rect.Bottom - $rad, $rad, $rad, 0, 90)
  $gp.AddArc($rect.X, $rect.Bottom - $rad, $rad, $rad, 90, 90)
  $gp.CloseFigure()
  $glass = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.Color]::FromArgb(70, 255, 255, 255)), ([System.Drawing.Color]::FromArgb(18, 255, 255, 255)), 60
  $g.FillPath($glass, $gp)
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(110, 255, 255, 255)), ([float]($size * 0.008))
  $g.DrawPath($pen, $gp)

  # Linhas de gravura (guilhoché) dentro da placa
  $g.SetClip($gp)
  $gpen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(38, 255, 255, 255)), ([float][Math]::Max(1, $size * 0.004))
  for ($k = 0; $k -lt 9; $k++) {
    $pts = New-Object System.Collections.Generic.List[System.Drawing.PointF]
    for ($i = 0; $i -le 60; $i++) {
      $x = $p + $w * $i / 60
      $y = $p + $w * (0.55 + 0.05 * $k) + [Math]::Sin($i / 60 * 6.283 * 2 + $k * 0.5) * $w * 0.05
      $pts.Add((New-Object System.Drawing.PointF ([float]$x), ([float]$y)))
    }
    $g.DrawCurve($gpen, $pts.ToArray())
  }
  $g.ResetClip()

  # Letra B
  $font = New-Object System.Drawing.Font 'Segoe UI', ([float]($w * 0.52)), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = 'Center'; $sf.LineAlignment = 'Center'
  $textRect = New-Object System.Drawing.RectangleF ([float]$p), ([float]($p - $w * 0.03)), ([float]$w), ([float]$w)
  $g.DrawString('B', $font, [System.Drawing.Brushes]::White, $textRect, $sf)

  $bmp.Save((Join-Path $out $file), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

New-Icon 180 'icon-180.png' 0.14
New-Icon 192 'icon-192.png' 0.14
New-Icon 512 'icon-512.png' 0.14
New-Icon 512 'icon-maskable-512.png' 0.22
Write-Output "Ícones gerados em $out"
