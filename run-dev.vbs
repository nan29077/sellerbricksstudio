Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "E:\프로젝트\셀러브릭스 예약"
shell.Run "cmd /k npm run dev", 1, False
