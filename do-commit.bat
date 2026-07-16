@echo off
cd /d "E:\프로젝트\셀러브릭스 스튜디오"
git add .
git commit -m "중간관리자 UI 삭제, 메인 배너 텍스트 가독성 수정, 꿀벌 이미지 삭제, 전체시설 메뉴 삭제"
del "%~f0"
pause
