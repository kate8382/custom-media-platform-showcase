@echo off
where ffmpeg >nul 2>&1
if errorlevel 1 (
  echo ffmpeg not found. Install ffmpeg first (see scripts\merge_instructions.md)
  exit /b 1
)
if "%1"=="" (
  echo Usage: merge_audio_video.bat ^<video-file^> ^<audio-file^> [output-file]
  exit /b 2
)
set VIDEO=%1
set AUDIO=%2
set OUT=%3
if "%OUT%"=="" set OUT=merged_%~nx1
ffmpeg -y -i "%VIDEO%" -i "%AUDIO%" -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 "%OUT%"
echo Merged -> %OUT%
