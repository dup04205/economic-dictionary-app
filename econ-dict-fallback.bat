@echo off
title 시사경제용어사전

rem ---------------------------------------------------------------
rem  econ-dict.bat : 기본 브라우저로 사전 앱을 연다.
rem  %~dp0 은 이 배치 파일이 놓인 폴더 경로다. 따라서 폴더째
rem  어디로 옮기든, 바탕화면에 바로가기를 만들어 두든 동작한다.
rem ---------------------------------------------------------------

if not exist "%~dp0index.html" (
    echo.
    echo  [오류] index.html 을 찾지 못했다.
    echo  econ-dict.bat 은 index.html 과 같은 폴더에 두어야 한다.
    echo.
    pause
    exit /b 1
)

start "" "%~dp0index.html"
exit /b 0
