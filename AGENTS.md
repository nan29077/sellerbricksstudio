# 스토리지마켓 작업공간

이 저장소는 스토리지마켓(구 셀러브릭스 스튜디오)의 계속되는 개발 작업공간입니다. GitHub 저장소는 `https://github.com/nan29077/storagemarket`입니다.

- 창고(스튜디오) 관리자 계정은 없습니다(2026-11-14). 창고는 본사가 운영합니다: 최고관리자(모든 창고) · 창고 운영 매니저(MANAGER, 담당 창고만). 권한 확인은 `src/lib/facility-owner.ts`의 `canOperateFacility` · `facilityScope`, 창고 알림은 `notifyFacility`를 씁니다. `Facility.ownerId`로 권한을 확인하지 마세요.

- Next.js 14 앱이며 로컬 개발 포트는 3007입니다.
- 브랜드의 기본 색상은 네이비 `#1A1A2E`와 골드 `#F5A623`입니다.
- 카카오톡·SNS 공유 카드 파일은 `public/images/social/share-card.png`입니다. 배경 원본과 재생성 방법은 README의 공유 카드 항목을 참고하세요.
- `.env`와 `.env.local`에는 자격 증명이 들어갈 수 있으므로 Git에 추가하지 않습니다.
