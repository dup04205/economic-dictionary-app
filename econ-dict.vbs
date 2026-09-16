Option Explicit

' ---------------------------------------------------------------
'  econ-dict.vbs : 콘솔 창 없이 기본 브라우저로 사전 앱을 연다.
'  스크립트가 놓인 폴더를 기준으로 index.html 을 찾으므로
'  폴더째 어디로 옮겨도 그대로 동작한다.
' ---------------------------------------------------------------

Dim fso, shell, baseDir, target
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

baseDir = fso.GetParentFolderName(WScript.ScriptFullName)
target = fso.BuildPath(baseDir, "index.html")

If Not fso.FileExists(target) Then
    MsgBox "index.html 을 찾지 못했다." & vbCrLf & vbCrLf & _
           "econ-dict.vbs 는 index.html 과 같은 폴더에 두어야 한다." & vbCrLf & _
           "찾은 경로: " & target, _
           vbCritical, "시사경제용어사전"
    WScript.Quit 1
End If

' 1 = 창을 보통 크기로, False = 브라우저가 닫힐 때까지 기다리지 않음
shell.Run """" & target & """", 1, False
