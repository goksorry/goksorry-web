update public.policy_document_versions
set superseded_at = now()
where type in ('terms', 'privacy')
  and superseded_at is null
  and effective_at > now();

insert into public.policy_document_versions (
  type,
  summary,
  body,
  is_adverse,
  published_at,
  effective_at,
  updated_at,
  created_at
)
select
  'terms',
  '비회원 채팅 참여 정책 반영',
  replace(
    replace(
      body,
      '- 로그인한 회원은 게시글, 댓글, 신고 및 채팅 기능이 제공되는 경우 회원용 채팅 참여 기능을 사용할 수 있습니다.',
      '- 로그인한 회원은 게시글, 댓글, 신고 및 실시간 채팅 기능을 사용할 수 있습니다.'
    ),
    '- 비회원은 운영자가 정한 범위 내에서 열람 등 일부 기능만 이용할 수 있습니다.',
    '- 비회원은 운영자가 정한 범위 내에서 열람 기능과 닉네임 기반 실시간 채팅 기능을 이용할 수 있습니다.' || chr(10) ||
    '- 비회원 채팅 메시지에는 비회원 표시(*)가 함께 표시될 수 있습니다.'
  ),
  false,
  now(),
  now(),
  now(),
  now()
from (
  select body
  from public.policy_document_versions
  where type = 'terms'
    and superseded_at is null
    and effective_at <= now()
  order by effective_at desc, published_at desc
  limit 1
) current_terms
union all
select
  'privacy',
  '비회원 채팅 닉네임 쿠키 고지',
  replace(
    replace(
      replace(
        body,
        '- 채팅 기능이 활성화된 경우 비회원 읽기 세션을 위한 쿠키 정보',
        '- 채팅 기능이 활성화된 경우 비회원 채팅 세션 및 닉네임 쿠키 정보'
      ),
      '- 커뮤니티 글쓰기, 댓글, 신고, 채팅 기능이 제공되는 경우 회원용 채팅 및 프로필 기능 제공',
      '- 커뮤니티 글쓰기, 댓글, 신고, 채팅 기능이 제공되는 경우 회원용 채팅, 비회원 닉네임 기반 채팅 및 프로필 기능 제공'
    ),
    '- 필수 저장 항목: 로그인 세션 유지, 쿠키 동의 상태, 테마, 예쁜말 필터, 홈 시장 보정, 채팅 기능이 활성화된 경우 비회원 읽기 세션',
    '- 필수 저장 항목: 로그인 세션 유지, 쿠키 동의 상태, 테마, 예쁜말 필터, 홈 시장 보정, 채팅 기능이 활성화된 경우 비회원 채팅 세션 및 닉네임'
  ),
  false,
  now(),
  now(),
  now(),
  now()
from (
  select body
  from public.policy_document_versions
  where type = 'privacy'
    and superseded_at is null
    and effective_at <= now()
  order by effective_at desc, published_at desc
  limit 1
) current_privacy;
