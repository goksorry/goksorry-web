# DB schema definitions

현재는 Supabase CLI migration workflow를 사용합니다.

- CLI 적용 경로: `../supabase/migrations`
- 리포 SQL 히스토리: `./migrations`
- 장기 기준 스키마 파일: `./schema.sql`

원칙:

- 새 변경은 `npx supabase migration new ... --workdir .` 로 생성합니다.
- 실제 원격 적용은 `npx supabase db push --workdir .` 로 처리합니다.
- `supabase/migrations` 에 들어간 변경은 필요 시 `db/migrations` 에도 같은 내용을 반영합니다.
- 스키마나 초기 시드 성격의 내용이 바뀌면 `schema.sql` 도 함께 갱신합니다.

현재 곡소리방 스키마 기준:

- 곡소리방 덧글 최대 길이는 160자입니다.
- `goksorry_room_entries.reply_count`는 덧글 insert/update/delete trigger로 유지합니다.

개미 월드 기록:

- `026_world_snapshots.sql` / `20261114171745_world_snapshots.sql`: RLS를 켠 서버 전용 10분 기록 테이블입니다.
- 수집 완료 register 경로에서 같은 버킷을 갱신하며 7일 이전 버킷을 정리합니다. 방문자 GET은 기록하지 않습니다.
- 기존 기록 backfill은 없습니다. 마이그레이션 적용 후 첫 수집 완료부터 기록됩니다.
- 임시 로컬 PostgreSQL 검증: `psql "$WORLD_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/world-schema.sql` (저장소 루트에서 실행). 검사는 트랜잭션을 롤백합니다.
