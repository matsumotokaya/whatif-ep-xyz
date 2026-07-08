import { Section } from './Section';

export function KoreanContent() {
  return (
    <>
      <Section title="1. 소개">
        <p>
          IMAGINE(이하 "본 서비스")은 Kaya Matsumoto(이하 "운영자")가 제공하는 배너 디자인 도우미 도구입니다.
          본 개인정보처리방침은 본 서비스에서의 개인정보 취급에 대해 설명합니다.
        </p>
      </Section>

      <Section title="2. 수집하는 정보">
        <p className="mb-2">본 서비스에서는 다음 정보를 수집합니다:</p>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>
            <strong>계정 정보</strong>: Google OAuth를 통해 취득하는 이메일 주소, 이름, 프로필 사진
          </li>
          <li>
            <strong>결제 정보</strong>: Stripe를 통해 처리되는 신용카드 정보(본 서비스에서는 저장하지 않습니다)
          </li>
          <li>
            <strong>이용 정보</strong>: 생성한 배너 디자인, 업로드한 이미지, 서비스 이용 기록
          </li>
          <li>
            <strong>기술 정보</strong>: IP 주소, 브라우저 정보, 액세스 로그
          </li>
        </ul>
      </Section>

      <Section title="3. 정보 이용 목적">
        <p className="mb-2">수집한 정보는 다음 목적으로 이용합니다:</p>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>서비스 제공·운영·개선</li>
          <li>사용자 지원 대응</li>
          <li>결제 처리 및 구독 관리</li>
          <li>부정 이용 방지·보안 대책</li>
          <li>이용 상황 분석·통계 데이터 작성</li>
          <li>중요한 공지 전달</li>
        </ul>
      </Section>

      <Section title="4. 제3자 제공">
        <p className="mb-2">본 서비스는 다음 제3자 서비스를 이용합니다:</p>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>
            <strong>Supabase</strong>: 데이터베이스·인증·스토리지(미국)
          </li>
          <li>
            <strong>Stripe</strong>: 결제 처리(미국)
          </li>
          <li>
            <strong>Google</strong>: OAuth 인증(미국)
          </li>
          <li>
            <strong>Vercel</strong>: 호스팅(미국)
          </li>
        </ul>
        <p className="mt-3 text-gray-700">
          이들 서비스는 각각의 개인정보처리방침에 따라 정보를 처리합니다.
          법령에 따른 경우를 제외하고 사용자 동의 없이 제3자에게 개인정보를 제공하지 않습니다.
        </p>
      </Section>

      <Section title="5. 데이터 보관 기간">
        <p>
          개인정보는 계정이 유효한 동안 보관됩니다. 계정 삭제 후에는 법령에서 정한 기간을 제외하고
          신속히 삭제합니다.
        </p>
      </Section>

      <Section title="6. 보안">
        <p>
          본 서비스는 개인정보의 유출, 멸실, 훼손을 방지하기 위해 적절한 보안 대책을 강구하고 있습니다.
          데이터 통신은 SSL/TLS로 암호화되며, 데이터베이스 액세스는 엄격히 제한됩니다.
        </p>
      </Section>

      <Section title="7. 사용자 권리">
        <p className="mb-2">사용자는 다음 권리를 가집니다:</p>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>자신의 개인정보 열람 요구</li>
          <li>개인정보 정정·삭제 요구</li>
          <li>개인정보 이용 중지 요구</li>
          <li>계정 삭제</li>
        </ul>
        <p className="mt-3 text-gray-700">
          이러한 권리를 행사하려면 contact@whatif-ep.xyz로 연락해 주세요.
        </p>
      </Section>

      <Section title="8. 쿠키(Cookie)">
        <p>
          본 서비스는 서비스 편의성 향상을 위해 쿠키를 사용합니다.
          브라우저 설정에서 쿠키를 비활성화할 수 있지만, 일부 기능을 이용할 수 없을 수 있습니다.
        </p>
      </Section>

      <Section title="9. 아동 개인정보">
        <p>
          본 서비스는 13세 미만 아동을 대상으로 하지 않습니다.
          13세 미만의 아동이 실수로 개인정보를 제공한 것이 확인되면 신속히 삭제합니다.
        </p>
      </Section>

      <Section title="10. 개인정보처리방침 변경">
        <p>
          본 개인정보처리방침은 법령 변경이나 서비스 개선에 따라 예고 없이 변경될 수 있습니다.
          중요한 변경 사항이 있는 경우 서비스 내 또는 이메일로 통지합니다.
        </p>
      </Section>

      <Section title="11. 문의하기">
        <p>
          본 개인정보처리방침에 대한 질문은 다음으로 문의해 주세요:
        </p>
        <p className="mt-2 text-gray-700">
          이메일 주소: contact@whatif-ep.xyz
        </p>
      </Section>
    </>
  );
}
