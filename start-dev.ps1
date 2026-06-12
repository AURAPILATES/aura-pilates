$env:PATH = "$env:USERPROFILE\node;$env:PATH"
Set-Location $PSScriptRoot
npx next dev
