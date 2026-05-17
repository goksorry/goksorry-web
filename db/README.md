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

최근 적용:

- `20260516143611_goksorry-room-reply-160.sql`: 곡소리방 덧글 최대 길이를 160자로 조정.
- `20260517142230_goksorry-room-reply-count.sql`: `goksorry_room_entries.reply_count`와 덧글 count 유지 trigger 추가.
- 위 두 migration은 2026-05-18에 Supabase CLI `npx supabase db push --workdir .`로 remote project `oldbntwoxhtaehpirepn`에 적용했습니다.
