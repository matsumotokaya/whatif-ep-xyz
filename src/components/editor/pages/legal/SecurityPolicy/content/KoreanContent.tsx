import { Link } from '@/components/editor/lib/router';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-200 pb-4 last:border-0">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
      <div className="text-gray-700">{children}</div>
    </div>
  );
}

export function KoreanContent() {
  return (
    <>
      <Section title="1. 소개">
        <p>
          IMAGINE(이하 &quot;본 서비스&quot;)은 사용자 여러분의 정보 보안을 최우선 과제로 삼아
          적절한 기술적·조직적 대책을 마련하고 있습니다.
        </p>
      </Section>

      <Section title="2. 데이터 암호화">
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold mb-2">통신 암호화</h3>
            <p className="text-gray-700">
              본 서비스는 모든 통신에 대해 TLS/SSL(HTTPS) 암호화 프로토콜을 사용합니다.
              이를 통해 고객님의 브라우저와 본 서비스 간에 송수신되는 데이터는 제3자의 도청이나 변조로부터 보호됩니다.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">저장 데이터 암호화</h3>
            <p className="text-gray-700">
              데이터베이스에 저장되는 사용자 정보는 업계 표준 암호화 기술로 보호됩니다.
            </p>
          </div>
        </div>
      </Section>

      <Section title="3. 인증 및 액세스 제어">
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>
            <strong>Google OAuth 2.0 인증</strong>:
            안전한 Google 계정 인증을 채택하여 비밀번호를 본 서비스에 저장하지 않습니다.
          </li>
          <li>
            <strong>행 수준 보안(RLS)</strong>:
            데이터베이스 수준에서 액세스 제어를 실시하여 사용자는 자신의 데이터에만 액세스할 수 있습니다.
          </li>
          <li>
            <strong>세션 관리</strong>:
            안전한 세션 토큰으로 무단 액세스를 방지합니다.
          </li>
        </ul>
      </Section>

      <Section title="4. 결제 정보 보안">
        <p className="mb-3">
          본 서비스는 결제 처리에 Stripe를 사용합니다. 신용카드 정보는 본 서비스의 서버를 거치지 않으며,
          PCI DSS(Payment Card Industry Data Security Standard) 준수 Stripe가 직접 처리합니다.
        </p>
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          <li>신용카드 번호는 본 서비스에서 저장·보관하지 않습니다</li>
          <li>Stripe는 국제 보안 표준 PCI DSS Level 1 인증을 취득했습니다</li>
        </ul>
      </Section>

      <Section title="5. 데이터 백업">
        <p className="text-gray-700">
          데이터 손실을 방지하기 위해 Supabase(데이터베이스·스토리지 제공업체)에 의한
          정기적인 자동 백업이 실시됩니다.
        </p>
      </Section>

      <Section title="6. 인프라 보안">
        <div className="space-y-2">
          <p><strong>이용 서비스</strong></p>
          <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
            <li><strong>Vercel</strong>: 엔터프라이즈급 호스팅, DDoS 보호, 자동 SSL 인증서</li>
            <li><strong>Supabase</strong>: PostgreSQL 데이터베이스, 엔터프라이즈급 보안</li>
            <li><strong>Stripe</strong>: PCI DSS 준수 결제 처리</li>
          </ul>
          <p className="mt-3 text-gray-700">
            모든 인프라는 업계 표준 보안 대책을 실시하는 신뢰할 수 있는 제공업체를 사용합니다.
          </p>
        </div>
      </Section>

      <Section title="7. 보안 사고 대응">
        <p className="mb-2">
          만약 보안 사고가 발생한 경우 다음과 같은 조치를 취합니다:
        </p>
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          <li>신속하게 원인을 파악하여 피해 확대 방지</li>
          <li>영향을 받는 사용자에게 통지</li>
          <li>필요시 관계 당국에 보고</li>
          <li>재발 방지 대책 실시</li>
        </ul>
      </Section>

      <Section title="8. 사용자 여러분께 부탁드립니다">
        <p className="mb-2">보안을 유지하기 위해 다음 사항에 협조해 주세요:</p>
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          <li>로그인 정보를 제3자와 공유하지 마세요</li>
          <li>공용 단말 사용 후 반드시 로그아웃하세요</li>
          <li>의심스러운 활동을 발견하면 즉시 연락해 주세요</li>
        </ul>
      </Section>

      <Section title="9. 문의하기">
        <p>
          보안 관련 질문이나 신고는
          <Link to="/contact" className="text-blue-600 hover:underline mx-1">
            문의 페이지
          </Link>
          또는 contact@whatif-ep.xyz로 연락해 주세요.
        </p>
      </Section>
    </>
  );
}
