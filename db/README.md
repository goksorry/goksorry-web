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
