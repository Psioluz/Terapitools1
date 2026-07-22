; Instalador de "Centro de Gestión Psicoluz · Sistema"
; Ábrelo con Inno Setup (https://jrsoftware.org/isdl.php) y presiona Compile (Ctrl+F9).
; Antes de compilar, revisa que la línea "Source" en [Files] apunte a la carpeta
; build\windows\x64\runner\Release\ del proyecto Flutter psicoluz_sistema.

#define MyAppName "Centro de Gestión Psicoluz - Sistema"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Psicoluz"
#define MyAppExeName "psicoluz_sistema.exe"

[Setup]
AppId={{B7B2B0C1-8F3E-4C2B-9A11-PSICOLUZSISTEMA}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName=C:\Psicoluz\Sistema
DefaultGroupName=Psicoluz
DisableProgramGroupPage=yes
PrivilegesRequired=admin
OutputBaseFilename=Instalar_Psicoluz_Sistema
Compression=lzma
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\{#MyAppExeName}

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "Crear acceso directo en el Escritorio"; GroupDescription: "Accesos directos:"

[Files]
; Ajusta esta ruta a donde compilaste el proyecto Flutter
Source: "..\sistema\build\windows\x64\runner\Release\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Abrir {#MyAppName}"; Flags: nowait postinstall skipifsilent
