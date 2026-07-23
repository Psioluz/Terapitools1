; Instalador de "Psicoluz Sistema"
; Ábrelo con Inno Setup (https://jrsoftware.org/isdl.php) y presiona Compile (Ctrl+F9).
; La ruta de "Source" en [Files] ya está ajustada a:
;   C:\Psicoluz Administrador de sistema\psicoluz_sistema\build\windows\x64\runner\Release\
; Si vuelves a compilar el proyecto Flutter en otra ruta, ajústala aquí de nuevo.

#define MyAppName "Psicoluz Sistema"
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
; Ruta ajustada a tu proyecto compilado
Source: "C:\Psicoluz Administrador de sistema\psicoluz_sistema\build\windows\x64\runner\Release\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Abrir {#MyAppName}"; Flags: nowait postinstall skipifsilent
