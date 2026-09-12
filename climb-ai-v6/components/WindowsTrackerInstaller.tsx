'use client';
import {useState} from 'react';

export function WindowsTrackerInstaller({token,origin}:{token:string;origin:string}){
  const [downloaded,setDownloaded]=useState(false);

  function download(){
    const web=origin.replace(/[\r\n"]/g,'').replace(/\/$/,'');
    const trackerToken=token.replace(/[\r\n"]/g,'');
    const lines=[
      '@echo off',
      'setlocal EnableExtensions',
      'title OVERPOWERED CLIMB AI Tracker Setup',
      'color 0A',
      'echo.',
      'echo ============================================================',
      'echo          OVERPOWERED CLIMB AI TRACKER - ALPHA SETUP',
      'echo ============================================================',
      'echo Silent League recording for post-game coaching. No live shotcalling.',
      'echo.',
      'set "OP_HOME=%LOCALAPPDATA%\\OVERPOWERED\\Tracker"',
      'if not exist "%OP_HOME%" mkdir "%OP_HOME%"',
      'echo [1/4] Downloading the OVERPOWERED CLIMB AI tracker...',
      `powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -UseBasicParsing -Uri '${web}/tracker/overpowered-companion.mjs' -OutFile '%OP_HOME%\\main.mjs'"`,
      'if errorlevel 1 goto :download_failed',
      'echo [2/4] Checking Node.js...',
      'where node >nul 2>&1',
      'if not errorlevel 1 goto :write_launcher',
      'if exist "%ProgramFiles%\\nodejs\\node.exe" goto :write_launcher',
      'echo Node.js is not installed. Installing the current LTS automatically...',
      'where winget >nul 2>&1',
      'if errorlevel 1 goto :node_manual',
      'winget install --id OpenJS.NodeJS.LTS -e --silent --accept-source-agreements --accept-package-agreements --disable-interactivity',
      'if exist "%ProgramFiles%\\nodejs\\node.exe" goto :write_launcher',
      'where node >nul 2>&1',
      'if errorlevel 1 goto :node_manual',
      ':write_launcher',
      'echo [3/4] Saving your secure PC pairing...',
      '> "%OP_HOME%\\start.cmd" echo @echo off',
      '>> "%OP_HOME%\\start.cmd" echo title OVERPOWERED CLIMB AI Tracker',
      `>> "%OP_HOME%\\start.cmd" echo set "OP_WEB_URL=${web}"`,
      `>> "%OP_HOME%\\start.cmd" echo set "OP_TRACKER_TOKEN=${trackerToken}"`,
      `>> "%OP_HOME%\\start.cmd" echo powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; try { Invoke-WebRequest -UseBasicParsing -Uri '${web}/tracker/overpowered-companion.mjs' -OutFile '%%LOCALAPPDATA%%\\OVERPOWERED\\Tracker\\main.mjs' } catch { }"`,
      '>> "%OP_HOME%\\start.cmd" echo set "NODE_EXE=node"',
      '>> "%OP_HOME%\\start.cmd" echo if exist "%%ProgramFiles%%\\nodejs\\node.exe" set "NODE_EXE=%%ProgramFiles%%\\nodejs\\node.exe"',
      '>> "%OP_HOME%\\start.cmd" echo "%%NODE_EXE%%" "%%LOCALAPPDATA%%\\OVERPOWERED\\Tracker\\main.mjs"',
      'echo [4/4] Creating your desktop shortcut...',
      'powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws=New-Object -ComObject WScript.Shell; $shortcut=$ws.CreateShortcut([Environment]::GetFolderPath(\'Desktop\')+\'\\OVERPOWERED CLIMB AI Tracker.lnk\'); $shortcut.TargetPath=\'%LOCALAPPDATA%\\OVERPOWERED\\Tracker\\start.cmd\'; $shortcut.WorkingDirectory=\'%LOCALAPPDATA%\\OVERPOWERED\\Tracker\'; $shortcut.Description=\'OVERPOWERED CLIMB AI League tracker\'; $shortcut.Save()"',
      'echo.',
      'echo Setup complete. Starting OVERPOWERED CLIMB AI Tracker now.',
      'echo Keep the tracker window open while playing League.',
      'echo Future launches: double-click OVERPOWERED CLIMB AI Tracker on your desktop.',
      'echo.',
      'start "" "%OP_HOME%\\start.cmd"',
      'timeout /t 4 >nul',
      'exit /b 0',
      ':download_failed',
      'echo.',
      'echo The tracker could not be downloaded. Check your internet connection and try again.',
      'pause',
      'exit /b 1',
      ':node_manual',
      'echo.',
      'echo Automatic Node.js installation is unavailable on this Windows PC.',
      'echo Opening the official Node.js download page. Install Node.js LTS, then run this setup again.',
      'start "" "https://nodejs.org/en/download"',
      'pause',
      'exit /b 1',
      '',
    ];
    const blob=new Blob([lines.join('\r\n')],{type:'application/octet-stream'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download='OVERPOWERED-CLIMB-AI-Tracker-Setup.cmd';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setDownloaded(true);
  }

  return <div className="glass card" style={{marginTop:18,display:'grid',gap:12}}>
    <div className="eyebrow">PC PAIRED · INSTALLER READY</div>
    <h3 style={{margin:0}}>Install the OVERPOWERED CLIMB AI Tracker</h3>
    <p className="muted" style={{margin:0}}>One download. The setup checks for Node.js, installs it automatically through Windows Package Manager when needed, saves this PC&apos;s secure pairing, creates a desktop shortcut and starts the tracker.</p>
    <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
      <button className="btn primary" type="button" onClick={download}>DOWNLOAD WINDOWS TRACKER</button>
      <span className="muted">Then double-click <b>OVERPOWERED-CLIMB-AI-Tracker-Setup.cmd</b>.</span>
    </div>
    {downloaded&&<div className="auth-message" role="status">Installer downloaded. Run it once. After setup, use the OVERPOWERED CLIMB AI Tracker shortcut on your desktop before playing League.</div>}
    <small className="muted">Alpha note: Windows may show an “unknown publisher” warning because this test installer is not code-signed yet. Only run the setup file you downloaded directly from this OVERPOWERED CLIMB AI page.</small>
  </div>;
}
